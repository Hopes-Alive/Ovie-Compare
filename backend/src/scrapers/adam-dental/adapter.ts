import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { ParseProductPageOptions, ProductDetail, SupplierAdapter } from "../../types/scraper.js";
import { buildContentHash } from "../base-adapter.js";
import { extractPdpDomFields } from "../../lib/extract-pdp-dom-fields.js";
import { adamDentalImageUrlsForCode } from "../../lib/product-images.js";
import {
  buildVariantMatch,
  categoryPathFromProduct,
  extractProductCodeFromUrl,
  hasValidPrice,
  mergeDomFields,
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
    const imageCandidates = skuHint ? adamDentalImageUrlsForCode(skuHint) : [];

    // 1) Product detail page — stock/name; price often hidden ("Call us!") on APHRA items.
    const { products: pageProducts, match: initialMatch } = await this.loadAndParse(
      page,
      canonicalUrl,
      skuHint,
    );
    // Capture rich DOM fields (description, brand, real stock signal, gallery
    // image) while still on the canonical PDP — steps 2/3 below land on
    // category/search listings that don't carry per-product detail.
    const domFields = await extractPdpDomFields(page, this.slug, skuHint);
    // A requested variant SKU (e.g. a size) never appears in window.products —
    // only the parent configurable product does — so fall back to the DOM
    // variant options table, which carries that row's real price/stock.
    let match =
      initialMatch ?? (skuHint ? buildVariantMatch(pageProducts, domFields, skuHint) : null);
    match = mergeDomFields(match, domFields, imageCandidates);
    match = finalizeAdamMatch(match, canonicalUrl);
    if (hasValidPrice(match)) return match;
    // Confirmed on-page login wall — no fallback URL can produce a trustworthy
    // public price for this product, so don't bother trying.
    if (domFields.loginToBuyDetected) return match;

    // 2) Category listing — same path as seed scrape (data-product-data has NettPriceFromFirstInc).
    const categoryPath = categoryPathFromProduct(match);
    if (categoryPath && skuHint && !isCategoryListingUrl(canonicalUrl, categoryPath)) {
      const categoryUrl = `${ADAM_DENTAL_BASE}${categoryPath}`;
      const { match: categoryMatch } = await this.loadAndParse(page, categoryUrl, skuHint);
      const resolved = finalizeAdamMatch(
        mergeDomFields(categoryMatch, domFields, imageCandidates),
        canonicalUrl,
      );
      if (hasValidPrice(resolved) && skuMatches(resolved, skuHint)) return resolved;
      if (resolved && skuMatches(resolved, skuHint) && !match) match = resolved;
    }

    // 3) Search listing fallback.
    if (skuHint && !pageUrl.includes("ProductSearch=")) {
      const searchUrl = `${ADAM_DENTAL_BASE}/search?ProductSearch=${encodeURIComponent(skuHint)}`;
      const { match: listingMatch } = await this.loadAndParse(page, searchUrl, skuHint);
      const resolved = finalizeAdamMatch(
        mergeDomFields(listingMatch, domFields, imageCandidates),
        canonicalUrl,
      );
      if (hasValidPrice(resolved) && skuMatches(resolved, skuHint)) return resolved;
      if (resolved && skuMatches(resolved, skuHint) && !match) match = resolved;
    }

    return match;
  }

  private async loadAndParse(
    page: Page,
    url: string,
    skuHint?: string | null,
  ): Promise<{ products: ProductDetail[]; match: ProductDetail | null }> {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
    await page.waitForTimeout(PAGE_WAIT_MS);
    const products = await parsePageProducts(page);
    return { products, match: pickProductMatch(products, url, skuHint) };
  }

  /**
   * Scrape a single category using a provided Page (shared browser).
   * Clicks "Show More Products" until all products are loaded, then parses.
   * The caller is responsible for browser lifecycle.
   *
   * This is listing-only (fast) — for full PDP-level enrichment (description/
   * brand/image/real login-required stock), see
   * `enrichProductsWithPdpFields` in `scrapers/enrich-listing-products.ts`,
   * used as an explicit opt-in step by the seed scripts.
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
