# Data scraping

How we ingest and refresh product data from Henry Schein and Adam Dental.

## Strategy summary

| Mode | When | What |
|------|------|------|
| **Initial seed** | Once per category | Search or crawl → product URLs → parse → insert |
| **Scheduled refresh** | Every 6h (priority-based later) | Re-fetch → hash compare → update changed only |
| **Live check** | User clicks button | Single product URL → parse → update + return diff |

**Do not** scrape the full 45k catalog in MVP. Target **3–5 categories**, ~300–800 products total.

---

## MVP categories

| Category | Example query |
|----------|----------------|
| Nitrile gloves | Cheapest gloves |
| Composites (A2) | Composite A2 |
| Sterilisation pouches | Fastest delivery |
| Infection control | Broader supplies |

~50–100 products per supplier per category to start.

---

## Supplier-specific entry points

### Henry Schein

- Search: `https://www.henryschein.com.au/search?searchTerm={query}`
- Public prices on search (verified)
- Platform: enterprise e-commerce (SAP-style)

### Adam Dental

- Search: `https://www.adamdental.com.au/search?ProductSearch={query}`
- Public prices on search (verified)
- Note: some products may be restricted (APHRA) — parser should flag `login_required` in metadata

---

## Adapter interface

```ts
// backend/src/scrapers/base-adapter.ts

export interface ProductListing {
  externalId?: string
  externalSku?: string
  name: string
  brand?: string
  price?: number
  stockStatus?: string
  url: string
  imageUrl?: string
}

export interface ProductDetail extends ProductListing {
  category?: string
  description?: string
  packSize?: string
  deliveryText?: string
  deliveryMinDays?: number
  deliveryMaxDays?: number
  raw?: Record<string, unknown>
}

export interface SupplierAdapter {
  slug: string
  approvedDomains: string[]

  buildSearchUrl(query: string): string
  parseSearchResults(html: string, pageUrl: string): ProductListing[]
  parseProductPage(html: string, pageUrl: string): ProductDetail
  buildContentHash(detail: ProductDetail): string
}
```

### Content hash (stable fields only)

```
hash(name | external_sku | price | stock_status | pack_size)
```

Do not hash full HTML — ads and scripts cause false positives.

---

## Folder structure

```
backend/src/scrapers/
  base-adapter.ts
  registry.ts              # slug → adapter instance
  henry-schein/
    adapter.ts
    selectors.ts           # CSS selectors — change often
    parser.ts
  adam-dental/
    adapter.ts
    selectors.ts
    parser.ts
```

`registry.ts` loads adapter by `suppliers.adapter_key` from DB.

---

## Initial seed flow

```
1. Load supplier from DB
2. Get adapter from registry
3. For each seed query (e.g. "nitrile gloves", "composite A2"):
   a. buildSearchUrl(query)
   b. Playwright → HTML
   c. parseSearchResults → listings[]
   d. For each listing (or top N):
      - optional: fetch product page for full detail
      - upsert supplier_products
      - compute embedding for text fields
4. Create scrape_job record with stats
```

**Upsert key:** `(supplier_id, supplier_product_url)` or `(supplier_id, external_id)`

---

## Scheduled refresh flow

```
Cron → enqueue refresh job
  → select products WHERE last_checked_at < now() - interval
     ORDER BY scrape_priority, last_checked_at
     LIMIT batch_size

  For each product:
    1. HTTP GET or Playwright if JS-required
    2. parseProductPage
    3. new_hash = buildContentHash(detail)
    4. If new_hash == content_hash:
         UPDATE last_checked_at only
    5. Else:
         UPDATE fields, content_hash, last_changed_at
         INSERT price_history if price changed
    6. Write scrape_job_item
```

### Priority (v1.1)

| Priority | Interval | Criteria |
|----------|----------|----------|
| high | 1–2h | Searched in last 7 days |
| normal | 6h | Seed categories |
| low | 24h | Everything else |

---

## Live check flow

Stricter than bulk scrape:

```
1. Validate productIds belong to active suppliers
2. Validate URLs match approved_domains
3. Playwright open URL (timeout 60s)
4. parseProductPage
5. Compare with DB row
6. Update DB + price_history
7. Return { old, new, changed } to client via SSE
```

**Never** accept arbitrary URLs from LLM or user — only DB-stored product URLs.

---

## Playwright worker settings

```ts
// Concurrency per supplier: 3–5
// Delay between requests: 500–1500ms jitter
// User-Agent: realistic desktop
// Locale: en-AU
// Headless: true in prod
```

Separate process from API:

```
backend/src/workers/
  scrape-worker.ts
  refresh-worker.ts
  live-check-worker.ts
  embedding-worker.ts   # re-embed when text fields change
```

Queue: BullMQ + Redis

| Queue | Purpose |
|-------|---------|
| scrape-seed | Initial category ingest |
| scrape-refresh | Scheduled updates |
| live-check | User-triggered |
| embeddings | Async embedding generation |

---

## Error handling

| Error | Action |
|-------|--------|
| 404 | `is_active = false`, log job item |
| Timeout | Retry 2x with backoff, then mark failed |
| Parse failure | Save `raw_snapshot` + error, alert in admin jobs |
| Login wall detected | `metadata.login_required = true`, skip price update |
| Rate limit / 403 | Pause supplier queue, alert admin |

---

## Embedding sync (after scrape)

When `name`, `brand`, `category`, `description`, or `pack_size` change:

```
enqueue embedding job
  → build text blob
  → call OpenAI embeddings API
  → UPDATE supplier_products.embedding
```

Skip embedding job if only price/stock changed.

---

## Admin visibility

Scrape health shown in `/admin/suppliers` and `/admin/jobs`:

- Last successful scrape
- Products count per supplier
- Failed URLs (last 24h)
- Average check duration

---

## Legal / ops

- Confirm scraping approach with stakeholder
- Respect robots.txt where applicable
- Long-term: pursue supplier data feed or partnership
- Rate limit to avoid impacting supplier sites

---

## Phase 0 spike checklist

- [ ] Henry Schein adapter: search "nitrile gloves" → 10 products with price + URL
- [ ] Adam Dental adapter: same query → 10 products
- [ ] Upsert to Supabase `supplier_products`
- [ ] One refresh pass: hash unchanged vs changed
- [ ] One live check on single product ID
