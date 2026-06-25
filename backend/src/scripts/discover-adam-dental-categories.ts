/**
 * Discovers all product-listing leaf categories from Adam Dental and saves
 * them to data/adam-dental-categories.json.
 *
 * Usage: npm run discover:adam-dental
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { crawlCategories } from "../scrapers/adam-dental/category-crawler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../data");
const OUTPUT_FILE = resolve(DATA_DIR, "adam-dental-categories.json");

async function main() {
  console.log("Ovie Compare — Adam Dental category discovery");
  console.log("=============================================\n");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "en-AU",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  let categories;
  try {
    categories = await crawlCategories(browser);
  } finally {
    await browser.close();
  }

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(categories, null, 2), "utf-8");

  console.log(`\nSaved ${categories.length} leaf categories to ${OUTPUT_FILE}`);
  console.log("\nSample (first 10):");
  categories.slice(0, 10).forEach((c) => console.log(`  ${c.path}  (${c.name})`));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
