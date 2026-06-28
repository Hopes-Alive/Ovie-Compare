/**
 * Probe AI product read — timing and result for sample products.
 *
 * Usage:
 *   npm run probe-ai-read
 *   npm run probe-ai-read -- --supplier adam-dental --limit 1
 */
import "dotenv/config";
import { supabase } from "../lib/supabase.js";
import { runAiProductRead } from "../services/ai-product-read/run-ai-product-read.js";

const supplierSlug =
  process.argv.find((a) => a.startsWith("--supplier="))?.split("=")[1] ??
  (process.argv.includes("--supplier")
    ? process.argv[process.argv.indexOf("--supplier") + 1]
    : null);

const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "1");

async function loadSampleProductIds(): Promise<string[]> {
  let query = supabase
    .from("supplier_products")
    .select("id, suppliers!inner(slug)")
    .eq("is_active", true)
    .not("supplier_product_url", "ilike", "%/search?%")
    .not("supplier_product_url", "ilike", "%ProductCode=%")
    .not("supplier_product_url", "ilike", "%ProductSearch=%")
    .not("price", "is", null)
    .order("last_checked_at", { ascending: false })
    .limit(limit * 2);

  if (supplierSlug) {
    query = query.eq("suppliers.slug", supplierSlug);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const ids: string[] = [];
  for (const row of data ?? []) {
    if (ids.length >= limit) break;
    ids.push(row.id as string);
  }
  return ids;
}

async function main() {
  const productIds = await loadSampleProductIds();
  if (productIds.length === 0) {
    console.log("No suitable products found.");
    return;
  }

  console.log(`AI read probe — ${productIds.length} product(s)\n`);

  for await (const event of runAiProductRead(productIds, "probe")) {
    if (event.type === "progress") {
      console.log(`[${event.index}/${event.total}] ${event.supplier}…`);
    } else if (event.type === "result") {
      console.log(
        `  ✓ ${event.productId.slice(0, 8)}… changed=${event.changed} ${event.oldPrice} → ${event.newPrice}`,
      );
      if (event.fieldsChanged?.length) console.log(`    fields: ${event.fieldsChanged.join(", ")}`);
      if (event.aiNotes) console.log(`    notes: ${event.aiNotes}`);
    } else if (event.type === "error") {
      console.log(`  ✗ ${event.productId?.slice(0, 8) ?? "?"}… ${event.message}`);
    } else if (event.type === "done") {
      const { data: items } = await supabase
        .from("live_check_job_items")
        .select("duration_ms")
        .in("supplier_product_id", productIds)
        .order("checked_at", { ascending: false })
        .limit(productIds.length);

      const durations = (items ?? [])
        .map((i) => i.duration_ms as number | null)
        .filter((ms): ms is number => ms != null);

      if (durations.length > 0) {
        const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        console.log(`\nTiming: min=${Math.min(...durations)} avg=${avg} max=${Math.max(...durations)} ms`);
      }
      console.log("Summary:", event.summary);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
