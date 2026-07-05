-- Adds trigram (pg_trgm) GIN indexes on brand/category/subcategory, matching the
-- existing supplier_products_name_trgm_idx (001_initial_schema.sql). The planner's
-- searchProducts filters ILIKE-match all four columns (see applyColumnFilters in
-- backend/src/services/brain/retrieval.ts), but only `name` had trigram support —
-- brand/category/subcategory ILIKE filters were falling back to sequential scans.
-- Pure index addition: no query logic, filter behavior, or result ranking changes.

CREATE INDEX IF NOT EXISTS supplier_products_brand_trgm_idx
  ON public.supplier_products USING gin (brand gin_trgm_ops);

CREATE INDEX IF NOT EXISTS supplier_products_category_trgm_idx
  ON public.supplier_products USING gin (category gin_trgm_ops);

CREATE INDEX IF NOT EXISTS supplier_products_subcategory_trgm_idx
  ON public.supplier_products USING gin (subcategory gin_trgm_ops);
