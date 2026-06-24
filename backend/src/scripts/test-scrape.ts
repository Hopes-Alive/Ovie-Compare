/**
 * Dry-run test — scrapes one Henry Schein category page and prints
 * cleaned products to the console. Does NOT write to the database.
 *
 * Usage:  npx tsx src/scripts/test-scrape.ts
 */
import { chromium } from "playwright";
import { parsePageProducts } from "../scrapers/henry-schein/parser.js";
import { buildContentHash } from "../scrapers/base-adapter.js";
import { HENRY_SCHEIN_BASE, SEED_CATEGORIES } from "../scrapers/henry-schein/selectors.js";

const TEST_CATEGORY = SEED_CATEGORIES[0]; // Nitrile gloves
const TEST_PAGE = 1;

async function main() {
  console.log(`\nDry-run scrape: ${TEST_CATEGORY.name}`);
  console.log(`URL: ${HENRY_SCHEIN_BASE}${TEST_CATEGORY.path}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    locale: "en-AU",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  const url =
    TEST_PAGE === 1
      ? `${HENRY_SCHEIN_BASE}${TEST_CATEGORY.path}`
      : `${HENRY_SCHEIN_BASE}${TEST_CATEGORY.path}?PageProduct=${TEST_PAGE}`;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(5000);

  const products = await parsePageProducts(page);
  await browser.close();

  if (products.length === 0) {
    console.log("No products found — site may have changed structure.");
    return;
  }

  console.log(`Found ${products.length} products on page ${TEST_PAGE}\n`);
  console.log("─".repeat(90));

  let issues = 0;

  for (const p of products) {
    const hash = buildContentHash(p);
    const priceOk = p.price !== undefined && p.price > 0;
    const urlOk = p.url.startsWith("https://");
    const nameOk = p.name.length > 3;
    const hasIssue = !priceOk || !urlOk || !nameOk;
    if (hasIssue) issues++;

    console.log([
      `SKU:      ${p.externalSku}`,
      `Name:     ${p.name}`,
      `Brand:    ${p.brand ?? "—"}`,
      `Price:    ${p.price !== undefined ? `$${p.price.toFixed(2)} (inc GST)` : "MISSING"}  ${p.priceExGst !== undefined ? `/ $${p.priceExGst.toFixed(2)} ex GST` : ""}`,
      `Stock:    ${p.stockStatus}`,
      `Category: ${p.category} > ${p.subcategory ?? "—"}`,
      `Pack:     ${p.packSize ?? "—"}`,
      `URL:      ${p.url}`,
      `Image:    ${p.imageSrc}`,
      `Hash:     ${hash.slice(0, 12)}…`,
      hasIssue ? `⚠ ISSUES: ${!nameOk ? "name " : ""}${!priceOk ? "price " : ""}${!urlOk ? "url " : ""}` : "✓ OK",
    ].join("\n"));
    console.log("─".repeat(90));
  }

  console.log(`\nSummary: ${products.length} products, ${issues} with issues`);

  // Show field coverage stats
  const withPrice = products.filter((p) => p.price !== undefined).length;
  const withBrand = products.filter((p) => p.brand !== undefined).length;
  const withPack = products.filter((p) => p.packSize !== undefined).length;
  const withRealUrl = products.filter((p) => !p.url.includes("ProductCode=")).length;
  console.log(
    `\nField coverage:\n` +
    `  price:    ${withPrice}/${products.length}\n` +
    `  brand:    ${withBrand}/${products.length}\n` +
    `  packSize: ${withPack}/${products.length}\n` +
    `  real URL: ${withRealUrl}/${products.length} (vs. fallback ProductCode URL)`,
  );
}

main().catch((e) => {
  console.error("Test scrape failed:", e);
  process.exit(1);
});
