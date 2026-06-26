/**
 * Resets all embeddings to NULL so the embedding worker regenerates them.
 * Runs in pages to avoid Supabase statement timeouts.
 *
 * Run this when buildEmbeddingText() changes.
 * Usage: npx tsx src/scripts/reset-embeddings.ts
 */
import "dotenv/config";
import { supabase } from "../lib/supabase.js";

const PAGE_SIZE = 500;
let total = 0;
let offset = 0;

while (true) {
  // Fetch IDs of products that still have an embedding
  const { data, error: fetchErr } = await supabase
    .from("supplier_products")
    .select("id")
    .not("embedding", "is", null)
    .range(0, PAGE_SIZE - 1);

  if (fetchErr) {
    console.error("Fetch failed:", fetchErr.message);
    process.exit(1);
  }
  if (!data || data.length === 0) break;

  const ids = data.map((r) => r.id as string);
  const { error: updateErr } = await supabase
    .from("supplier_products")
    .update({ embedding: null })
    .in("id", ids);

  if (updateErr) {
    console.error("Update failed:", updateErr.message);
    process.exit(1);
  }

  total += ids.length;
  process.stdout.write(`  Reset ${total} embeddings…\r`);

  if (data.length < PAGE_SIZE) break;
  offset += PAGE_SIZE;
}

console.log(`\nReset ${total} embeddings to NULL. Run: npm run embed`);
