import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { ProductDetail, SupplierAdapter } from "../../types/scraper.js";
import { buildContentHash } from "../base-adapter.js";
import { parsePageProducts } from "./parser.js";
import { ADAM_DENTAL_BASE, SHOW_MORE_SELECTOR } from "./selectors.js";

const PAGE_WAIT_MS = 4000;
const SHOW_MORE_WAIT_MS = 2000;
const PAGE_TIMEOUT_MS = 60_000;

// Safety cap: 200 clicks × ~12 products/batch = ~2400 products per category max
const MAX_SHOW_MORE_CLICKS = 200;

const BROWSER_CONTEXT_OPTIONS = {
  locale: "en-AU",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export class AdamDentalAdapter implements SupplierAdapter {
  slug = "adam-dental";
  approvedDomains = ["www.adamdental.com.au", "adamdental.com.au"];

  buildContentHash(detail: ProductDetail): string {
    return buildContentHash(detail);
  }

  /**
   * Scrape a single category using a provided Page (shared browser).
   * Clicks "Show More Products" until all products are loaded, then parses.
   * The caller is responsible for browser lifecycle.
   */
  async scrapeCategoryWithPage(
    page: Page,
    categoryPath: string,
  ): Promise<ProductDetail[]> {
    const url = `${ADAM_DENTAL_BASE}${categoryPath}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
    await page.waitForTimeout(PAGE_WAIT_MS);

    await loadAllProducts(page);

    const products = await parsePageProducts(page);
    return deduplicateBySku(products);
  }

  /**
   * Convenience method that manages its own browser — used for single-category
   * runs or the dry-run test script.
   */
  async scrapeCategory(categoryPath: string): Promise<ProductDetail[]> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(BROWSER_CONTEXT_OPTIONS);
    const page = await context.newPage();
    try {
      return await this.scrapeCategoryWithPage(page, categoryPath);
    } finally {
      await browser.close();
    }
  }

  /**
   * Create a shared browser + context for multi-category seed runs.
   * Call browser.close() when done.
   */
  static async launchBrowser(): Promise<{ browser: Browser; context: BrowserContext }> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext(BROWSER_CONTEXT_OPTIONS);
    return { browser, context };
  }
}

/**
 * Repeatedly clicks the "Show More Products" button until it disappears
 * or the safety cap is reached, loading all products into the DOM.
 */
async function loadAllProducts(page: Page): Promise<void> {
  for (let i = 0; i < MAX_SHOW_MORE_CLICKS; i++) {
    const btn = page.locator(SHOW_MORE_SELECTOR);
    const isVisible = await btn.isVisible().catch(() => false);
    if (!isVisible) break;
    await btn.click();
    await page.waitForTimeout(SHOW_MORE_WAIT_MS);
  }
}

function deduplicateBySku(products: ProductDetail[]): ProductDetail[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    const key = p.externalSku ?? p.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
