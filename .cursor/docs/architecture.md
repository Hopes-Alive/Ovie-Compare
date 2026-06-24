# System architecture

## High-level diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
│  /              Landing — QR, URL, open chat                     │
│  /chat          Chat + product cards + live check button         │
│  /admin/*       Suppliers, analytics, jobs, architecture       │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / SSE
┌────────────────────────────▼────────────────────────────────────┐
│                         API LAYER                                │
│  POST /chat              LLM orchestration + tools               │
│  GET  /search            Direct product search                   │
│  POST /live-check        Enqueue live scrape                     │
│  GET  /live-check/:id/stream   SSE progress                      │
│  GET  /admin/*           Supplier status, jobs, analytics        │
└─────┬──────────────────┬──────────────────┬───────────────────┘
      │                  │                  │
      ▼                  ▼                  ▼
┌───────────┐    ┌───────────────┐    ┌─────────────────┐
│ Supabase  │    │ Redis/BullMQ  │    │ LLM provider    │
│ Postgres  │    │ job queues    │    │ (tool calling)  │
└─────▲─────┘    └───────┬───────┘    └─────────────────┘
      │                  │
      │                  ▼
      │          ┌───────────────────┐
      └──────────│ WORKERS            │
                 │ - seed scraper     │
                 │ - refresh checker  │
                 │ - live-check       │
                 │ - embedding sync   │
                 └─────────┬─────────┘
                           │ Playwright (whitelisted URLs only)
                           ▼
                 ┌───────────────────┐
                 │ Henry Schein      │
                 │ Adam Dental       │
                 └───────────────────┘
```

## Service boundaries

| Component | Runs where | Responsibility |
|-----------|------------|----------------|
| **Web** | Vercel / similar | UI only |
| **API** | Node server | Auth, chat, search, enqueue jobs |
| **Workers** | Railway / Fly / separate process | Playwright, long jobs |
| **Supabase** | Hosted | Data, optional auth later |
| **Redis** | Upstash / self-hosted | BullMQ queues |

**Rule:** Playwright never runs inside API request handlers.

## Data flow: scheduled scrape

```
Cron (every 6h)
  → enqueue refresh job per supplier (or per priority batch)
  → worker loads supplier_products where due for check
  → for each product URL:
      fetch page → parse → compute content_hash
      if unchanged → update last_checked_at only
      if changed → update fields, last_changed_at, price_history
  → write scrape_job + scrape_job_items for admin
```

## Data flow: user chat

```
User message + session history
  → query rewriter (standalone question from context)
  → planner LLM → intent + tool call (searchProducts, etc.)
  → retrieval service (structured + FTS + vector, merge)
  → answer LLM with grounded product JSON
  → UI renders text + cards + actions
```

## Data flow: live check

```
User clicks [Check live price]
  → POST /live-check { productIds }
  → create live_check_job
  → worker: for each product, open supplier_product_url (domain whitelist)
  → parse current price/stock
  → compare with DB, update if changed
  → SSE events to client
  → UI shows diff + "updated just now"
```

## Supplier adapter pattern

Each supplier = one adapter in codebase + one row in `suppliers` table.

```
backend/src/scrapers/
  base-adapter.ts
  henry-schein/
    adapter.ts
    selectors.ts
    parser.ts
  adam-dental/
    adapter.ts
    selectors.ts
    parser.ts
```

```ts
interface SupplierAdapter {
  slug: string
  approvedDomains: string[]
  buildSearchUrl(query: string): string
  parseSearchResults(html: string): ProductListing[]
  parseProductPage(html: string): ProductDetail
  buildContentHash(detail: ProductDetail): string
}
```

**Adding supplier #3:** new folder + DB row + enable in admin. Not auto-generated from URL.

## What lives in DB vs code

| Database | Codebase |
|----------|----------|
| Supplier name, URL, active flags | HTML parsers, selectors |
| `config` JSON (search URL template, domains) | Playwright navigation logic |
| Products, prices, embeddings | Hash algorithm, field extraction |
| Jobs, errors, analytics | Queue workers, rate limits |

## Security

- Live check: only URLs from `supplier_products` matching `approved_domains`
- Admin routes: auth required (even MVP — simple password or Supabase auth)
- LLM: no raw SQL; typed tools only
- Workers: Supabase service role key

## Scalability notes

- **More suppliers:** new adapter + rows, same tables
- **More products:** indexes on `supplier_id`, `search_vector`, `last_checked_at`
- **Priority refresh:** `scrape_priority` on product rows
- **History:** partition `price_history` by month if it grows huge (later)

## Known risks

| Risk | Mitigation |
|------|------------|
| Site HTML changes | Per-supplier adapter, `raw_snapshot` for debug |
| Bot blocking | Rate limits, concurrency caps |
| Login-gated prices later | Flag in parser, skip or show "login required" |
| Cross-supplier mismatch | Canonical products table (v1.1), pack-size warnings in UI |
