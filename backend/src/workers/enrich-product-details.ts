/**
 * Product detail enrichment worker.
 *
 * Visits individual product pages to backfill fields not available on listing
 * pages (description, brand, image) using the shared `extractPdpDomFields`
 * helper — the same DOM extraction used by live check / AI read.
 *
 * Both Henry Schein and Adam Dental run on the same SAP Commerce platform
 * so the selectors are identical.
 *
 * Usage:
 *   npx tsx src/workers/enrich-product-details.ts
 *   npx tsx src/workers/enrich-product-details.ts --supplier henry-schein
 *   npx tsx src/workers/enrich-product-details.ts --supplier adam-dental
 *   npx tsx src/workers/enrich-product-details.ts --limit 200
 */
import "dotenv/config";
import { chromium, type Page } from "playwright";
import { supabase } from "../lib/supabase.js";
import { extractPdpDomFields } from "../lib/extract-pdp-dom-fields.js";

// ── Config ────────────────────────────────────────────────────────────────────

const PAGE_WAIT_MS = 3000;
const DELAY_BETWEEN_MS = 700;
const PAGE_TIMEOUT_MS = 30_000;

const BROWSER_OPTIONS = {
  locale: "en-AU",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

// ── CLI args ──────────────────────────────────────────────────────────────────

function getArg(name: string): string | null {
  const idx = process.argv.indexOf(name);
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null;
}

const supplierFilter = getArg("--supplier");
const limitArg = getArg("--limit");
const limit = limitArg ? parseInt(limitArg, 10) : undefined;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Per-page extraction ───────────────────────────────────────────────────────

interface DetailResult {
  description?: string;
  brand?: string;
  imageSrc?: string;
}

async function extractDetail(
  page: Page,
  productUrl: string,
  supplierSlug: string,
  externalSku?: string | null,
): Promise<DetailResult | null> {
  // Skip search-fallback URLs — product detail page won't be found
  if (productUrl.includes("/search?") || productUrl.includes("ProductCode=")) return null;

  try {
    await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
    await page.waitForTimeout(PAGE_WAIT_MS);

    const dom = await extractPdpDomFields(page, supplierSlug, externalSku);
    const description = dom.description ?? undefined;
    const brand = dom.brandField ?? undefined;
    const imageSrc = dom.imageSrc ?? undefined;

    if (!description && !brand && !imageSrc) return null;
    return { description, brand, imageSrc };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("Timeout") && !msg.includes("Navigation")) {
      console.error(`    Error: ${msg.slice(0, 120)}`);
    }
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Ovie — Product Detail Enrichment Worker");
  console.log("=".repeat(60));
  if (supplierFilter) console.log(`  Supplier: ${supplierFilter}`);
  if (limit) console.log(`  Limit: ${limit}`);
  console.log();

  let supplierIds: string[] = [];
  if (supplierFilter) {
    const { data } = await supabase.from("suppliers").select("id").eq("slug", supplierFilter);
    supplierIds = (data ?? []).map((r) => r.id as string);
    if (supplierIds.length === 0) {
      console.error(`Unknown supplier: ${supplierFilter}`);
      process.exit(1);
    }
  }

  // Target: products missing description OR missing brand with a real product URL
  let query = supabase
    .from("supplier_products")
    .select("id, supplier_product_url, name, brand, description, image_src, external_sku, suppliers!inner(slug)")
    .eq("is_active", true)
    .not("supplier_product_url", "is", null)
    .not("supplier_product_url", "ilike", "%/search?%")
    .not("supplier_product_url", "ilike", "%ProductCode=%")
    .or("description.is.null,brand.is.null,image_src.is.null");

  if (supplierIds.length > 0) {
    query = query.in("supplier_id", supplierIds) as typeof query;
  }

  const { data: products, error } = await query.limit(limit ?? 100000);
  if (error) throw error;
  if (!products || products.length === 0) {
    console.log("Nothing to enrich.");
    return;
  }

  console.log(`Products to enrich: ${products.length}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(BROWSER_OPTIONS);
  const page = await context.newPage();

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const url = product.supplier_product_url as string;
      const supplierSlug =
        (product.suppliers as { slug: string } | null)?.slug ?? "henry-schein";

      process.stdout.write(`[${i + 1}/${products.length}] ${String(product.name).slice(0, 55)}\n`);

      const detail = await extractDetail(page, url, supplierSlug, product.external_sku as string | null);

      if (!detail) {
        skipped++;
        process.stdout.write(`  → skipped\n`);
        continue;
      }

      // Only update fields that are missing in the DB and were found on the page
      const patch: Record<string, string> = {};
      if (detail.description && !product.description) patch.description = detail.description;
      if (detail.brand && !product.brand) patch.brand = detail.brand;
      if (detail.imageSrc && !product.image_src) patch.image_src = detail.imageSrc;

      if (Object.keys(patch).length === 0) {
        skipped++;
        continue;
      }

      const { error: ue } = await supabase
        .from("supplier_products")
        .update(patch)
        .eq("id", product.id as string);

      if (ue) {
        console.error(`  DB error: ${ue.message}`);
        failed++;
      } else {
        enriched++;
        process.stdout.write(
          `  → brand=${detail.brand ?? "—"} img=${detail.imageSrc ? "yes" : "—"} desc=${detail.description ? `"${detail.description.slice(0, 60)}..."` : "—"}\n`,
        );
      }

      if (i < products.length - 1) await sleep(DELAY_BETWEEN_MS);
    }
  } finally {
    await browser.close();
  }

  console.log("\n" + "=".repeat(60));
  console.log(`DONE  enriched=${enriched}  skipped=${skipped}  failed=${failed}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
