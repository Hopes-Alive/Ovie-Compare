import { supabase } from "../../lib/supabase.js";
import type { LiveCheckProductRow } from "./types.js";

const PRODUCT_SELECT =
  "id, name, external_id, external_sku, supplier_product_url, price, stock_status, stock_quantity, brand, category, subcategory, description, image_src, pack_size, unit_of_measure, currency, price_includes_gst, delivery_text, delivery_min_days, delivery_max_days, variant_label, metadata, supplier_id, suppliers!inner(id, slug, name, adapter_key, live_check_enabled, is_active)";

export async function loadProducts(productIds: string[]): Promise<LiveCheckProductRow[]> {
  const { data, error } = await supabase
    .from("supplier_products")
    .select(PRODUCT_SELECT)
    .in("id", productIds)
    .eq("is_active", true)
    .eq("suppliers.is_active", true);

  if (error) {
    throw new Error(`Failed to load products: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const suppliers = row.suppliers as unknown as LiveCheckProductRow["suppliers"];
    return { ...row, suppliers } as LiveCheckProductRow;
  });
}
