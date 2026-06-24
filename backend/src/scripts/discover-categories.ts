/**
 * One-time discovery script — crawls Henry Schein navigation and saves
 * all discovered category paths to data/henry-schein-categories.json.
 *
 * Run:  npm run discover:henry-schein
 *
 * The output file is read by seed-henry-schein.ts.
 * Re-run this script whenever the site navigation changes.
 */

import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { crawlCategories } from "../scrapers/henry-schein/category-crawler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../../data/henry-schein-categories.json");

async function main() {
  console.log("Henry Schein — category discovery");
  console.log("==================================\n");

  const browser = await chromium.launch({ headless: true });

  try {
    const all = await crawlCategories(browser);

    // Keep only leaf categories — paths that have no sub-paths in the list.
    // These are the actual product listing pages; parent paths just re-list
    // the same products already covered by their children.
    const leaves = all.filter(
      (c) => !all.some((other) => other.path.startsWith(c.path + "/")),
    );

    console.log(`\nDiscovered: ${all.length} total, ${leaves.length} leaf categories\n`);
    for (const c of leaves) {
      console.log(`  ${c.path.padEnd(65)} ${c.name}`);
    }

    mkdirSync(resolve(__dirname, "../../data"), { recursive: true });
    writeFileSync(OUTPUT_PATH, JSON.stringify(leaves, null, 2), "utf-8");

    console.log(`\nSaved ${leaves.length} categories → ${OUTPUT_PATH}`);
    console.log("\nRun: npm run seed:henry-schein");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("Discovery failed:", e);
  process.exit(1);
});
