import { chromium } from "playwright";
import { parsePageProducts } from "../scrapers/adam-dental/parser.js";

const sku = "P-LUXATEMPFLAMT";
const categoryUrl = `https://www.adamdental.com.au/search?ProductSearch=${encodeURIComponent(sku)}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  locale: "en-AU",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
});

await page.goto(categoryUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);

const products = await parsePageProducts(page);
const match = products.find((p) => p.externalSku === sku);

console.log(
  JSON.stringify(
    {
      productsOnPage: products.length,
      skus: products.map((p) => p.externalSku),
      match,
    },
    null,
    2,
  ),
);

await browser.close();
