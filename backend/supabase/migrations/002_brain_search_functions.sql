-- Brain search RPC functions for the chat pipeline.
-- These are called by backend/src/services/brain/retrieval.ts.
-- Both return full product rows joined with supplier info.

-- ---------------------------------------------------------------------------
-- 1. Filtered + vector-sorted search
--    Applies text/numeric filters then orders by embedding similarity.
-- ---------------------------------------------------------------------------
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
  supplier_product_url text,
  similarity           float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    sp.id,
    sp.supplier_id,
    s.slug             AS supplier_slug,
    s.name             AS supplier_name,
    sp.external_id,
    sp.external_sku,
    sp.name,
    sp.brand,
    sp.category,
    sp.subcategory,
    sp.description,
    sp.image_src,
    sp.pack_size,
    sp.unit_of_measure,
    sp.price,
    sp.currency,
    sp.price_includes_gst,
    sp.stock_status,
    sp.delivery_text,
    sp.delivery_min_days,
    sp.delivery_max_days,
    sp.last_checked_at,
    sp.last_changed_at,
    sp.supplier_product_url,
    1 - (sp.embedding <=> query_embedding) AS similarity
  FROM supplier_products sp
  JOIN suppliers s ON s.id = sp.supplier_id
  WHERE sp.is_active = true
    AND sp.embedding IS NOT NULL
    AND (filter_name       IS NULL OR sp.name        ILIKE '%' || filter_name       || '%')
    AND (filter_brand      IS NULL OR sp.brand       ILIKE '%' || filter_brand      || '%')
    AND (filter_category   IS NULL OR sp.category    ILIKE '%' || filter_category   || '%')
    AND (filter_subcategory IS NULL OR sp.subcategory ILIKE '%' || filter_subcategory || '%')
    AND (filter_stock_status IS NULL OR sp.stock_status = filter_stock_status)
    AND (filter_price_exact IS NULL OR sp.price = filter_price_exact)
    AND (filter_price_min  IS NULL OR sp.price >= filter_price_min)
    AND (filter_price_max  IS NULL OR sp.price <= filter_price_max)
    AND (
      filter_supplier_slug IS NULL
      OR s.slug = filter_supplier_slug
    )
  ORDER BY sp.embedding <=> query_embedding
  LIMIT result_limit;
$$;

-- ---------------------------------------------------------------------------
-- 2. Pure vector search (fallback — no filters)
--    Used when filtered search returns 0 rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_products_vector_only(
  query_embedding vector(1536),
  result_limit    int DEFAULT 5
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
  supplier_product_url text,
  similarity           float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    sp.id,
    sp.supplier_id,
    s.slug             AS supplier_slug,
    s.name             AS supplier_name,
    sp.external_id,
    sp.external_sku,
    sp.name,
    sp.brand,
    sp.category,
    sp.subcategory,
    sp.description,
    sp.image_src,
    sp.pack_size,
    sp.unit_of_measure,
    sp.price,
    sp.currency,
    sp.price_includes_gst,
    sp.stock_status,
    sp.delivery_text,
    sp.delivery_min_days,
    sp.delivery_max_days,
    sp.last_checked_at,
    sp.last_changed_at,
    sp.supplier_product_url,
    1 - (sp.embedding <=> query_embedding) AS similarity
  FROM supplier_products sp
  JOIN suppliers s ON s.id = sp.supplier_id
  WHERE sp.is_active = true
    AND sp.embedding IS NOT NULL
  ORDER BY sp.embedding <=> query_embedding
  LIMIT result_limit;
$$;

-- Grant execute to service role (backend workers + API)
GRANT EXECUTE ON FUNCTION search_products_with_filters TO service_role;
GRANT EXECUTE ON FUNCTION search_products_vector_only TO service_role;
