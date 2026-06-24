import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { ProductDetail, SupplierAdapter } from "../../types/scraper.js";
import { buildContentHash } from "../base-adapter.js";
import { parsePageProducts } from "./parser.js";
import { HENRY_SCHEIN_BASE } from "./selectors.js";

const PAGE_WAIT_MS = 4000;
const PAGE_DELAY_MS = 800;
const PAGE_TIMEOUT_MS = 60_000;

const BROWSER_CONTEXT_OPTIONS = {
  locale: "en-AU",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export class HenryScheinAdapter implements SupplierAdapter {
  slug = "henry-schein";
  approvedDomains = ["www.henryschein.com.au", "henryschein.com.au"];

  buildContentHash(detail: ProductDetail): string {
    return buildContentHash(detail);
  }

  /**
   * Scrape a single category using a provided Page (shared browser).
   * The caller is responsible for browser lifecycle.
   */
  async scrapeCategoryWithPage(
    page: Page,
    categoryPath: string,
  ): Promise<ProductDetail[]> {
    const results: ProductDetail[] = [];
    let pageNum = 1;
    let emptyPages = 0;

    while (emptyPages < 2) {
      const url =
        pageNum === 1
          ? `${HENRY_SCHEIN_BASE}${categoryPath}`
          : `${HENRY_SCHEIN_BASE}${categoryPath}?PageProduct=${pageNum}`;

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
      await page.waitForTimeout(PAGE_WAIT_MS);

      const products = await parsePageProducts(page);

      if (products.length === 0) {
        emptyPages++;
      } else {
        emptyPages = 0;
        results.push(...products);
        process.stdout.write(`    page ${pageNum}: ${products.length} products\n`);
      }

      pageNum++;
      await page.waitForTimeout(PAGE_DELAY_MS);
    }

    return deduplicateBySku(results);
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

function deduplicateBySku(products: ProductDetail[]): ProductDetail[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    const key = p.externalSku ?? p.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
