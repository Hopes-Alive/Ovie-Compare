# Message retrieval & chat brain

How user questions become grounded product answers.

## Overview

**Not** document RAG with arbitrary chunks. Each `supplier_products` row is a structured entity. Retrieval combines:

1. **Structured filters** — price, stock, supplier, sort
2. **Full-text search** — name, brand, category
3. **Vector search** — semantic / fuzzy match

LLM plans and formats; **backend** executes safe retrieval.

---

## Flow diagram

```
User message
    +
Session history
    ↓
Query rewriter (optional)
    "those medium ones" → "nitrile gloves medium"
    ↓
Planner LLM
    intent + tool calls (NOT raw SQL)
    ↓
┌─────────────────────────────────────┐
│  Retrieval service (backend)        │
│  parallel:                          │
│    - structured query + sort        │
│    - FTS on search_vector           │
│    - vector similarity on embedding │
│  → merge / rerank → top K (5–10)    │
└─────────────────────────────────────┘
    ↓
Answer LLM
    grounded JSON context only
    ↓
UI: text + product cards + timestamps + [Check live price]
```

---

## Two LLM passes (recommended)

| Pass | Input | Output |
|------|-------|--------|
| **Planner** | History + user message | Tool calls + intent |
| **Answer** | User message + retrieved products JSON | Natural language + structured payload for UI |

Can be one call with tool results fed back — two passes is clearer for debugging.

---

## Planner tools (typed — no raw SQL)

### `searchProducts`

```ts
{
  query: string              // "nitrile gloves medium"
  supplierSlugs?: string[]     // ["henry-schein", "adam-dental"]
  category?: string
  brand?: string
  inStockOnly?: boolean
  maxPrice?: number
  minPrice?: number
  sortBy?: "price_asc" | "price_desc" | "relevance"
  limit?: number               // default 10
}
```

### `compareProducts`

```ts
{ productIds: string[] }
```

### `checkLivePrice`

```ts
{ productIds: string[] }
```

### `getProductsByIds`

For follow-ups: "tell me more about the second one"

```ts
{ productIds: string[] }
```

---

## Tool descriptions for planner prompt

Include column semantics + examples:

```
stock_status: "in_stock" | "out_of_stock" | "low_stock" | "unknown"
price: AUD, typically inc GST
supplierSlugs: "henry-schein" | "adam-dental"
sortBy price_asc for "cheapest" questions
```

---

## Retrieval implementation

### Structured query

When planner passes filters:

```sql
SELECT *
FROM supplier_products sp
JOIN suppliers s ON s.id = sp.supplier_id
WHERE sp.is_active = true
  AND s.is_active = true
  AND ($supplierSlugs IS NULL OR s.slug = ANY($supplierSlugs))
  AND ($inStockOnly = false OR sp.stock_status = 'in_stock')
  AND ($maxPrice IS NULL OR sp.price <= $maxPrice)
  AND ($category IS NULL OR sp.category ILIKE '%' || $category || '%')
ORDER BY
  CASE WHEN $sortBy = 'price_asc' THEN sp.price END ASC,
  CASE WHEN $sortBy = 'price_desc' THEN sp.price END DESC
LIMIT $limit;
```

### Full-text search

```sql
WHERE sp.search_vector @@ plainto_tsquery('english', $query)
ORDER BY ts_rank(sp.search_vector, plainto_tsquery('english', $query)) DESC
LIMIT 20;
```

### Vector search

```sql
ORDER BY sp.embedding <=> $query_embedding
LIMIT 20;
```

### Hybrid merge

Run all three in parallel when query is product-related. Merge with **reciprocal rank fusion (RRF)** or weighted scores:

```
final_score = w1 * structured_rank + w2 * fts_rank + w3 * vector_rank
```

**Heuristics:**
- "cheapest" → boost structured, force `sortBy: price_asc`
- vague product names → boost vector + FTS
- exact SKU-like tokens → boost FTS + trigram

### Variant grouping (configurable products)

Configurable products (size/shade/pack variants — see `scraping.md` § "Product
variants") are stored as one `supplier_products` row per variant, all sharing
`(supplier_id, name)` with a non-null `variant_label`. `attachVariantSiblings()`
runs after each of the three retrieval paths above, before the result limit is
applied:

1. Find rows in the current result set with a non-null `variant_label`.
2. Group by `(supplier_id, name)`, fetch **every** sibling row for that family
   (not just the ones that happened to rank in this search).
3. Attach them as `variants: VariantOption[]` on the single highest-ranked row.
4. Drop the other sibling rows from the result list.

So a search can match 13 shade variants of the same product but the caller only
ever sees **one** `ProductRow`/`ProductCardData` with a `variants` array —
never 13 near-duplicate cards for the same physical product.

### Progressive fallback if few results

1. Drop optional filters (brand, maxPrice)
2. Widen category match
3. `pg_trgm` similarity on name
4. Vector-only search
5. Planner asks clarifying question

---

## Query rewriter

Uses last N messages to produce standalone query.

```
User: Show nitrile gloves
Assistant: [shows 5 results]
User: Which is cheapest in medium?
Rewrite: nitrile gloves medium cheapest
```

Store in session or pass inline to planner.

---

## Session context (not just chat text)

`chat_sessions.context` jsonb:

```json
{
  "last_product_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "last_query": "nitrile gloves",
  "last_supplier_filter": ["henry-schein", "adam-dental"]
}
```

Follow-ups like "check live price for the first one" resolve to IDs — no re-search.

---

## Answer generation rules (system prompt)

1. Only cite products from retrieved JSON.
2. Always mention data freshness: `last_checked_at`.
3. Comparison questions → mention multiple suppliers.
4. Warn if pack sizes differ ("verify pack count").
5. If data stale (>24h), suggest live check.
6. Never invent prices or stock. When `price` is `null` and `login_required`
   is `true` on the row, say the price requires supplier login — do not
   repeat a stale/previous number.
7. Return structured `products` array for UI cards.
8. When a row has `variants` (configurable product — see "Variant grouping"
   above), list per-option prices/stock if asked for detail — **never average
   or quote a single price** for a product that has multiple variants.

---

## Example API response shape

```json
{
  "message": "Based on data checked 2 hours ago, the cheapest medium nitrile gloves are...",
  "products": [
    {
      "id": "uuid",
      "supplier": "Adam Dental",
      "name": "Nitrile Gloves Medium 100pk",
      "price": 5.95,
      "currency": "AUD",
      "stockStatus": "in_stock",
      "deliveryText": "2-3 days",
      "lastCheckedAt": "2026-06-24T08:00:00Z",
      "lastChangedAt": "2026-06-22T18:00:00Z",
      "freshness": "fresh"
    }
  ],
  "actions": [
    { "type": "live_check", "label": "Check live price", "productIds": ["uuid"] }
  ]
}
```

---

## Freshness labels

| Label | Rule |
|-------|------|
| fresh | last_checked_at < 6 hours |
| moderate | < 24 hours |
| stale | ≥ 24 hours |

---

## Intents (planner)

| Intent | Tools |
|--------|-------|
| product_search | searchProducts |
| compare | searchProducts or compareProducts |
| live_check | checkLivePrice |
| follow_up | getProductsByIds |
| clarify | no tool — ask user |
| general | no product tool — general dental procurement help (bounded) |

---

## What NOT to do

- ❌ One embedding chunk strategy for long documents — rows ARE products
- ❌ SQL only, vector only on zero results — use hybrid
- ❌ Return single best row for comparison queries
- ❌ Let LLM write SQL
- ❌ Re-embed on every price update
- ❌ Let LLM open URLs

---

## MVP simplification

Start with:

1. Query rewriter (optional)
2. Planner → `searchProducts` only
3. Backend: FTS + filters + price sort (skip vector until >100 products)
4. Answer formatting with top 10 results

Add vector + RRF when FTS alone is weak.

---

## Files (planned)

```
backend/src/services/
  chat/
    planner.ts
    answer.ts
    prompts/
  retrieval/
    search-products.ts
    hybrid-merge.ts
    embed-query.ts
  session/
    context.ts
```
