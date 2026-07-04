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
- Public prices on search (verified) — but **not guaranteed on every PDP**:
  some product pages (seen on equipment/accessories, e.g. 3D printing) render
  a "Login to buy" CTA instead of a price for anonymous visitors, while
  `window.products.PriceForOneInc`/`PriceForOneEx` in the page's JS state
  still carries a real-looking numeric string (e.g. `"$231.00"`). The
  structured JSON does **not** reliably signal this the way it does for
  `"Call us!"` values — only the rendered DOM does. See "Login wall via DOM"
  below.
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
- **Exception — confirmed login wall:** a missing price from a flaky/partial
  parse never clears the existing price (see rule above). But when the parser
  *positively* detects a login wall (`raw.login_required = true` — e.g. "Login
  to buy" / "Call us!" text, not just an absent field), the old price **is**
  cleared to `null` and a `price_history` row is appended (`new_price: null`).
  Otherwise a product that permanently becomes login-gated would keep serving
  a stale, un-groundable price to chat forever. `metadata.login_required` is
  also selected by chat retrieval so the answer LLM can say "requires supplier
  login" instead of inventing/repeating a number.

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
3. If row isn't already a split variant, try variant discovery first
   (see "On-the-fly discovery during live check / AI read" below) —
   short-circuits the rest of this list on success
4. Playwright open URL (timeout 60s)
5. parseProductPage
6. Compare with DB row
7. Update DB + price_history
8. Return { old, new, changed } to client via SSE
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
  already found — **except price**: `extractPdpDomFields` also scans short
  leaf-text elements for a "Login to buy" / "Call for price" CTA
  (`loginToBuyDetected`). When present, `mergeDomFields` **always** strips
  `price`/`priceExGst` and forces `raw.login_required = true`, even if
  `window.products` contained a number — the DOM is ground truth for what an
  anonymous visitor actually sees, and enterprise SAP Commerce PDPs have been
  observed leaving a real numeric price in the JS state while the template
  hides it behind this CTA. The same DOM signal (`snapshot.loginHint`) also
  overrides a "valid" structured price in the AI-read validation step
  (`validate-extraction.ts`).

---

## Product variants (configurable products)

Some PDPs (e.g. Adam Dental's Saniflex gloves, Coltene composite caps) render a
**variant options table** — one `.data-list-item` row per SKU (size/shade/pack),
each with its own price and stock badge, instead of one price for the whole page.
These are stored as **one `supplier_products` row per variant**, not one row for
the whole configurable product:

```
supplier_products
  id            (unique per variant)
  external_id / sku   (variant-specific SKU)
  supplier_product_url  base PDP URL + `?ProductCode={sku}` (see below)
  variant_label text    e.g. "Small", "A2/B2" — NULL for ordinary single-SKU products
  price, stock_status   per-variant values
```

### Extraction (`extractPdpDomFields`)

`extractPdpDomFields()` (`backend/src/lib/extract-pdp-dom-fields.ts`) walks every
non-heading `.data-list-item` row on the PDP and returns `variantRows: VariantRow[]`
(sku, optionLabel, price, availability) alongside the existing single-product DOM
fields. `cleanVariantPriceText` rejects non-numeric cells ("Call us!") so those rows
correctly parse to `price: null` rather than `0`/`NaN`.

### Giving each variant a unique URL

Because the DB uniqueness constraint is `(supplier_id, supplier_product_url)` /
`(supplier_id, external_id)`, every variant needs its own URL even though they
share one physical PDP. `withProductCodeParam()`
(`backend/src/scrapers/parse-product-helpers.ts`) appends `?ProductCode={sku}` to
the shared PDP URL — the same convention Henry Schein already used as a
category-fallback product URL. `extractProductCodeFromUrl()` reverses this to
recover the `skuHint` when re-visiting a specific variant's URL (Pass B, live
check, AI read). **This is a legitimate direct-product-page URL for any
supplier** — `isBadProductUrl()` (`backend/src/services/live-check/validate-products.ts`)
must not block `?ProductCode=` in general, only real `/search?` listing pages.

### Where variants are discovered/expanded

- **`expandProductVariants(detail, domFields)`** (`parse-product-helpers.ts`) —
  given a parsed parent `ProductDetail` and the PDP's `variantRows`, returns one
  synthetic `ProductDetail` per variant (unique URL/SKU/label/price/stock). Used
  by:
  - **`enrichProductsWithPdpFields`** (`enrich-listing-products.ts`) — the
    opt-in PDP-visit enrichment step during bulk scrape/seed. This is the
    primary place new variants get discovered: visiting a listing's PDP once
    can turn 1 input product into N output rows.
  - **`repair-variant-parents.ts`** (one-off backfill script) — re-visits
    existing `is_active` rows with `variant_label IS NULL`; if the PDP now
    shows >1 variant row, expands them and marks the old parent row
    `is_active = false` with `metadata.superseded_by_variants = true`.
- **`buildVariantMatch(pageProducts, domFields, skuHint)`** (`parse-product-helpers.ts`)
  — for Pass B / live check / AI read, where the request targets one specific
  variant SKU that isn't itself a key in `window.products` (only the parent
  SKU is). Builds a one-off `ProductDetail` for that SKU by combining the
  parent product's shared fields (name, description, image) with that variant
  row's price/stock/label from `domFields.variantRows`. Wired into both
  adapters' `parseProductPage` as the fallback when `pickProductMatch` returns
  no match for the hinted SKU.

### On-the-fly discovery during live check / AI read

The bulk scrape's PDP enrichment (`enrichProductsWithPdpFields`) is opt-in, so
most products are still stored as an un-expanded single row
(`variant_label IS NULL`) even when their PDP has a variant table. Rather than
only fixing this via the `repair-variant-parents.ts` backfill, **live check**
and **AI product read** both call `discoverAndExpandVariants()`
(`backend/src/services/live-check/expand-variants.ts`) for any checked row
that isn't already a split variant:

1. Re-visit the row's PDP and read `extractPdpDomFields().variantRows`.
2. If there's only 0–1 rows, fall through to the normal single-product
   parse/upsert flow (adapter `parseProductPage` or the AI snapshot/LLM path)
   — unchanged behaviour for ordinary products.
3. If there are 2+ rows, expand via `expandProductVariants`, `upsertProducts`
   the new rows, and retire the original parent row (`is_active: false`,
   `metadata.superseded_by_variants: true`) — same pattern as the backfill
   script.
4. The SSE `result` event carries the new `variants[]` (with real DB ids) and
   a `representativeProductId`, so the already-open chat card can switch into
   dropdown mode immediately — no re-search or page reload needed.

This adds one extra PDP navigation to every check of an un-expanded row
(a few seconds), which is an accepted cost for a user-triggered, single-item
action. Rows that are already a split variant (`variant_label` set) skip this
step entirely.

### Retrieval: grouping siblings back into one card

`attachVariantSiblings()` (`backend/src/services/brain/retrieval.ts`) runs after
each retrieval path (structured/FTS/vector) and before the result limit is
applied: it groups rows sharing `(supplier_id, name)` with a non-null
`variant_label`, fetches **all** sibling rows for that family, attaches them as
a `variants[]` array on the single highest-ranked row, and drops the rest from
the result list — so chat shows **one card per configurable product**, not one
per SKU. The LLM prompt (`brain-conversation.ts`) receives the full `variants`
list (option/price/stock per variant) and is told never to average variant
prices — always answer per-option. The frontend product card
(`frontend/src/components/chat/product-card.tsx`) renders these as a
size/shade `<Select>` dropdown; choosing an option swaps the card's displayed
price/stock/URL and which row Live Check / AI Read act on.

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
| Login wall via DOM (see below) | `extractPdpDomFields` price/`login_required` override wins over structured JSON |
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
