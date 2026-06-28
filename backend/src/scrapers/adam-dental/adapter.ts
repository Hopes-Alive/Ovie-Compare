import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { ParseProductPageOptions, ProductDetail, SupplierAdapter } from "../../types/scraper.js";
import { buildContentHash } from "../base-adapter.js";
import {
  categoryPathFromProduct,
  extractProductCodeFromUrl,
  hasValidPrice,
  pickProductMatch,
} from "../parse-product-helpers.js";
import { parsePageProducts, cleanProductUrl } from "./parser.js";
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

function isCategoryListingUrl(url: string, categoryPath: string): boolean {
  try {
    const pathname = new URL(url).pathname.replace(/\/$/, "");
    const normalizedCategory = categoryPath.replace(/\/$/, "");
    return pathname === normalizedCategory;
  } catch {
    return false;
  }
}

export class AdamDentalAdapter implements SupplierAdapter {
  slug = "adam-dental";
  approvedDomains = ["www.adamdental.com.au", "adamdental.com.au"];

  buildContentHash(detail: ProductDetail): string {
    return buildContentHash(detail);
  }

  async parseProductPage(
    page: Page,
    pageUrl: string,
    options?: ParseProductPageOptions,
  ): Promise<ProductDetail | null> {
    const canonicalUrl = cleanProductUrl(pageUrl);
    const skuHint = options?.externalSku ?? extractProductCodeFromUrl(pageUrl);

    // 1) Product detail page — stock/name; price often hidden ("Call us!") on APHRA items.
    let match = await this.loadAndParse(page, canonicalUrl, skuHint);
    match = finalizeAdamMatch(match, canonicalUrl);
    if (hasValidPrice(match)) return match;

    // 2) Category listing — same path as seed scrape (data-product-data has NettPriceFromFirstInc).
    const categoryPath = categoryPathFromProduct(match);
    if (categoryPath && skuHint && !isCategoryListingUrl(canonicalUrl, categoryPath)) {
      const categoryUrl = `${ADAM_DENTAL_BASE}${categoryPath}`;
      const categoryMatch = await this.loadAndParse(page, categoryUrl, skuHint);
      const resolved = finalizeAdamMatch(categoryMatch, canonicalUrl);
      if (hasValidPrice(resolved) && skuMatches(resolved, skuHint)) return resolved;
      if (resolved && skuMatches(resolved, skuHint) && !match) match = resolved;
    }

    // 3) Search listing fallback.
    if (skuHint && !pageUrl.includes("ProductSearch=")) {
      const searchUrl = `${ADAM_DENTAL_BASE}/search?ProductSearch=${encodeURIComponent(skuHint)}`;
      const listingMatch = await this.loadAndParse(page, searchUrl, skuHint);
      const resolved = finalizeAdamMatch(listingMatch, canonicalUrl);
      if (hasValidPrice(resolved) && skuMatches(resolved, skuHint)) return resolved;
      if (resolved && skuMatches(resolved, skuHint) && !match) match = resolved;
    }

    return match;
  }

  private async loadAndParse(
    page: Page,
    url: string,
    skuHint?: string | null,
  ): Promise<ProductDetail | null> {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
    await page.waitForTimeout(PAGE_WAIT_MS);
    const products = await parsePageProducts(page);
    return pickProductMatch(products, url, skuHint);
  }

  /**
   * Scrape a single category using a provided Page (shared browser).
   * Clicks "Show More Products" until all products are loaded, then parses.
   * The caller is responsible for browser lifecycle.
   */
  async scrapeCategoryWithPage(
    page: Page,
    categoryPath: string,
    _maxPages?: number,
    abortCheck?: () => Promise<void>,
  ): Promise<ProductDetail[]> {
    const url = `${ADAM_DENTAL_BASE}${categoryPath}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
    await page.waitForTimeout(PAGE_WAIT_MS);

    await loadAllProducts(page, abortCheck);

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

function finalizeAdamMatch(
  match: ProductDetail | null,
  canonicalUrl: string,
): ProductDetail | null {
  if (!match) return null;
  if (!canonicalUrl.includes("ProductSearch=")) {
    return { ...match, url: canonicalUrl };
  }
  return match;
}

function skuMatches(product: ProductDetail | null, skuHint?: string | null): boolean {
  if (!product || !skuHint) return Boolean(product);
  return product.externalSku?.trim().toUpperCase() === skuHint.trim().toUpperCase();
}

/**
 * Repeatedly clicks the "Show More Products" button until it disappears
 * or the safety cap is reached, loading all products into the DOM.
 */
async function loadAllProducts(
  page: Page,
  abortCheck?: () => Promise<void>,
): Promise<void> {
  for (let i = 0; i < MAX_SHOW_MORE_CLICKS; i++) {
    if (abortCheck) await abortCheck();

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
