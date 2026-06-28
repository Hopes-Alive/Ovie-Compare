import { chromium } from "playwright";

const sku = "P-LUXATEMPFLAMT";
const searchUrl = `https://www.adamdental.com.au/search?ProductSearch=${encodeURIComponent(sku)}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  locale: "en-AU",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
});

await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(4000);

const data = await page.evaluate((targetSku) => {
  const card = document.querySelector(`[data-role='product'][data-product-code='${targetSku}']`);
  const raw = card?.getAttribute("data-product-data");
  let pricing = null;
  try {
    pricing = raw ? JSON.parse(raw)[0] : null;
  } catch {
    /* ignore */
  }
  const wp = (window as unknown as { products?: unknown[] }).products;
  return { href: location.href, cardFound: !!card, pricing, wp };
}, sku);

console.log(JSON.stringify(data, null, 2));
await browser.close();
