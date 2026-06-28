/**
 * Full Adam Dental seed — scrapes all discovered categories and upserts
 * products into Supabase.
 */

import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { supabase } from "../lib/supabase.js";
import { AdamDentalAdapter } from "../scrapers/adam-dental/adapter.js";
import { SEED_CATEGORIES } from "../scrapers/adam-dental/selectors.js";
import type { CategoryInfo } from "../scrapers/adam-dental/category-crawler.js";
import type { ScrapeStats } from "../types/scraper.js";
import { getSupplierIdBySlug } from "../services/scrape/scrape-job.js";
import { loadProgressSet, saveProgressSet } from "../services/scrape/progress-file.js";
import { upsertProducts } from "../services/scrape/upsert-products.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../data");
const CATEGORIES_FILE = resolve(DATA_DIR, "adam-dental-categories.json");
const PROGRESS_FILE = resolve(DATA_DIR, "adam-dental-seed-progress.json");

const CATEGORY_DELAY_MS = 2500;
const adapter = new AdamDentalAdapter();

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

  const done = loadProgressSet(PROGRESS_FILE);
  const pending = categories.filter((c) => !done.has(c.path));

  if (done.size > 0) {
    console.log(`Resuming: ${done.size} categories already done, ${pending.length} remaining.\n`);
  }

  const { browser, context } = await AdamDentalAdapter.launchBrowser();
  const page = await context.newPage();

  const totalStats: ScrapeStats = {
    found: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
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
          saveProgressSet(PROGRESS_FILE, done);
        } else {
          console.log(`  Scraped ${products.length} products — upserting…`);
          const stats = await upsertProducts({
            supplierId,
            products,
            jobId: job.id as string,
            buildContentHash: adapter.buildContentHash.bind(adapter),
            priceHistorySource: "manual",
          });
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

          if (stats.failed === 0) {
            done.add(category.path);
            saveProgressSet(PROGRESS_FILE, done);
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
