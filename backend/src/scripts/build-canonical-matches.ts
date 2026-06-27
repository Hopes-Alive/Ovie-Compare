/**
 * build-canonical-matches.ts
 *
 * Scans supplier_products from all suppliers, computes cosine similarity
 * between products that have embeddings, and groups near-identical products
 * into canonical_products + canonical_product_matches records.
 *
 * Matching strategy:
 * - For each Adam Dental product (smaller set), find the best Henry Schein match.
 * - If cosine similarity ≥ HIGH_CONFIDENCE_THRESHOLD → auto-link (match_method="embedding_auto").
 * - Does NOT overwrite existing canonical matches.
 *
 * Usage:
 *   npx tsx src/scripts/build-canonical-matches.ts
 *   npx tsx src/scripts/build-canonical-matches.ts --dry-run
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const HIGH_CONFIDENCE_THRESHOLD = 0.88; // same product, possibly different name formatting
const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductWithEmbedding {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  pack_size: string | null;
  supplier_slug: string;
  supplier_name: string;
  embedding: number[];
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function parseEmbedding(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as number[];
    } catch { return null; }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fetch products with embeddings for a supplier
// ---------------------------------------------------------------------------

async function fetchProductsWithEmbeddings(supplierSlug: string): Promise<ProductWithEmbedding[]> {
  const { data: sup } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("slug", supplierSlug)
    .single() as { data: { id: string; name: string } | null };

  if (!sup) throw new Error(`Supplier not found: ${supplierSlug}`);

  const allRows: ProductWithEmbedding[] = [];
  const PAGE = 500;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("supplier_products")
      .select("id, name, brand, category, pack_size, embedding")
      .eq("supplier_id", sup.id)
      .eq("is_active", true)
      .not("embedding", "is", null)
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Fetch failed for ${supplierSlug}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const embedding = parseEmbedding((row as Record<string, unknown>).embedding);
      if (embedding) {
        allRows.push({
          id: row.id as string,
          name: row.name as string,
          brand: (row.brand as string) ?? null,
          category: (row.category as string) ?? null,
          pack_size: (row.pack_size as string) ?? null,
          supplier_slug: supplierSlug,
          supplier_name: sup.name,
          embedding,
        });
      }
    }

    from += PAGE;
    if (data.length < PAGE) break;
  }

  return allRows;
}

// ---------------------------------------------------------------------------
// Check which product IDs already have canonical matches
// ---------------------------------------------------------------------------

async function getAlreadyMatchedIds(): Promise<Set<string>> {
  const { data } = await supabase
    .from("canonical_product_matches")
    .select("supplier_product_id");
  return new Set((data ?? []).map((r: Record<string, unknown>) => r.supplier_product_id as string));
}

// ---------------------------------------------------------------------------
// Insert canonical group
// ---------------------------------------------------------------------------

async function insertCanonicalGroup(
  productA: ProductWithEmbedding,
  productB: ProductWithEmbedding,
  similarity: number
): Promise<void> {
  // Use the Henry Schein product's details as the canonical name (tends to be more complete)
  const hsProduct = productA.supplier_slug === "henry-schein" ? productA : productB;

  const { data: canonical, error: cpErr } = await supabase
    .from("canonical_products")
    .insert({
      name: hsProduct.name,
      brand: hsProduct.brand,
      category: hsProduct.category,
      pack_size: hsProduct.pack_size,
      metadata: { auto_matched: true, similarity: Math.round(similarity * 1000) / 1000 },
    })
    .select("id")
    .single() as { data: { id: string } | null; error: unknown };

  if (cpErr || !canonical) {
    console.error("  ✗ Failed to insert canonical product:", (cpErr as { message?: string })?.message);
    return;
  }

  const matches = [
    { canonical_product_id: canonical.id, supplier_product_id: productA.id, match_method: "embedding", match_confidence: similarity, is_verified: false },
    { canonical_product_id: canonical.id, supplier_product_id: productB.id, match_method: "embedding", match_confidence: similarity, is_verified: false },
  ];

  const { error: cmErr } = await supabase.from("canonical_product_matches").insert(matches);
  if (cmErr) {
    console.error("  ✗ Failed to insert canonical matches:", (cmErr as { message?: string })?.message);
    await supabase.from("canonical_products").delete().eq("id", canonical.id);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\n🔍  Building canonical product matches${DRY_RUN ? " (DRY RUN)" : ""}...\n`);

  const [adProducts, hsProducts] = await Promise.all([
    fetchProductsWithEmbeddings("adam-dental"),
    fetchProductsWithEmbeddings("henry-schein"),
  ]);

  console.log(`  Adam Dental products with embeddings : ${adProducts.length}`);
  console.log(`  Henry Schein products with embeddings: ${hsProducts.length}`);
  console.log(`  Total pairs to compare               : ${adProducts.length * hsProducts.length}\n`);

  const alreadyMatched = await getAlreadyMatchedIds();
  console.log(`  Already matched supplier_product IDs: ${alreadyMatched.size}\n`);

  const unmatched = {
    "adam-dental": adProducts.filter((p) => !alreadyMatched.has(p.id)),
    "henry-schein": hsProducts.filter((p) => !alreadyMatched.has(p.id)),
  };

  console.log(`  Unmatched Adam Dental : ${unmatched["adam-dental"].length}`);
  console.log(`  Unmatched Henry Schein: ${unmatched["henry-schein"].length}\n`);

  let matched = 0;
  let skipped = 0;
  const newlyMatchedHsIds = new Set<string>();

  for (const adProduct of unmatched["adam-dental"]) {
    let bestSim = 0;
    let bestHs: ProductWithEmbedding | null = null;

    for (const hsProduct of unmatched["henry-schein"]) {
      if (newlyMatchedHsIds.has(hsProduct.id)) continue;
      const sim = cosineSimilarity(adProduct.embedding, hsProduct.embedding);
      if (sim > bestSim) {
        bestSim = sim;
        bestHs = hsProduct;
      }
    }

    if (bestSim >= HIGH_CONFIDENCE_THRESHOLD && bestHs) {
      console.log(
        `  ✓ MATCH (sim=${bestSim.toFixed(3)})\n` +
        `      AD: ${adProduct.name.slice(0, 70)}\n` +
        `      HS: ${bestHs.name.slice(0, 70)}`
      );

      if (!DRY_RUN) {
        await insertCanonicalGroup(adProduct, bestHs, bestSim);
        newlyMatchedHsIds.add(bestHs.id);
      }
      matched++;
    } else {
      skipped++;
      if (bestHs && bestSim > 0.88) {
        // Log near-misses for manual review
        console.log(
          `  ~ near-miss (sim=${bestSim.toFixed(3)})\n` +
          `      AD: ${adProduct.name.slice(0, 70)}\n` +
          `      HS: ${bestHs.name.slice(0, 70)}`
        );
      }
    }
  }

  console.log(`\n📊  Summary`);
  console.log(`  Canonical groups created : ${matched}`);
  console.log(`  No cross-supplier match  : ${skipped}`);
  if (DRY_RUN) console.log(`\n  ⚠  DRY RUN — nothing written to DB.`);
  else console.log(`\n  ✅  Done. Run again with --dry-run to preview only.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
