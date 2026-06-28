/**
 * Re-scrape products with null price using fixed parser (Pass B style).
 */
import "dotenv/config";
import { chromium } from "playwright";
import { supabase } from "../lib/supabase.js";
import { getAdapter } from "../scrapers/registry.js";
import { createScrapeJob, finishScrapeJob } from "../services/scrape/scrape-job.js";
import { upsertProducts } from "../services/scrape/upsert-products.js";
import type { ScrapeStats, SupplierAdapter } from "../types/scraper.js";

const supplierSlug =
  process.argv.find((a) => a.startsWith("--supplier="))?.split("=")[1] ??
  (process.argv.includes("--supplier") ? process.argv[process.argv.indexOf("--supplier") + 1] : "adam-dental");

const limit = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const skuFilter =
  process.argv.find((a) => a.startsWith("--sku="))?.split("=")[1] ??
  (process.argv.includes("--sku") ? process.argv[process.argv.indexOf("--sku") + 1] : null);
const dryRun = process.argv.includes("--dry-run");
const imagesOnly = process.argv.includes("--images-only");

const RPM_DELAY_MS = 1200;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, slug, name, adapter_key")
    .eq("slug", supplierSlug)
    .single();

  if (!supplier) throw new Error(`Supplier not found: ${supplierSlug}`);

  let query = supabase
    .from("supplier_products")
    .select("id, name, external_sku, supplier_product_url")
    .eq("supplier_id", supplier.id)
    .eq("is_active", true)
    .not("supplier_product_url", "like", "%ProductSearch=%")
    .order("last_checked_at", { ascending: false });

  if (imagesOnly) {
    query = query.is("image_src", null);
  } else {
    query = query.is("price", null);
  }

  if (skuFilter) query = query.eq("external_sku", skuFilter.toUpperCase());
  if (limit > 0) query = query.limit(limit);

  const { data: rows, error } = await query;
  if (error) throw error;

  console.log(
    `${imagesOnly ? "Repair missing images" : "Repair missing prices"} — ${supplier.name}: ${rows?.length ?? 0} products\n`,
  );
  if (!rows?.length) return;

  const adapter = getAdapter(supplier.adapter_key as string) as SupplierAdapter;
  const jobId = dryRun
    ? "dry-run"
    : await createScrapeJob({
        supplierId: supplier.id,
        jobType: "refresh",
        triggeredBy: "script",
      });

  const totals: ScrapeStats = { found: 0, created: 0, updated: 0, unchanged: 0, failed: 0 };
  let repaired = 0;
  let stillMissing = 0;
  let parseFailed = 0;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: "en-AU",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const url = row.supplier_product_url as string;
    process.stdout.write(`[${i + 1}/${rows.length}] ${row.external_sku} … `);

    try {
      const product = await adapter.parseProductPage(page, url);
      if (!product) {
        parseFailed++;
        console.log("parse failed");
        continue;
      }

      if (product.price == null || product.price <= 0) {
        if (!imagesOnly) {
          stillMissing++;
          const loginReq = Boolean(
            (product.raw as Record<string, unknown> | undefined)?.login_required,
          );
          console.log(loginReq ? "no public price (login/APHRA)" : "no price extracted");
          continue;
        }
      }

      if (imagesOnly && !product.imageSrc) {
        stillMissing++;
        console.log("no image extracted");
        continue;
      }

      if (dryRun) {
        repaired++;
        console.log(
          imagesOnly
            ? `would set image ${product.imageSrc}`
            : `would set $${product.price!.toFixed(2)}`,
        );
        continue;
      }

      const stats = await upsertProducts({
        supplierId: supplier.id,
        products: [product],
        jobId,
        buildContentHash: adapter.buildContentHash.bind(adapter),
        priceHistorySource: "scheduled",
      });

      totals.found += stats.found;
      totals.updated += stats.updated;
      totals.unchanged += stats.unchanged;
      totals.failed += stats.failed;
      repaired++;
      console.log(
        imagesOnly
          ? `image saved (${stats.updated ? "updated" : "unchanged"})`
          : `$${product.price!.toFixed(2)} (${stats.updated ? "updated" : "unchanged"})`,
      );
    } catch (err) {
      parseFailed++;
      console.log(`error: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (i < rows.length - 1) await sleep(RPM_DELAY_MS);
  }

  await browser.close();

  if (!dryRun && jobId !== "dry-run") {
    await finishScrapeJob(jobId, totals, undefined, repaired > 0 ? undefined : "partial");
  }

  console.log("\n--- Summary ---");
  console.log(`  Repaired:       ${repaired}`);
  console.log(`  Still no price: ${stillMissing}`);
  console.log(`  Parse failed:   ${parseFailed}`);
  if (!dryRun) console.log(`  DB stats:       ${JSON.stringify(totals)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
