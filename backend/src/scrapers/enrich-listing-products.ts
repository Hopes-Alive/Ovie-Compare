import type { Page } from "playwright";
import type { ProductDetail } from "../types/scraper.js";
import { extractPdpDomFields } from "../lib/extract-pdp-dom-fields.js";
import { expandProductVariants } from "./parse-product-helpers.js";

const DEFAULT_DELAY_MS = 600;
const PAGE_TIMEOUT_MS = 30_000;
const PAGE_WAIT_MS = 1200;

export type EnrichPdpOptions = {
  /** Cap how many products (of the ones passed in) get a PDP visit. */
  limit?: number;
  /** Delay between product page visits — be polite to the supplier site. */
  delayMs?: number;
  onProgress?: (done: number, total: number, product: ProductDetail) => void;
  abortCheck?: () => Promise<void>;
};

/**
 * Opt-in enrichment step for bulk category scrapes: visits each product's own
 * detail page and merges in description/brand/image/login-required-stock via
 * the same DOM extraction used by live check. This is what makes a "full
 * crawl" as accurate as a live check for every product, at the cost of one
 * extra page load per product — call with a `limit` first to test quality
 * and timing on a handful of products before running it across a whole
 * category or supplier.
 *
 * Also **expands** configurable products (size/shade/pack variant tables)
 * into one entry per variant — see `expandProductVariants` in
 * `parse-product-helpers.ts`. The output array can be longer than the input:
 * a single parent listing (e.g. gloves with no listed price) can become N
 * priced/stocked variant rows, and the parent's own unpurchasable placeholder
 * is dropped from the result.
 */
export async function enrichProductsWithPdpFields(
  page: Page,
  products: ProductDetail[],
  supplierSlug: string,
  options: EnrichPdpOptions = {},
): Promise<ProductDetail[]> {
  const { limit, delayMs = DEFAULT_DELAY_MS, onProgress, abortCheck } = options;
  const targets = limit != null ? products.slice(0, limit) : products;
  const enrichedByUrl = new Map<string, ProductDetail[]>();

  for (let i = 0; i < targets.length; i++) {
    if (abortCheck) await abortCheck();
    const product = targets[i]!;

    try {
      await page.goto(product.url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
      await page.waitForTimeout(PAGE_WAIT_MS);
      const domFields = await extractPdpDomFields(page, supplierSlug, product.externalSku);
      enrichedByUrl.set(product.url, expandProductVariants(product, domFields));
    } catch {
      // Leave this product as originally listed — one bad page shouldn't fail the batch.
    }

    onProgress?.(i + 1, targets.length, product);
    if (delayMs > 0 && i < targets.length - 1) {
      await page.waitForTimeout(delayMs);
    }
  }

  return products.flatMap((product) => enrichedByUrl.get(product.url) ?? [product]);
}
