import { supabase } from "../../lib/supabase.js";
import type { LiveCheckProductRow } from "./types.js";

const PRODUCT_SELECT =
  "id, name, external_sku, supplier_product_url, price, stock_status, brand, pack_size, supplier_id, suppliers!inner(id, slug, name, adapter_key, live_check_enabled, is_active)";

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
