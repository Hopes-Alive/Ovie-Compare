# Message retrieval & chat brain

How user questions become grounded product answers.

## Overview

**Not** document RAG with arbitrary chunks. Each `supplier_products` row is a structured entity. Retrieval combines:

1. **Structured filters** — price, stock, supplier, sort
2. **Full-text search** — name, brand, category
3. **Native pgvector search** — semantic / fuzzy match, run server-side against the
   **entire** `supplier_products` table via a Postgres RPC (HNSW-indexed), not a
   JS rerank of whatever the other two arms happened to return

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
    intent classification (chat vs. search) + tool calls (NOT raw SQL)
    ↓
    ├── intent = chat (greeting/small talk/thanks/banter/meta)
    │     → reply directly in plain text, no retrieval, no product cards
    │
    └── intent = search (wants to find/compare/check products)
          ↓
        ┌───────────────────────────────────────────┐
        │  Retrieval service (backend)              │
        │  parallel, per attempt:                   │
        │    - structured ILIKE query + hard filters │
        │    - FTS on search_vector + hard filters   │
        │    - native pgvector RPC (full table,      │
        │      hard filters only, HNSW-indexed)      │
        │  → merge pool → RRF(FTS rank, vector rank) │
        │  → top K (5)                              │
        └───────────────────────────────────────────┘
          ↓
        Answer LLM
            grounded JSON context only
          ↓
        UI: text + product cards + timestamps + [Check live price]
```

**Intent gate:** the planner's `searchProducts` tool call is optional (`tool_choice: "auto"`),
not forced. For non-product turns (greetings, thanks, reactions like "oh nice", jokes,
questions about Ovie itself) the planner replies in plain text with a warm, human,
slightly witty tone and skips retrieval entirely — no product cards are shown. This
keeps multi-turn conversations feeling natural instead of forcing a product search on
every message. See `plannerTurn` / `PlannerResult` in `backend/src/services/brain/`.

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

### Native pgvector search (`search_products_with_filters` RPC)

Implemented as a Postgres RPC (`backend/supabase/migrations/002_brain_search_functions.sql`,
extended in `007_vector_search_columns.sql`) called from `runVectorSearch()` in
`backend/src/services/brain/retrieval.ts` via `supabase.rpc(...)`. It searches the
**full table** (~20k+ rows), not a JS-side subset:

```sql
SELECT ..., 1 - (sp.embedding <=> $query_embedding) AS similarity
FROM supplier_products sp
JOIN suppliers s ON s.id = sp.supplier_id
WHERE sp.is_active = true AND sp.embedding IS NOT NULL
  -- only "hard" filters — see note below
  AND (...supplier_slug / stock_status / price...)
ORDER BY sp.embedding <=> $query_embedding
LIMIT 40;
```

Scoped by an HNSW index (`supplier_products_embedding_hnsw_idx`, `vector_cosine_ops`)
so the `ORDER BY ... LIMIT` is index-accelerated instead of a full sequential scan.

**Deliberately scoped to "hard" filters only** — `supplier_slug`, `stock_status`,
`price_exact`/`price_min`/`price_max`. It intentionally **ignores** the planner's
guessable filters (`name`, `brand`, `category`, `subcategory`) so it can still
surface a genuinely relevant product even when those literal-match guesses are
wrong or too narrow — that's the whole point of having an independent vector arm
instead of just reranking the filter/FTS pool.

**Implementation note (important if you touch this function):** the function is
`LANGUAGE plpgsql` using dynamic SQL (`EXECUTE ... USING`), **not** plain
`LANGUAGE sql` with `(param IS NULL OR col = param)` predicates. This is required,
not stylistic — PostgREST always issues `SET ROLE <target>` before running any
query. The moment a session has executed `SET ROLE` (even back to the same role),
Postgres stops inlining `LANGUAGE sql` functions and runs them as an opaque
"Function Scan" with a single cached, value-agnostic plan. For a query with
several `IS NULL OR` branches, that generic plan can't fold away the NULL
branches at plan time and falls back to a full sequential scan + sort instead of
the HNSW-indexed scan — confirmed via `EXPLAIN ANALYZE` to take ~13-16s instead
of ~0.3-0.8s. Building the WHERE clause dynamically (only including a clause when
that filter is actually supplied) sidesteps this: each call gets a freshly
planned query tailored to its actual shape, regardless of the caller's
role-switching history.

### Hybrid merge

Run all three arms in parallel per attempt when query is product-related (see
`buildHybridPool` in `retrieval.ts`). Merge into one deduped pool by row id, then
combine via **reciprocal rank fusion (RRF)** over the FTS rank list and the
native vector arm's own rank list (the vector RPC's results are already sorted
by Postgres, so no JS-side cosine computation happens at all):

```
rrf_score(id) = 1/(k + fts_rank(id) + 1) + 1/(k + vector_rank(id) + 1)   // k = 60
```

Final ordering: RRF score desc, tie-broken by the vector arm's native
`similarity` value (0 for rows the vector arm didn't return).

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

1. Drop optional filters (brand, maxPrice) — see the widening `attempts` list in `buildHybridPool`
2. Widen category/subcategory match
3. Drop stock filter (so an out-of-stock row can still be reported truthfully)
4. Absolute last resort: drop `name` entirely, FTS-only on the dropped keyword (`rescueWithoutName`)
5. Planner asks clarifying question

Note: the native pgvector arm (see above) already runs on every attempt regardless
of `name`/`category`, so most cases that used to need a "vector-only" fallback are
now caught on the very first attempt instead of needing to progressively widen.

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
