/**
 * Validates that scraped products in the DB look correct.
 * Run after seed to confirm data quality.
 *
 * Usage: npx tsx src/scripts/validate-db.ts
 */
import "dotenv/config";
import { supabase } from "../lib/supabase.js";

async function main() {
  console.log("Ovie Compare — DB validation report");
  console.log("=====================================\n");

  // Overall counts
  const { count: total } = await supabase
    .from("supplier_products")
    .select("*", { count: "exact", head: true });

  const { count: withPrice } = await supabase
    .from("supplier_products")
    .select("*", { count: "exact", head: true })
    .not("price", "is", null);

  const { count: withBrand } = await supabase
    .from("supplier_products")
    .select("*", { count: "exact", head: true })
    .not("brand", "is", null);

  const { count: withPack } = await supabase
    .from("supplier_products")
    .select("*", { count: "exact", head: true })
    .not("pack_size", "is", null);

  const { count: withImage } = await supabase
    .from("supplier_products")
    .select("*", { count: "exact", head: true })
    .not("image_src", "is", null);

  console.log("Total products:   ", total);
  console.log("With price:       ", withPrice, `(${pct(withPrice, total)}%)`);
  console.log("With brand:       ", withBrand, `(${pct(withBrand, total)}%)`);
  console.log("With pack size:   ", withPack, `(${pct(withPack, total)}%)`);
  console.log("With image:       ", withImage, `(${pct(withImage, total)}%)`);

  // Price range sanity check
  const { data: priceStats } = await supabase
    .from("supplier_products")
    .select("price")
    .not("price", "is", null)
    .order("price", { ascending: true })
    .limit(1);

  const { data: priceMax } = await supabase
    .from("supplier_products")
    .select("price")
    .not("price", "is", null)
    .order("price", { ascending: false })
    .limit(1);

  console.log(`\nPrice range:      $${priceStats?.[0]?.price} – $${priceMax?.[0]?.price} AUD (inc GST)`);

  // Category breakdown
  const { data: categories } = await supabase
    .from("supplier_products")
    .select("category")
    .not("category", "is", null);

  const catCounts: Record<string, number> = {};
  for (const row of categories ?? []) {
    const cat = row.category as string;
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }
  const topCats = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log("\nTop 10 categories by product count:");
  for (const [cat, count] of topCats) {
    console.log(`  ${cat.padEnd(40)} ${count}`);
  }

  // Sample products — spot check a few
  const { data: samples } = await supabase
    .from("supplier_products")
    .select("external_sku, name, brand, price, pack_size, category, supplier_product_url")
    .not("price", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("\nLatest 5 inserted products:");
  console.log("─".repeat(80));
  for (const p of samples ?? []) {
    console.log(`SKU:   ${p.external_sku}`);
    console.log(`Name:  ${p.name}`);
    console.log(`Brand: ${p.brand ?? "—"}  |  Price: $${p.price}  |  Pack: ${p.pack_size ?? "—"}`);
    console.log(`Cat:   ${p.category}`);
    console.log(`URL:   ${p.supplier_product_url}`);
    console.log("─".repeat(80));
  }

  // Data quality flags
  const { count: noUrl } = await supabase
    .from("supplier_products")
    .select("*", { count: "exact", head: true })
    .is("supplier_product_url", null);

  const { count: noName } = await supabase
    .from("supplier_products")
    .select("*", { count: "exact", head: true })
    .is("name", null);

  console.log("\nData quality flags:");
  console.log(`  Products missing URL:   ${noUrl}`);
  console.log(`  Products missing name:  ${noName}`);

  // Scrape job summary
  const { data: jobs } = await supabase
    .from("scrape_jobs")
    .select("status, category")
    .order("created_at", { ascending: false })
    .limit(20);

  const jobStatus: Record<string, number> = {};
  for (const j of jobs ?? []) {
    jobStatus[j.status] = (jobStatus[j.status] || 0) + 1;
  }
  console.log("\nScrape jobs (last 20):", JSON.stringify(jobStatus));
}

function pct(part: number | null, total: number | null): string {
  if (!part || !total) return "0";
  return ((part / total) * 100).toFixed(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
