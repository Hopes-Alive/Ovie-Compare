-- Distinguishes sibling rows of the same configurable product (e.g. size/shade)
-- that were expanded from a single PDP's variant options table. NULL for
-- ordinary single-SKU products.
ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS variant_label text;

COMMENT ON COLUMN public.supplier_products.variant_label IS
  'Option label (e.g. size/shade) for a row expanded from a configurable product''s variant table. NULL for ordinary single-SKU products.';
