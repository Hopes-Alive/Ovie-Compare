/**
 * Full Adam Dental seed — scrapes all discovered categories and upserts
 * products into Supabase.
 *
 * Prerequisites:
 *   1. Run the SQL migration in Supabase (backend/supabase/migrations/001_initial_schema.sql)
 *   2. Run: npm run discover:adam-dental   (produces data/adam-dental-categories.json)
 *   3. Run: npm run seed:adam-dental
 *
 * Falls back to SEED_CATEGORIES from selectors.ts if the JSON file is missing.
 */

import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { supabase } from "../lib/supabase.js";
import { AdamDentalAdapter } from "../scrapers/adam-dental/adapter.js";
import { SEED_CATEGORIES } from "../scrapers/adam-dental/selectors.js";
import type { CategoryInfo } from "../scrapers/adam-dental/category-crawler.js";
import type { ProductDetail, ScrapeStats } from "../types/scraper.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../data");
const CATEGORIES_FILE = resolve(DATA_DIR, "adam-dental-categories.json");
const PROGRESS_FILE = resolve(DATA_DIR, "adam-dental-seed-progress.json");

const CATEGORY_DELAY_MS = 2500;

// ---------------------------------------------------------------------------
// Progress tracking
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

const adapter = new AdamDentalAdapter();

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

  const toInsert: object[] = [];
  const toUpdate: { id: string; patch: object }[] = [];
  const toTouch: string[] = [];
  const jobItems: object[] = [];

  for (const product of products) {
    const contentHash = adapter.buildContentHash(product);
    const existing = existingByUrl.get(product.url);
    const loginRequired = Boolean(
      (product.raw as Record<string, unknown> | undefined)?.login_required,
    );

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
        metadata: loginRequired ? { login_required: true } : {},
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
          metadata: loginRequired ? { login_required: true } : {},
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

  if (toInsert.length > 0) {
    const { error } = await supabase
      .from("supplier_products")
      .upsert(toInsert, {
        onConflict: "supplier_id,supplier_product_url",
        ignoreDuplicates: true,
      });
    if (error) {
      console.error("  Batch upsert failed:", error.message);
      stats.failed += toInsert.length;
      stats.created -= toInsert.length;
    }
  }

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

  if (toTouch.length > 0) {
    await supabase
      .from("supplier_products")
      .update({ last_checked_at: now, last_seen_at: now })
      .in("id", toTouch);
  }

  if (jobItems.length > 0) {
    await supabase.from("scrape_job_items").insert(jobItems);
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Ovie Compare — Adam Dental full seed");
  console.log("=====================================\n");

  let categories: CategoryInfo[];
  if (existsSync(CATEGORIES_FILE)) {
    categories = JSON.parse(readFileSync(CATEGORIES_FILE, "utf-8")) as CategoryInfo[];
    console.log(`Loaded ${categories.length} categories from ${CATEGORIES_FILE}`);
  } else {
    categories = SEED_CATEGORIES;
    console.log(
      `data/adam-dental-categories.json not found — using ${categories.length} hardcoded categories.\n` +
      `Run "npm run discover:adam-dental" first for full coverage.`,
    );
  }

  const supplierId = await getSupplierIdBySlug("adam-dental");
  console.log(`Supplier ID: ${supplierId}\n`);

  const done = loadProgress();
  const pending = categories.filter((c) => !done.has(c.path));

  if (done.size > 0) {
    console.log(`Resuming: ${done.size} categories already done, ${pending.length} remaining.\n`);
  }

  const { browser, context } = await AdamDentalAdapter.launchBrowser();
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
          done.add(category.path);
          saveProgress(done);
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

          // Only mark done if there were no upsert failures — allows retry on next run
          if (stats.failed === 0) {
            done.add(category.path);
            saveProgress(done);
          }
        }
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
      }

      if (categoryIndex < categories.length) {
        await page.waitForTimeout(CATEGORY_DELAY_MS);
      }
    }
  } finally {
    await browser.close();
  }

  console.log("\n=====================================");
  console.log("DONE");
  console.log(
    `  found=${totalStats.found}  created=${totalStats.created}  updated=${totalStats.updated}  unchanged=${totalStats.unchanged}  failed=${totalStats.failed}`,
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
