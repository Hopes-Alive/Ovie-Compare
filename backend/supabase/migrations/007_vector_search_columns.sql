-- Wires up native pgvector full-table search for the chat brain.
--
-- search_products_with_filters() already existed (added in 002) but was never
-- called from backend/src — retrieval.ts only reranked whatever the ILIKE
-- filter + FTS queries happened to return, using an in-process cosine
-- calculation. This migration extends the RPC's return shape so it carries
-- everything retrieval.ts needs (variant_label for size/shade grouping,
-- created_at for "isNew" freshness, metadata for login_required detection),
-- adds an HNSW index so `ORDER BY embedding <=> query_embedding` is
-- index-accelerated instead of a full sequential scan, and drops
-- search_products_vector_only (now a strict subset of
-- search_products_with_filters called with all filters NULL).

-- ---------------------------------------------------------------------------
-- 1. HNSW index — pgvector 0.8.0 is installed, HNSW has been supported since
--    0.5.0 and needs no list-count tuning (unlike ivfflat).
--    Building the graph over ~20k 1536-dim vectors exceeds the pooler's
--    default statement_timeout, so raise it for this migration's session.
-- ---------------------------------------------------------------------------
SET statement_timeout = '15min';

CREATE INDEX IF NOT EXISTS supplier_products_embedding_hnsw_idx
  ON public.supplier_products
  USING hnsw (embedding vector_cosine_ops)
  WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- 2. search_products_with_filters — add variant_label / created_at / metadata
--
--    Rewritten from `LANGUAGE sql` to `LANGUAGE plpgsql` with dynamic SQL
--    (EXECUTE ... USING) instead of static `(filter_x IS NULL OR col = filter_x)`
--    predicates. This is required, not stylistic: PostgREST always issues
--    `SET ROLE <target>` before running any query (that's how it switches
--    from the `authenticator` login to `service_role`/`anon`/etc per
--    request). The moment a session has executed `SET ROLE` — to *any*
--    role, even back to the same one — Postgres stops inlining `LANGUAGE
--    sql` functions and instead runs them as an opaque "Function Scan"
--    with a single cached, value-agnostic plan for the internal query.
--    For a query with several `(param IS NULL OR ...)` OR-branches, that
--    generic plan can't fold away the NULL branches at plan time, so it
--    falls back to a full sequential scan + sort of all ~20k rows instead
--    of the HNSW-indexed `ORDER BY embedding <=> query LIMIT n` scan —
--    confirmed via EXPLAIN ANALYZE to take ~13-16s instead of ~0.5-1s.
--    Dynamic SQL sidesteps this: each call builds and plans a fresh query
--    string containing only the WHERE clauses for filters actually
--    supplied, so Postgres always sees a concrete, literal query shape
--    (same class of plan as a hand-written one-off query) regardless of
--    the caller's role-switching history.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS search_products_with_filters(
  vector, text, text, text, text, text, text, numeric, numeric, numeric, int
);

CREATE OR REPLACE FUNCTION search_products_with_filters(
  query_embedding   vector(1536),
  filter_name       text    DEFAULT NULL,
  filter_brand      text    DEFAULT NULL,
  filter_category   text    DEFAULT NULL,
  filter_subcategory text   DEFAULT NULL,
  filter_supplier_slug text DEFAULT NULL,
  filter_stock_status text  DEFAULT NULL,
  filter_price_exact numeric DEFAULT NULL,
  filter_price_min  numeric DEFAULT NULL,
  filter_price_max  numeric DEFAULT NULL,
  result_limit      int     DEFAULT 5
)
RETURNS TABLE (
  id                   uuid,
  supplier_id          uuid,
  supplier_slug        text,
  supplier_name        text,
  external_id          text,
  external_sku         text,
  name                 text,
  brand                text,
  category             text,
  subcategory          text,
  description          text,
  image_src            text,
  pack_size            text,
  variant_label        text,
  unit_of_measure      text,
  price                numeric,
  currency             text,
  price_includes_gst   boolean,
  stock_status         text,
  delivery_text        text,
  delivery_min_days    int,
  delivery_max_days    int,
  last_checked_at      timestamptz,
  last_changed_at      timestamptz,
  created_at           timestamptz,
  supplier_product_url text,
  metadata             jsonb,
  similarity           float
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  where_sql text := 'sp.is_active = true AND sp.embedding IS NOT NULL';
BEGIN
  IF filter_name IS NOT NULL THEN
    where_sql := where_sql || ' AND sp.name ILIKE ' || quote_literal('%' || filter_name || '%');
  END IF;
  IF filter_brand IS NOT NULL THEN
    where_sql := where_sql || ' AND sp.brand ILIKE ' || quote_literal('%' || filter_brand || '%');
  END IF;
  IF filter_category IS NOT NULL THEN
    where_sql := where_sql || ' AND sp.category ILIKE ' || quote_literal('%' || filter_category || '%');
  END IF;
  IF filter_subcategory IS NOT NULL THEN
    where_sql := where_sql || ' AND sp.subcategory ILIKE ' || quote_literal('%' || filter_subcategory || '%');
  END IF;
  IF filter_stock_status IS NOT NULL THEN
    where_sql := where_sql || ' AND sp.stock_status = ' || quote_literal(filter_stock_status);
  END IF;
  IF filter_price_exact IS NOT NULL THEN
    where_sql := where_sql || ' AND sp.price = ' || quote_literal(filter_price_exact::text);
  END IF;
  IF filter_price_min IS NOT NULL THEN
    where_sql := where_sql || ' AND sp.price >= ' || quote_literal(filter_price_min::text);
  END IF;
  IF filter_price_max IS NOT NULL THEN
    where_sql := where_sql || ' AND sp.price <= ' || quote_literal(filter_price_max::text);
  END IF;
  IF filter_supplier_slug IS NOT NULL THEN
    where_sql := where_sql || ' AND s.slug = ' || quote_literal(filter_supplier_slug);
  END IF;

  RETURN QUERY EXECUTE
    'SELECT
       sp.id, sp.supplier_id, s.slug, s.name, sp.external_id, sp.external_sku,
       sp.name, sp.brand, sp.category, sp.subcategory, sp.description, sp.image_src,
       sp.pack_size, sp.variant_label, sp.unit_of_measure, sp.price, sp.currency,
       sp.price_includes_gst, sp.stock_status, sp.delivery_text, sp.delivery_min_days,
       sp.delivery_max_days, sp.last_checked_at, sp.last_changed_at, sp.created_at,
       sp.supplier_product_url, sp.metadata, 1 - (sp.embedding <=> $1) AS similarity
     FROM supplier_products sp
     JOIN suppliers s ON s.id = sp.supplier_id
     WHERE ' || where_sql || '
     ORDER BY sp.embedding <=> $1
     LIMIT $2'
    USING query_embedding, result_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION search_products_with_filters TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Drop the now-fully-redundant pure vector-only function — calling
--    search_products_with_filters with every filter left NULL does the same
--    thing, so keeping both would just be dead code.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS search_products_vector_only(vector, int);
