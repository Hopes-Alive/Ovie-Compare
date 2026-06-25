/**
 * Dry-run test — scrapes one category page and prints cleaned products to the
 * console without writing to the database.
 *
 * Usage:
 *   npx tsx src/scripts/test-scrape.ts                          # Henry Schein (default)
 *   npx tsx src/scripts/test-scrape.ts --supplier adam-dental   # Adam Dental
 */
import { chromium } from "playwright";
import { parsePageProducts as parseHenrySchein } from "../scrapers/henry-schein/parser.js";
import { parsePageProducts as parseAdamDental } from "../scrapers/adam-dental/parser.js";
import { buildContentHash } from "../scrapers/base-adapter.js";
import { HENRY_SCHEIN_BASE, SEED_CATEGORIES as HS_CATS } from "../scrapers/henry-schein/selectors.js";
import { ADAM_DENTAL_BASE, SEED_CATEGORIES as AD_CATS, SHOW_MORE_SELECTOR } from "../scrapers/adam-dental/selectors.js";
import type { ProductDetail } from "../types/scraper.js";

const supplierArg = process.argv.find((a) => a.startsWith("--supplier="))?.split("=")[1]
  ?? (process.argv.includes("--supplier") ? process.argv[process.argv.indexOf("--supplier") + 1] : null)
  ?? "henry-schein";

const isAdamDental = supplierArg === "adam-dental";

async function runHenrySchein(): Promise<ProductDetail[]> {
  const cat = HS_CATS[0];
  const url = `${HENRY_SCHEIN_BASE}${cat.path}`;
  console.log(`Supplier: Henry Schein`);
  console.log(`Category: ${cat.name}`);
  console.log(`URL: ${url}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    locale: "en-AU",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(5000);

  const products = await parseHenrySchein(page);
  await browser.close();
  return products;
}

async function runAdamDental(): Promise<ProductDetail[]> {
  const cat = AD_CATS[0];
  const url = `${ADAM_DENTAL_BASE}${cat.path}`;
  console.log(`Supplier: Adam Dental`);
  console.log(`Category: ${cat.name}`);
  console.log(`URL: ${url}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    locale: "en-AU",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await ctx.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(4000);

  // Click "Show More Products" until all products are loaded
  let clicks = 0;
  while (clicks < 200) {
    const btn = page.locator(SHOW_MORE_SELECTOR);
    const isVisible = await btn.isVisible().catch(() => false);
    if (!isVisible) break;
    await btn.click();
    await page.waitForTimeout(2000);
    clicks++;
  }
  if (clicks > 0) process.stdout.write(`  Clicked "Show More" ${clicks} time(s)\n`);

  const products = await parseAdamDental(page);
  await browser.close();
  return products;
}

async function main() {
  console.log("\nDry-run scrape test");
  console.log("─".repeat(90));

  const products = isAdamDental ? await runAdamDental() : await runHenrySchein();

  if (products.length === 0) {
    console.log("No products found — site may have changed structure.");
    return;
  }

  console.log(`\nFound ${products.length} products\n`);
  console.log("─".repeat(90));

  let issues = 0;

  for (const p of products) {
    const hash = buildContentHash(p);
    const priceOk = p.price !== undefined && p.price > 0;
    const urlOk = p.url.startsWith("https://");
    const nameOk = p.name.length > 3;
    const loginRequired = Boolean(
      (p.raw as Record<string, unknown> | undefined)?.login_required,
    );
    const hasIssue = (!priceOk && !loginRequired) || !urlOk || !nameOk;
    if (hasIssue) issues++;

    console.log([
      `SKU:      ${p.externalSku}`,
      `Name:     ${p.name}`,
      `Brand:    ${p.brand ?? "—"}`,
      `Price:    ${p.price !== undefined ? `$${p.price.toFixed(2)} (inc GST)` : loginRequired ? "LOGIN REQUIRED" : "MISSING"}  ${p.priceExGst !== undefined ? `/ $${p.priceExGst.toFixed(2)} ex GST` : ""}`,
      `Stock:    ${p.stockStatus}`,
      `Category: ${p.category} > ${p.subcategory ?? "—"}`,
      `Pack:     ${p.packSize ?? "—"}`,
      `URL:      ${p.url}`,
      `Image:    ${p.imageSrc ?? "—"}`,
      `Hash:     ${hash.slice(0, 12)}…`,
      hasIssue ? `ISSUES: ${!nameOk ? "name " : ""}${!priceOk && !loginRequired ? "price " : ""}${!urlOk ? "url " : ""}` : loginRequired ? "login_required" : "OK",
    ].join("\n"));
    console.log("─".repeat(90));
  }

  console.log(`\nSummary: ${products.length} products, ${issues} with issues`);

  const withPrice = products.filter((p) => p.price !== undefined).length;
  const withBrand = products.filter((p) => p.brand !== undefined).length;
  const withPack = products.filter((p) => p.packSize !== undefined).length;
  const withUrl = products.filter((p) => p.url.startsWith("https://")).length;
  const withLoginRequired = products.filter(
    (p) => Boolean((p.raw as Record<string, unknown> | undefined)?.login_required)
  ).length;
  console.log(
    `\nField coverage:\n` +
    `  price:         ${withPrice}/${products.length}\n` +
    `  brand:         ${withBrand}/${products.length}\n` +
    `  packSize:      ${withPack}/${products.length}\n` +
    `  valid URL:     ${withUrl}/${products.length}\n` +
    `  login_required:${withLoginRequired}/${products.length}`,
  );
}

main().catch((e) => {
  console.error("Test scrape failed:", e);
  process.exit(1);
});
