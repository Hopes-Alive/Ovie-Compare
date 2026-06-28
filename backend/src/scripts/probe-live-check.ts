/**
 * Benchmark live check timing — runs 3–5 product URLs per supplier.
 *
 * Usage:
 *   npm run probe-live-check
 *   npm run probe-live-check -- --supplier adam-dental --limit 3
 */
import "dotenv/config";
import { supabase } from "../lib/supabase.js";
import { runLiveCheck } from "../services/live-check/run-live-check.js";

const supplierSlug =
  process.argv.find((a) => a.startsWith("--supplier="))?.split("=")[1] ??
  (process.argv.includes("--supplier")
    ? process.argv[process.argv.indexOf("--supplier") + 1]
    : null);

const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "5");

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

  const bySupplier = new Map<string, string[]>();
  for (const row of data ?? []) {
    const slug = (row.suppliers as unknown as { slug: string }).slug;
    const list = bySupplier.get(slug) ?? [];
    if (list.length < limit) {
      list.push(row.id as string);
      bySupplier.set(slug, list);
    }
  }

  return [...bySupplier.values()].flat();
}

async function main() {
  const productIds = await loadSampleProductIds();
  if (productIds.length === 0) {
    console.log("No suitable products found.");
    return;
  }

  console.log(`Probing ${productIds.length} products...\n`);
  const timings: Array<{ productId: string; durationMs?: number; status: string }> = [];

  for await (const event of runLiveCheck(productIds, "benchmark")) {
    if (event.type === "progress") {
      console.log(`[${event.index}/${event.total}] Checking ${event.supplier}…`);
    } else if (event.type === "result") {
      console.log(
        `  ✓ ${event.productId.slice(0, 8)}… changed=${event.changed} ${event.oldPrice} → ${event.newPrice}`,
      );
      timings.push({ productId: event.productId, status: "success" });
    } else if (event.type === "error") {
      console.log(`  ✗ ${event.productId?.slice(0, 8) ?? "?"}… ${event.message}`);
      timings.push({ productId: event.productId ?? "unknown", status: "failed" });
    } else if (event.type === "done") {
      const { data: items } = await supabase
        .from("live_check_job_items")
        .select("supplier_product_id, duration_ms, status")
        .in("supplier_product_id", productIds)
        .order("checked_at", { ascending: false })
        .limit(productIds.length);

      const durations = (items ?? [])
        .map((i) => i.duration_ms as number | null)
        .filter((ms): ms is number => ms != null);

      if (durations.length > 0) {
        const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        const min = Math.min(...durations);
        const max = Math.max(...durations);
        console.log(`\nTiming (duration_ms): min=${min} avg=${avg} max=${max} n=${durations.length}`);
      }

      console.log("\nSummary:", event.summary);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
