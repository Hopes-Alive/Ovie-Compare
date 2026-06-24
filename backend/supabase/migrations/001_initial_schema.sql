-- Ovie Compare — initial schema
-- Run once in Supabase Dashboard → SQL Editor

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.supplier_products_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.brand, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'C');
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  base_url text not null,
  adapter_key text not null,
  is_active boolean not null default true,
  scrape_enabled boolean not null default true,
  live_check_enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  rate_limit_rpm integer not null default 30,
  default_priority text not null default 'normal'
    check (default_priority in ('high', 'normal', 'low')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Supplier products
-- ---------------------------------------------------------------------------
create table public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  external_id text,
  external_sku text,
  supplier_product_url text not null,        -- canonical URL on supplier site
  name text not null,
  brand text,
  category text,
  subcategory text,
  description text,
  image_src text,                            -- comma-separated image URLs (first is primary)
  pack_size text,
  unit_of_measure text,
  price numeric(12, 2),
  currency text not null default 'AUD',
  price_includes_gst boolean not null default true,
  stock_status text
    check (stock_status in ('in_stock', 'out_of_stock', 'low_stock', 'unknown')),
  stock_quantity integer,
  delivery_text text,
  delivery_min_days integer,
  delivery_max_days integer,
  content_hash text not null default '',
  search_vector tsvector,
  embedding extensions.vector(1536),
  scrape_priority text not null default 'normal'
    check (scrape_priority in ('high', 'normal', 'low')),
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  last_seen_at timestamptz,
  is_active boolean not null default true,
  raw_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, supplier_product_url)
);

create unique index supplier_products_supplier_external_id_idx
  on public.supplier_products (supplier_id, external_id)
  where external_id is not null;

create index supplier_products_supplier_active_idx
  on public.supplier_products (supplier_id, is_active);

create index supplier_products_price_idx
  on public.supplier_products (price)
  where is_active = true;

create index supplier_products_last_checked_idx
  on public.supplier_products (last_checked_at);

create index supplier_products_priority_checked_idx
  on public.supplier_products (scrape_priority, last_checked_at);

create index supplier_products_search_vector_idx
  on public.supplier_products using gin (search_vector);

create index supplier_products_name_trgm_idx
  on public.supplier_products using gin (name gin_trgm_ops);

create trigger supplier_products_set_updated_at
  before update on public.supplier_products
  for each row execute function public.set_updated_at();

create trigger supplier_products_search_vector_trigger
  before insert or update of name, brand, category, description
  on public.supplier_products
  for each row execute function public.supplier_products_search_vector_update();

-- ---------------------------------------------------------------------------
-- Price history
-- ---------------------------------------------------------------------------
create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  supplier_product_id uuid not null
    references public.supplier_products(id) on delete cascade,
  old_price numeric(12, 2),
  new_price numeric(12, 2),
  changed_at timestamptz not null default now(),
  source text not null
    check (source in ('scheduled', 'live_check', 'manual')),
  scrape_job_id uuid,
  live_check_job_id uuid
);

create index price_history_product_changed_idx
  on public.price_history (supplier_product_id, changed_at desc);

-- ---------------------------------------------------------------------------
-- Scrape jobs
-- ---------------------------------------------------------------------------
create table public.scrape_jobs (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  job_type text not null
    check (job_type in ('full_seed', 'category_seed', 'refresh', 'search_seed')),
  status text not null
    check (status in ('queued', 'running', 'success', 'failed', 'partial')),
  triggered_by text not null default 'system',
  category text,
  query text,
  stats jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.scrape_job_items (
  id uuid primary key default gen_random_uuid(),
  scrape_job_id uuid not null references public.scrape_jobs(id) on delete cascade,
  supplier_product_id uuid references public.supplier_products(id) on delete set null,
  url text not null,
  status text not null check (status in ('success', 'failed', 'skipped')),
  action text check (action in ('created', 'updated', 'unchanged', 'deactivated')),
  error_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Live check jobs
-- ---------------------------------------------------------------------------
create table public.live_check_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null
    check (status in ('queued', 'running', 'success', 'failed', 'partial')),
  requested_by text,
  result_summary jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.live_check_job_items (
  id uuid primary key default gen_random_uuid(),
  live_check_job_id uuid not null
    references public.live_check_jobs(id) on delete cascade,
  supplier_product_id uuid not null
    references public.supplier_products(id) on delete cascade,
  status text not null check (status in ('success', 'failed', 'skipped')),
  old_price numeric(12, 2),
  new_price numeric(12, 2),
  old_stock_status text,
  new_stock_status text,
  changed boolean not null default false,
  error_message text,
  duration_ms integer,
  checked_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Canonical products (cross-supplier matching — populate later)
-- ---------------------------------------------------------------------------
create table public.canonical_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text,
  brand text,
  category text,
  pack_size text,
  unit_of_measure text,
  gtin text,
  search_vector tsvector,
  embedding extensions.vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.canonical_product_matches (
  id uuid primary key default gen_random_uuid(),
  canonical_product_id uuid not null
    references public.canonical_products(id) on delete cascade,
  supplier_product_id uuid not null unique
    references public.supplier_products(id) on delete cascade,
  match_method text not null
    check (match_method in ('manual', 'fuzzy', 'embedding', 'rules')),
  match_confidence numeric(4, 3),
  is_verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Chat & analytics
-- ---------------------------------------------------------------------------
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token text not null unique,
  context jsonb not null default '{}'::jsonb,
  clinic_id uuid,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  tool_calls jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.search_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.chat_sessions(id) on delete set null,
  query text not null,
  supplier_ids uuid[],
  result_count integer,
  latency_ms integer,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.suppliers enable row level security;
alter table public.supplier_products enable row level security;
alter table public.price_history enable row level security;
alter table public.scrape_jobs enable row level security;
alter table public.scrape_job_items enable row level security;
alter table public.live_check_jobs enable row level security;
alter table public.live_check_job_items enable row level security;
alter table public.canonical_products enable row level security;
alter table public.canonical_product_matches enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.search_events enable row level security;

-- Public read: active suppliers and products (chat / landing)
create policy "Public read active suppliers"
  on public.suppliers for select
  using (is_active = true);

create policy "Public read active supplier products"
  on public.supplier_products for select
  using (is_active = true);

-- ---------------------------------------------------------------------------
-- Grants — expose tables to PostgREST roles
-- ---------------------------------------------------------------------------
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, service_role;
grant select on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to postgres, service_role;
alter default privileges in schema public grant all on tables to postgres, service_role;
alter default privileges in schema public grant select on tables to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed MVP suppliers
-- ---------------------------------------------------------------------------
insert into public.suppliers (slug, name, base_url, adapter_key, config) values
  (
    'henry-schein',
    'Henry Schein Australia',
    'https://www.henryschein.com.au',
    'henry_schein',
    '{
      "search_url_template": "https://www.henryschein.com.au/search?searchTerm={query}",
      "approved_domains": ["www.henryschein.com.au", "henryschein.com.au"],
      "currency": "AUD",
      "gst_mode": "inc_gst"
    }'::jsonb
  ),
  (
    'adam-dental',
    'Adam Dental',
    'https://www.adamdental.com.au',
    'adam_dental',
    '{
      "search_url_template": "https://www.adamdental.com.au/search?ProductSearch={query}",
      "approved_domains": ["www.adamdental.com.au", "adamdental.com.au"],
      "currency": "AUD",
      "gst_mode": "inc_gst"
    }'::jsonb
  );
