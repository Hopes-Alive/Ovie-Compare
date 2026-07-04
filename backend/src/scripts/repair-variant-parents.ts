/**
 * Backfill for configurable products (size/shade/pack) that were originally
 * stored as a single "parent" row instead of one row per variant — either
 * because the parent's own price was hidden behind a login wall ("Call us!"),
 * or because the parent's price happened to look valid (e.g. every size
 * costs the same) so the missing per-variant SKUs/stock went unnoticed.
 * Re-visits each candidate's PDP and asks the DOM directly (the variant
 * options table is authoritative) whether it's actually configurable; when it
 * is, expands it into one row per variant (see `expandProductVariants` in
 * `scrapers/parse-product-helpers.ts`), upserts those, then deactivates the
 * original parent row so it stops surfacing in search as an extra near-dupe.
 *
 * Every active, not-yet-expanded product needs a PDP visit to check for a
 * variant table, so this is best run with `--limit` in batches rather than
 * across a whole catalog in one go.
 *
 * Usage:
 *   npx tsx src/scripts/repair-variant-parents.ts --supplier=adam-dental [--limit=20] [--dry-run]
 */
import "dotenv/config";
import { chromium } from "playwright";
import { supabase } from "../lib/supabase.js";
import { extractPdpDomFields } from "../lib/extract-pdp-dom-fields.js";
import { expandProductVariants } from "../scrapers/parse-product-helpers.js";
import { getAdapter } from "../scrapers/registry.js";
import { createScrapeJob, finishScrapeJob } from "../services/scrape/scrape-job.js";
import { upsertProducts } from "../services/scrape/upsert-products.js";
import type { ProductDetail, ScrapeStats, SupplierAdapter } from "../types/scraper.js";

const supplierSlug =
  process.argv.find((a) => a.startsWith("--supplier="))?.split("=")[1] ?? "adam-dental";
const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const skuFilter = process.argv.find((a) => a.startsWith("--sku="))?.split("=")[1] ?? null;
const dryRun = process.argv.includes("--dry-run");

const PAGE_WAIT_MS = 3000;
const PAGE_TIMEOUT_MS = 60_000;
const RPM_DELAY_MS = 1200;

type CandidateRow = {
  id: string;
  external_sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  pack_size: string | null;
  description: string | null;
  image_src: string | null;
  stock_status: string | null;
  supplier_product_url: string;
  metadata: Record<string, unknown> | null;
};

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function toProductDetail(row: CandidateRow): ProductDetail {
  return {
    externalSku: row.external_sku ?? undefined,
    externalId: row.external_sku ?? undefined,
    name: row.name,
    brand: row.brand ?? undefined,
    price: undefined,
    stockStatus: (row.stock_status as ProductDetail["stockStatus"]) ?? "unknown",
    url: row.supplier_product_url,
    category: row.category ?? undefined,
    subcategory: row.subcategory ?? undefined,
    packSize: row.pack_size ?? undefined,
    description: row.description ?? undefined,
    imageSrc: row.image_src ?? undefined,
    raw: { login_required: true },
  };
}

async function main() {
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, slug, name, adapter_key")
    .eq("slug", supplierSlug)
    .single();
  if (!supplier) throw new Error(`Supplier not found: ${supplierSlug}`);
  const adapter = getAdapter(supplier.adapter_key as string) as SupplierAdapter;

  let query = supabase
    .from("supplier_products")
    .select(
      "id, external_sku, name, brand, category, subcategory, pack_size, description, image_src, stock_status, supplier_product_url, metadata",
    )
    .eq("supplier_id", supplier.id)
    .eq("is_active", true)
    .is("variant_label", null)
    .not("supplier_product_url", "like", "%ProductSearch=%")
    .order("last_checked_at", { ascending: false });

  if (skuFilter) query = query.eq("external_sku", skuFilter.toUpperCase());
  if (limit > 0) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;

  const targets = (data ?? []) as CandidateRow[];

  console.log(`Repair variant parents — ${supplier.name}: ${targets.length} candidate(s)\n`);
  if (targets.length === 0) return;

  const jobId = dryRun
    ? "dry-run"
    : await createScrapeJob({ supplierId: supplier.id, jobType: "refresh", triggeredBy: "script" });

  const totals: ScrapeStats = { found: 0, created: 0, updated: 0, unchanged: 0, failed: 0 };
  let expanded = 0;
  let noVariantTable = 0;
  let parseFailed = 0;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: "en-AU",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  for (let i = 0; i < targets.length; i++) {
    const row = targets[i]!;
    process.stdout.write(`[${i + 1}/${targets.length}] ${row.external_sku ?? row.id} … `);

    try {
      await page.goto(row.supplier_product_url, {
        waitUntil: "domcontentloaded",
        timeout: PAGE_TIMEOUT_MS,
      });
      await page.waitForTimeout(PAGE_WAIT_MS);
      const domFields = await extractPdpDomFields(page, supplierSlug, row.external_sku);

      if (domFields.variantRows.length <= 1) {
        noVariantTable++;
        console.log("no variant table found — leaving parent row as-is");
        continue;
      }

      const variants = expandProductVariants(toProductDetail(row), domFields);
      const priced = variants.filter((v) => v.price != null && v.price > 0);
      console.log(`${variants.length} variants (${priced.length} priced)`);

      if (dryRun) {
        for (const v of variants) {
          console.log(
            `    - ${v.variantLabel ?? v.externalSku}: ${v.price != null ? `$${v.price.toFixed(2)}` : "no price"} (${v.stockStatus})`,
          );
        }
        expanded++;
        continue;
      }

      const stats = await upsertProducts({
        supplierId: supplier.id,
        products: variants,
        jobId,
        buildContentHash: adapter.buildContentHash.bind(adapter),
        priceHistorySource: "scheduled",
      });
      totals.found += stats.found;
      totals.created += stats.created;
      totals.updated += stats.updated;
      totals.unchanged += stats.unchanged;
      totals.failed += stats.failed;

      await supabase
        .from("supplier_products")
        .update({
          is_active: false,
          metadata: { ...(row.metadata ?? {}), superseded_by_variants: true },
        })
        .eq("id", row.id);

      expanded++;
    } catch (err) {
      parseFailed++;
      console.log(`error: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (i < targets.length - 1) await sleep(RPM_DELAY_MS);
  }

  await browser.close();

  if (!dryRun && jobId !== "dry-run") {
    await finishScrapeJob(jobId, totals, undefined, expanded > 0 ? undefined : "partial");
  }

  console.log("\n--- Summary ---");
  console.log(`  Expanded to variants: ${expanded}`);
  console.log(`  No variant table:     ${noVariantTable}`);
  console.log(`  Parse failed:         ${parseFailed}`);
  if (!dryRun) console.log(`  DB stats:             ${JSON.stringify(totals)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
