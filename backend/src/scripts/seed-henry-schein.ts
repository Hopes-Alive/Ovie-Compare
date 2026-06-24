/**
 * Full Henry Schein seed — scrapes all discovered categories and upserts
 * products into Supabase.
 *
 * Prerequisites:
 *   1. Run the SQL migration in Supabase (backend/supabase/migrations/001_initial_schema.sql)
 *   2. Run: npm run discover:henry-schein   (produces data/henry-schein-categories.json)
 *   3. Run: npm run seed:henry-schein
 *
 * Falls back to SEED_CATEGORIES from selectors.ts if the JSON file is missing.
 */

import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { supabase } from "../lib/supabase.js";
import { HenryScheinAdapter } from "../scrapers/henry-schein/adapter.js";
import { SEED_CATEGORIES } from "../scrapers/henry-schein/selectors.js";
import type { CategoryInfo } from "../scrapers/henry-schein/category-crawler.js";
import type { ProductDetail, ScrapeStats } from "../types/scraper.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../data");
const CATEGORIES_FILE = resolve(DATA_DIR, "henry-schein-categories.json");
const PROGRESS_FILE = resolve(DATA_DIR, "henry-schein-seed-progress.json");

// Politeness delay between categories
const CATEGORY_DELAY_MS = 2000;

// ---------------------------------------------------------------------------
// Progress tracking (allows resume after interruption)
// ---------------------------------------------------------------------------

function loadProgress(): Set<string> {
  if (!existsSync(PROGRESS_FILE)) return new Set();
  try {
    const data = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8")) as string[];
    return new Set(data);
  } catch {
    return new Set();
  }
}

function saveProgress(done: Set<string>): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(PROGRESS_FILE, JSON.stringify([...done], null, 2), "utf-8");
}

const adapter = new HenryScheinAdapter();

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function getSupplierIdBySlug(slug: string): Promise<string> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    throw new Error(`Supplier "${slug}" not found. Run the SQL migration first.`);
  }
  return data.id as string;
}

async function upsertProducts(
  supplierId: string,
  products: ProductDetail[],
  jobId: string,
): Promise<ScrapeStats> {
  const stats: ScrapeStats = {
    found: products.length,
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
  };

  const now = new Date().toISOString();

  // 1. Fetch all existing rows for this supplier matching these URLs (one query)
  const urls = products.map((p) => p.url);
  const { data: existingRows, error: fetchErr } = await supabase
    .from("supplier_products")
    .select("id, supplier_product_url, content_hash")
    .eq("supplier_id", supplierId)
    .in("supplier_product_url", urls);

  if (fetchErr) throw fetchErr;

  const existingByUrl = new Map(
    (existingRows ?? []).map((r) => [r.supplier_product_url as string, r]),
  );

  // 2. Classify products
  const toInsert: object[] = [];
  const toUpdate: { id: string; patch: object }[] = [];
  const toTouch: string[] = [];
  const jobItems: object[] = [];

  for (const product of products) {
    const contentHash = adapter.buildContentHash(product);
    const existing = existingByUrl.get(product.url);

    if (!existing) {
      toInsert.push({
        supplier_id: supplierId,
        external_id: product.externalId,
        external_sku: product.externalSku,
        supplier_product_url: product.url,
        name: product.name,
        brand: product.brand ?? null,
        category: product.category ?? null,
        subcategory: product.subcategory ?? null,
        pack_size: product.packSize ?? null,
        image_src: product.imageSrc ?? null,
        price: product.price ?? null,
        currency: "AUD",
        price_includes_gst: true,
        stock_status: product.stockStatus ?? "unknown",
        content_hash: contentHash,
        scrape_priority: "normal",
        last_checked_at: now,
        last_changed_at: now,
        last_seen_at: now,
        is_active: true,
        raw_snapshot: product.raw ?? {},
      });
      stats.created++;
      jobItems.push({ scrape_job_id: jobId, url: product.url, status: "success", action: "created" });
    } else if (existing.content_hash !== contentHash) {
      toUpdate.push({
        id: existing.id as string,
        patch: {
          name: product.name,
          brand: product.brand ?? null,
          category: product.category ?? null,
          subcategory: product.subcategory ?? null,
          pack_size: product.packSize ?? null,
          image_src: product.imageSrc ?? null,
          price: product.price ?? null,
          stock_status: product.stockStatus ?? "unknown",
          content_hash: contentHash,
          last_checked_at: now,
          last_changed_at: now,
          last_seen_at: now,
          raw_snapshot: product.raw ?? {},
        },
      });
      stats.updated++;
      jobItems.push({ scrape_job_id: jobId, url: product.url, status: "success", action: "updated" });
    } else {
      toTouch.push(existing.id as string);
      stats.unchanged++;
      jobItems.push({ scrape_job_id: jobId, url: product.url, status: "success", action: "unchanged" });
    }
  }

  // 3. Batch upsert new products (onConflict handles races / cross-category dupes)
  if (toInsert.length > 0) {
    const { error } = await supabase
      .from("supplier_products")
      .upsert(toInsert, {
        onConflict: "supplier_id,supplier_product_url",
        ignoreDuplicates: true, // skip silently if already exists — content_hash branch handles updates
      });
    if (error) {
      console.error("  Batch upsert failed:", error.message);
      stats.failed += toInsert.length;
      stats.created -= toInsert.length;
    }
  }

  // 4. Update changed products (each needs individual update — no batch update in PostgREST by id list)
  for (const { id, patch } of toUpdate) {
    const { error } = await supabase
      .from("supplier_products")
      .update(patch)
      .eq("id", id);
    if (error) {
      console.error("  Update failed:", error.message);
      stats.failed++;
      stats.updated--;
    }
  }

  // 5. Touch unchanged products (batch update by id)
  if (toTouch.length > 0) {
    await supabase
      .from("supplier_products")
      .update({ last_checked_at: now, last_seen_at: now })
      .in("id", toTouch);
  }

  // 6. Batch insert job items
  if (jobItems.length > 0) {
    await supabase.from("scrape_job_items").insert(jobItems);
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Ovie Compare — Henry Schein full seed");
  console.log("======================================\n");

  // Load categories from discovered file, fall back to hardcoded list
  let categories: CategoryInfo[];
  if (existsSync(CATEGORIES_FILE)) {
    categories = JSON.parse(readFileSync(CATEGORIES_FILE, "utf-8")) as CategoryInfo[];
    console.log(`Loaded ${categories.length} categories from ${CATEGORIES_FILE}`);
  } else {
    categories = SEED_CATEGORIES;
    console.log(
      `data/henry-schein-categories.json not found — using ${categories.length} hardcoded categories.\n` +
      `Run "npm run discover:henry-schein" first for full coverage.`,
    );
  }

  const supplierId = await getSupplierIdBySlug("henry-schein");
  console.log(`Supplier ID: ${supplierId}\n`);

  // Resume: skip categories already completed in a previous run
  const done = loadProgress();
  const pending = categories.filter((c) => !done.has(c.path));

  if (done.size > 0) {
    console.log(`Resuming: ${done.size} categories already done, ${pending.length} remaining.\n`);
  }

  const { browser, context } = await HenryScheinAdapter.launchBrowser();
  const page = await context.newPage();

  const totalStats: ScrapeStats = {
    found: 0, created: 0, updated: 0, unchanged: 0, failed: 0,
  };

  let categoryIndex = done.size;

  try {
    for (const category of pending) {
      categoryIndex++;
      const prefix = `[${categoryIndex}/${categories.length}]`;
      console.log(`\n${prefix} ${category.name}  (${category.path})`);

      const { data: job, error: jobError } = await supabase
        .from("scrape_jobs")
        .insert({
          supplier_id: supplierId,
          job_type: "category_seed",
          status: "running",
          triggered_by: "script",
          category: category.name,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (jobError || !job) {
        console.error("  Could not create scrape_job:", jobError?.message);
        continue;
      }

      try {
        const products = await adapter.scrapeCategoryWithPage(page, category.path);

        if (products.length === 0) {
          console.log("  No products found — skipping upsert.");
          await supabase
            .from("scrape_jobs")
            .update({ status: "success", finished_at: new Date().toISOString(), stats: { found: 0 } })
            .eq("id", job.id);
        } else {
          console.log(`  Scraped ${products.length} products — upserting…`);
          const stats = await upsertProducts(supplierId, products, job.id as string);
          console.log(
            `  created=${stats.created}  updated=${stats.updated}  unchanged=${stats.unchanged}  failed=${stats.failed}`,
          );

          totalStats.found += stats.found;
          totalStats.created += stats.created;
          totalStats.updated += stats.updated;
          totalStats.unchanged += stats.unchanged;
          totalStats.failed += stats.failed;

          await supabase
            .from("scrape_jobs")
            .update({
              status: stats.failed > 0 && stats.created + stats.updated === 0 ? "failed" : "success",
              finished_at: new Date().toISOString(),
              stats,
            })
            .eq("id", job.id);
        }

        // Mark this category complete so a restart can skip it
        done.add(category.path);
        saveProgress(done);
      } catch (err) {
        console.error(`  Category error:`, err);
        await supabase
          .from("scrape_jobs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            error_message: err instanceof Error ? err.message : String(err),
          })
          .eq("id", job.id);
        // Do NOT add to done — allow retry on next run
      }

      // Politeness delay between categories
      if (categoryIndex < categories.length) {
        await page.waitForTimeout(CATEGORY_DELAY_MS);
      }
    }
  } finally {
    await browser.close();
  }

  console.log("\n======================================");
  console.log("DONE");
  console.log(
    `  found=${totalStats.found}  created=${totalStats.created}  updated=${totalStats.updated}  unchanged=${totalStats.unchanged}  failed=${totalStats.failed}`,
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
