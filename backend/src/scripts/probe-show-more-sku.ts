import { chromium } from "playwright";
import { AdamDentalAdapter } from "../scrapers/adam-dental/adapter.js";
import { parsePageProducts } from "../scrapers/adam-dental/parser.js";
import { ADAM_DENTAL_BASE, SHOW_MORE_SELECTOR } from "../scrapers/adam-dental/selectors.js";

const sku = "P-LUXATEMPFLAMT";
const categoryPath = "/crown-and-bridge/temporary-material";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  locale: "en-AU",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
});

await page.goto(`${ADAM_DENTAL_BASE}${categoryPath}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);

for (let i = 0; i < 30; i++) {
  const products = await parsePageProducts(page);
  const match = products.find((p) => p.externalSku === sku);
  if (match) {
    console.log(JSON.stringify({ clicks: i, match }, null, 2));
    await browser.close();
    process.exit(0);
  }
  const btn = page.locator(SHOW_MORE_SELECTOR);
  if (!(await btn.isVisible().catch(() => false))) break;
  await btn.click();
  await page.waitForTimeout(2000);
}

console.log("SKU not found after show-more");
await browser.close();
