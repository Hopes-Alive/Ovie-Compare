# Database schema (Supabase / Postgres)

Multi-supplier design from day one. MVP can start with core tables; optional tables can exist empty.

## Entity relationship (simplified)

```
suppliers
  └── supplier_products
        ├── price_history
        ├── stock_history (optional)
        └── canonical_product_matches → canonical_products

scrape_jobs → scrape_job_items
live_check_jobs → live_check_job_items

chat_sessions → chat_messages
search_events
```

---

## Core tables

### `suppliers`

Operational config per data source. Admin UI reads this.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| slug | text UNIQUE | `henry-schein`, `adam-dental` |
| name | text | Display name |
| base_url | text | |
| adapter_key | text | Maps to code module |
| is_active | boolean | Toggle in admin |
| scrape_enabled | boolean | |
| live_check_enabled | boolean | |
| config | jsonb | URL templates, domains, GST mode |
| rate_limit_rpm | int | Default 30 |
| default_priority | text | high \| normal \| low |
| created_at, updated_at | timestamptz | |

**Example `config`:**
```json
{
  "search_url_template": "https://www.henryschein.com.au/search?searchTerm={query}",
  "approved_domains": ["www.henryschein.com.au"],
  "currency": "AUD",
  "gst_mode": "inc_gst"
}
```

---

### `supplier_products`

One row per product per supplier. Main table for search and chat.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| supplier_id | uuid FK | |
| external_id | text | Supplier SKU/id |
| external_sku | text | |
| supplier_product_url | text UNIQUE per supplier | |
| name | text | |
| brand | text | |
| category | text | MVP: text; later FK to categories |
| subcategory | text | |
| description | text | |
| image_src | text | Comma-separated image URLs; first is primary |
| pack_size | text | e.g. "100 pack" |
| variant_label | text | nullable; option label (e.g. "Extra Small") for a row expanded from a configurable product's variant table — see `scraping.md` § Variant products |
| unit_of_measure | text | |
| price | numeric(12,2) | |
| currency | text | AUD |
| price_includes_gst | boolean | |
| stock_status | text | in_stock \| out_of_stock \| low_stock \| unknown |
| stock_quantity | int | nullable |
| delivery_text | text | |
| delivery_min_days | int | nullable |
| delivery_max_days | int | nullable |
| content_hash | text | For change detection |
| search_vector | tsvector | FTS |
| embedding | vector(1536) | Semantic search; re-embed on text change only |
| scrape_priority | text | high \| normal \| low |
| last_checked_at | timestamptz | |
| last_changed_at | timestamptz | |
| last_seen_at | timestamptz | |
| is_active | boolean | Soft delete if 404 |
| raw_snapshot | jsonb | Last parse for debugging |
| metadata | jsonb | |
| created_at, updated_at | timestamptz | |

**Unique:** `(supplier_id, external_id)` when id exists; `(supplier_id, supplier_product_url)`

**Indexes:**
- `(supplier_id, is_active)`
- `(price)` WHERE is_active
- `(last_checked_at)`
- `(scrape_priority, last_checked_at)`
- GIN on `search_vector`
- `supplier_products_embedding_hnsw_idx`: HNSW (`vector_cosine_ops`) on `embedding` WHERE `is_active = true` (migration `007_vector_search_columns.sql`) — powers the native pgvector retrieval arm, see below

**Embedding rule:** embed `name + brand + category + pack_size + description`. Do NOT re-embed on price/stock-only updates.

**Search RPC:** `search_products_with_filters(query_embedding, filter_name, filter_brand, filter_category, filter_subcategory, filter_supplier_slug, filter_stock_status, filter_price_exact, filter_price_min, filter_price_max, result_limit)` — defined in `backend/supabase/migrations/002_brain_search_functions.sql`, extended in `007_vector_search_columns.sql` (added `variant_label`/`created_at`/`metadata` to the return shape). Called from `backend/src/services/brain/retrieval.ts`'s `runVectorSearch()` as the third, independent full-table retrieval arm (see `retrieval-chat.md`) — always called with only the "hard" filters (`filter_supplier_slug`/`filter_stock_status`/`filter_price_*`) populated, the guessable ones left `NULL`. `LANGUAGE plpgsql` with dynamic SQL, not `LANGUAGE sql` — required so PostgREST's per-request `SET ROLE` doesn't force a slow, non-indexed generic query plan (see `retrieval-chat.md` for the full explanation). The old `search_products_vector_only` (a strict subset of this function called with all filters NULL) was dropped in `007_vector_search_columns.sql` as redundant.

---

### `price_history`

| Column | Type |
|--------|------|
| id | uuid PK |
| supplier_product_id | uuid FK |
| old_price | numeric |
| new_price | numeric |
| changed_at | timestamptz |
| source | text | scheduled \| live_check \| manual |
| scrape_job_id | uuid nullable |
| live_check_job_id | uuid nullable |

---

## Jobs & observability

### `scrape_jobs`

| Column | Type |
|--------|------|
| id | uuid PK |
| supplier_id | uuid FK |
| job_type | text | full_seed \| category_seed \| refresh \| search_seed |
| status | text | queued \| running \| success \| failed \| partial |
| triggered_by | text | scheduler \| admin \| system |
| category, query | text | optional scope |
| stats | jsonb | `{ found, updated, failed, unchanged }` |
| error_message | text |
| started_at, finished_at | timestamptz |

### `scrape_job_items`

Per-URL result within a job (admin debugging).

### `live_check_jobs` / `live_check_job_items`

User-triggered checks; store old/new price/stock per product.

---

## Cross-supplier matching (schema now, populate later)

### `canonical_products`

Normalized product concept for true comparison.

### `canonical_product_matches`

Links `supplier_product_id` → `canonical_product_id` with `match_confidence`, `is_verified`.

MVP: table exists; manual matching for top products OK.

---

## Chat & analytics

### `chat_sessions`

| Column | Type |
|--------|------|
| id | uuid PK |
| session_token | text UNIQUE |
| context | jsonb | `{ last_product_ids, last_query }` |
| clinic_id | uuid nullable | future |
| created_at, last_active_at | timestamptz |

### `chat_messages`

role, content, tool_calls, metadata

### `search_events`

query, supplier_ids, result_count, latency_ms — powers analytics tab

---

## Seed data (MVP)

```sql
INSERT INTO suppliers (slug, name, base_url, adapter_key, config) VALUES
  ('henry-schein', 'Henry Schein Australia', 'https://www.henryschein.com.au', 'henry_schein', '{...}'),
  ('adam-dental', 'Adam Dental', 'https://www.adamdental.com.au', 'adam_dental', '{...}');
```

---

## RLS (plan ahead)

| Table | MVP access |
|-------|------------|
| suppliers, supplier_products | Public read for chat (or via API only) |
| jobs, admin tables | Service role / admin auth only |
| clinics | RLS per clinic_id when added |

Workers use **service role**. Frontend chat goes through API, not direct DB writes.

---

## Migrations folder (planned)

```
backend/supabase/migrations/
  001_suppliers.sql
  002_supplier_products.sql
  003_price_history.sql
  004_jobs.sql
  005_chat_analytics.sql
  006_canonical_products.sql
  007_indexes_fts_vector.sql
```
