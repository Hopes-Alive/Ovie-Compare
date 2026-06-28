/**
 * List supplier products with missing prices for audit / re-scrape.
 */
import "dotenv/config";
import { supabase } from "../lib/supabase.js";

const supplierSlug = process.argv.find((a) => a.startsWith("--supplier="))?.split("=")[1]
  ?? (process.argv.includes("--supplier") ? process.argv[process.argv.indexOf("--supplier") + 1] : null)
  ?? "adam-dental";

const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "30");

const { data: supplier } = await supabase
  .from("suppliers")
  .select("id, slug, name")
  .eq("slug", supplierSlug)
  .single();

if (!supplier) throw new Error(`Supplier ${supplierSlug} not found`);

const { data: rows, error } = await supabase
  .from("supplier_products")
  .select("id, name, external_sku, price, supplier_product_url, metadata, last_checked_at")
  .eq("supplier_id", supplier.id)
  .eq("is_active", true)
  .is("price", null)
  .order("last_checked_at", { ascending: false, nullsFirst: false })
  .limit(limit);

if (error) throw error;

console.log(JSON.stringify({ supplier: supplier.slug, count: rows?.length ?? 0, products: rows }, null, 2));
