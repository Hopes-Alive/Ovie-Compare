/**
 * Embedding worker — generates and stores vector embeddings for all
 * supplier_products that are missing them.
 *
 * Strategy:
 *   - Fetches products in pages (PAGE_SIZE rows at a time)
 *   - Embeds BATCH_SIZE products per Azure OpenAI call (rate-limit friendly)
 *   - Writes embeddings back to Supabase
 *   - Skips products where name is null
 *   - Logs progress so the run can be monitored
 *
 * Usage:
 *   npx tsx src/workers/embedding-worker.ts
 *   npx tsx src/workers/embedding-worker.ts --supplier henry-schein
 *   npx tsx src/workers/embedding-worker.ts --supplier adam-dental
 */
import "dotenv/config";
import { supabase } from "../lib/supabase.js";
import { buildEmbeddingText, embedBatch } from "../services/embeddings.js";

// ── Config ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 500;   // rows fetched per Supabase query
const BATCH_SIZE = 100;  // texts sent per Azure OpenAI call (max 2048)
const DELAY_MS = 200;    // pause between API calls to stay under rate limit

// ── CLI args ──────────────────────────────────────────────────────────────────

const supplierFilter = (() => {
  const idx = process.argv.indexOf("--supplier");
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function getSupplierIds(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("suppliers").select("id, slug");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((s) => [s.slug as string, s.id as string]));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Ovie — Embedding Worker");
  console.log("=".repeat(60));

  if (supplierFilter) {
    console.log(`  Filtering to supplier: ${supplierFilter}`);
  } else {
    console.log("  Processing all suppliers");
  }
  console.log();

  const supplierIds = await getSupplierIds();

  // Build base query
  let query = supabase
    .from("supplier_products")
    .select(
      "id, name, brand, category, subcategory, external_sku, pack_size, unit_of_measure, description, price, currency, stock_status, delivery_text",
    )
    .is("embedding", null)
    .eq("is_active", true)
    .not("name", "is", null);

  if (supplierFilter) {
    const sid = supplierIds[supplierFilter];
    if (!sid) {
      console.error(`Unknown supplier slug: ${supplierFilter}`);
      console.error(`Available: ${Object.keys(supplierIds).join(", ")}`);
      process.exit(1);
    }
    query = query.eq("supplier_id", sid) as typeof query;
  }

  // Count total to embed
  let countQuery = supabase
    .from("supplier_products")
    .select("*", { count: "exact", head: true })
    .is("embedding", null)
    .eq("is_active", true)
    .not("name", "is", null);

  if (supplierFilter) {
    countQuery = countQuery.eq("supplier_id", supplierIds[supplierFilter]!) as typeof countQuery;
  }

  const { count: totalToEmbed } = await countQuery;
  console.log(`Products needing embeddings: ${totalToEmbed}`);
  console.log();

  let totalProcessed = 0;
  let totalFailed = 0;
  let page = 0;

  while (true) {
    const { data: rows, error } = await query
      .range(0, PAGE_SIZE - 1)  // always fetch from offset 0 — processed rows get embedding set
      .order("created_at", { ascending: true });

    if (error) throw error;
    if (!rows || rows.length === 0) break;

    console.log(`Page ${++page}: fetched ${rows.length} products`);

    // Process in batches for the Azure API call
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const texts = batch.map((r) =>
        buildEmbeddingText({
          name: r.name as string,
          brand: r.brand as string | null,
          category: r.category as string | null,
          subcategory: r.subcategory as string | null,
          external_sku: r.external_sku as string | null,
          pack_size: r.pack_size as string | null,
          unit_of_measure: r.unit_of_measure as string | null,
          description: r.description as string | null,
          price: r.price as number | null,
          currency: r.currency as string | null,
          stock_status: r.stock_status as string | null,
          delivery_text: r.delivery_text as string | null,
        }),
      );

      let embeddings: number[][];
      try {
        embeddings = await embedBatch(texts);
      } catch (err) {
        console.error(`  Batch embed error (offset ${i}):`, err);
        totalFailed += batch.length;
        continue;
      }

      // Write embeddings back — one update per row (Supabase doesn't support batch update by id list)
      const updates = batch.map((row, j) =>
        supabase
          .from("supplier_products")
          .update({ embedding: embeddings[j] as unknown as string })
          .eq("id", row.id as string),
      );

      const results = await Promise.all(updates);
      const writeErrors = results.filter((r) => r.error);

      if (writeErrors.length > 0) {
        console.error(`  ${writeErrors.length} write errors in batch`);
        totalFailed += writeErrors.length;
      }

      totalProcessed += batch.length - writeErrors.length;

      const batchEnd = Math.min(i + BATCH_SIZE, rows.length);
      console.log(
        `  Embedded ${batchEnd}/${rows.length} in this page  (total done: ${totalProcessed})`,
      );

      if (batchEnd < rows.length) {
        await sleep(DELAY_MS);
      }
    }

    // If fewer rows than PAGE_SIZE came back, we're on the last page
    if (rows.length < PAGE_SIZE) break;

    await sleep(DELAY_MS);
  }

  console.log();
  console.log("=".repeat(60));
  console.log(`DONE  processed=${totalProcessed}  failed=${totalFailed}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
