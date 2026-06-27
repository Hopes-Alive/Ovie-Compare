import "dotenv/config";
import { buildProductImageUrls } from "../lib/product-images.js";
import { supabase } from "../lib/supabase.js";

const query = process.argv.slice(2).join(" ") || "Directa Polycarbonate Temporary Crowns";

const { data, error } = await supabase
  .from("supplier_products")
  .select("id, name, external_sku, image_src, supplier_product_url, suppliers(slug, name)")
  .ilike("name", `%${query}%`)
  .limit(5);

if (error) {
  console.error(error);
  process.exit(1);
}

if (!data?.length) {
  console.log("No products found for:", query);
  process.exit(0);
}

for (const r of data) {
  const slug = (r.suppliers as { slug: string } | null)?.slug ?? "";
  const urls = buildProductImageUrls(r.image_src, slug, r.external_sku);
  console.log("---");
  console.log("name:", r.name);
  console.log("supplier:", slug);
  console.log("sku:", r.external_sku);
  console.log("image_src:", r.image_src);
  console.log("product_url:", r.supplier_product_url);
  console.log("built_urls:", urls);

  for (const url of urls.slice(0, 3)) {
    try {
      const res = await fetch(url, { method: "HEAD", redirect: "follow" });
      console.log(`  HEAD ${res.status} ${url}`);
    } catch (err) {
      console.log(`  HEAD FAIL ${url}`, err instanceof Error ? err.message : err);
    }
  }
}
