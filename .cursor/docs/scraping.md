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
- **Same platform as Henry Schein** — `window.products` injection with identical fields
- Prices: `window.products.PriceForOneInc` shows "Call us!" for logged-out users, but `data-product-data` attribute on each card has `NettPriceFromFirstInc` / `NettPriceFromFirstEx` with the real public price
- APHRA-restricted products: `NettPriceFromFirstInc` will also be "Call us!" → parser sets `metadata.login_required = true` and stores the product without a price
- Pagination: "Show More Products" AJAX button (`button.cv-refresh`), no URL-based pages
- 460 leaf categories discovered (stored in `data/adam-dental-categories.json`)

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

## Scheduled refresh flow (implemented)

Admin-configurable interval per supplier (`suppliers.refresh_interval_minutes`, default 6h).

```
refresh-scheduler (every 60s)
  → if supplier due AND no active scrape job (refresh OR seed):
       refresh-worker
         Pass A: re-crawl all discovered categories (data/*-categories.json)
           → upsertProducts (created / updated / unchanged + price_history)
         Pass B: per-URL check for products missed in Pass A
           → parseProductPage → upsertProducts
         → update last_scheduled_refresh_at (success, cancel, or failure)
```

Resume: `data/{supplier}-refresh-progress.json` tracks completed categories within a cycle.

The admin **manual "Run scrape now"** button and the **scheduler** share this same
engine (`runSuppliersRefreshParallel` in `refresh-runner.ts`) — the only
difference is `triggered_by` (`admin` vs `scheduler`). Both check
`hasActiveScrapeJob(supplierId)` (`scrape-job.ts`) before starting a supplier,
which is true while **either** a `refresh` job **or** a one-off seed script
(`category_seed`/`full_seed`/`search_seed`, e.g. `npm run seed:*`) is running
for that supplier — seed scripts use their own Playwright browser and don't
honour `cancel_requested`, so this guard stops admin refresh from racing them
and double-hitting the supplier site / interleaving writes.

### Non-destructive updates (chat-safe)

Scheduled scrapes **never delete or bulk-replace** product data. Each row is handled independently:

| Scrape result | DB action |
|---------------|-----------|
| New URL | `INSERT` one row |
| Hash changed | `UPDATE` that row only — patch includes **changed fields only** |
| Unchanged | Touch `last_checked_at` / `last_seen_at` only |
| Not seen this cycle | **No write** — row left as-is |

Rules that protect active chat:

- Scraper runs in a **separate worker process**, not inside the chat API.
- Postgres row-level updates — reads (chat retrieval) continue without blocking.
- Enriched fields (`description`, `brand`, `image_src`) are **not overwritten with null** when the listing scrape omits them.
- `metadata` is **merged**, not replaced.
- Products missing from a category crawl are **not** deactivated or deleted.
- `price_history` only **appends** rows when price changes.

Manual run:

```bash
npm run refresh
npm run refresh -- --supplier adam-dental --force
npm run dev:scheduler
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

### `parseProductPage` DOM enrichment (single-URL parse only)

`parseProductPage` (used by live check, the AI-read fallback, and repair
scripts — **not** the bulk category listing scrape) also calls
`extractPdpDomFields()` (`backend/src/lib/extract-pdp-dom-fields.ts`) once,
right after the first canonical-URL navigation, and merges the result via
`mergeDomFields()` (`backend/src/scrapers/parse-product-helpers.ts`). This
fills gaps the `window.products` / `data-product-data` parse can't see:

- `description` / `brand` — from `.widget-product-field-ProductDescription` /
  `.widget-product-field-CUS_BrandText`.
- A higher-confidence `imageSrc` — rejects generic placeholder/logo images.
- A real `stockStatus` for **login-required / APHRA-restricted products**,
  where `AvailableQty` is never exposed and the structured parse alone can
  only return `unknown` forever. The DOM shows a `.cart-product-availability`
  badge instead.
  - Some PDPs render a **variant options table** (size/shade/pack-size rows,
    each with its own `.cart-product-availability`). The badge is only
    trusted when it's scoped to a row whose product-code cell matches our
    `externalSku`, or when exactly one badge exists on the page. Otherwise
    the result stays `unknown` — **never guess** a sibling variant's stock.
- Merge is additive only: it never overwrites a value the structured parser
  already found.

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
  refresh-worker.ts
  refresh-scheduler.ts
  enrich-product-details.ts
  embedding-worker.ts   # re-embed when text fields change
  live-check-worker.ts  # (planned)
```

Scheduler: `refresh-scheduler.ts` (no Redis required for MVP). BullMQ optional for scale later.

| Queue / process | Purpose |
|-----------------|--------|
| refresh-scheduler | Checks supplier intervals, spawns refresh |
| scrape-seed | Initial category ingest (scripts) |
| scrape-refresh | Scheduled updates (refresh-worker) |
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
