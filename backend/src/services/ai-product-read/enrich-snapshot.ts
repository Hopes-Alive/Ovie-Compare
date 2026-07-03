import type { Page } from "playwright";
import { parsePageProducts as parseAdamProducts } from "../../scrapers/adam-dental/parser.js";
import { parsePageProducts as parseHenryProducts } from "../../scrapers/henry-schein/parser.js";
import { getAdapter } from "../../scrapers/registry.js";
import { hasValidPrice, pickProductMatch } from "../../scrapers/parse-product-helpers.js";
import type { ProductDetail } from "../../types/scraper.js";
import type { LiveCheckProductRow } from "../live-check/types.js";
import { capturePageSnapshot, type PageSnapshot } from "./capture-page-snapshot.js";
import { referencePriceFromSnapshot } from "./validate-extraction.js";

export type EnrichedPageSnapshot = PageSnapshot & {
  parsedProduct: ProductDetail | null;
};

async function parseOnCurrentPage(
  adapterKey: string,
  page: Page,
  url: string,
  sku: string | null,
): Promise<ProductDetail | null> {
  const products =
    adapterKey === "henry_schein"
      ? await parseHenryProducts(page)
      : await parseAdamProducts(page);
  return pickProductMatch(products, url, sku);
}

function enrichParsedFromDom(parsed: ProductDetail, snapshot: PageSnapshot): ProductDetail {
  return {
    ...parsed,
    description: parsed.description ?? snapshot.description ?? undefined,
    brand: parsed.brand ?? snapshot.brandField ?? undefined,
    imageSrc: parsed.imageSrc ?? snapshot.imageUrls[0] ?? undefined,
    deliveryText: parsed.deliveryText ?? snapshot.deliveryText ?? undefined,
  };
}

/**
 * Single page load: snapshot + parse on current DOM.
 * Adapter fallbacks (extra navigations) only when price is missing.
 */
export async function captureSnapshotForProductRead(
  page: Page,
  row: LiveCheckProductRow,
): Promise<EnrichedPageSnapshot> {
  const url = row.supplier_product_url;
  const adapterKey = row.suppliers.adapter_key;
  const sku = row.external_sku;

  const snapshot = await capturePageSnapshot(page, url, row.suppliers.slug, sku);

  let parsed = await parseOnCurrentPage(adapterKey, page, url, sku);
  if (parsed) parsed = enrichParsedFromDom(parsed, snapshot);

  if (!hasValidPrice(parsed)) {
    const adapter = getAdapter(adapterKey);
    const fallback = await adapter.parseProductPage(page, url, { externalSku: sku });
    if (fallback) {
      parsed = enrichParsedFromDom(fallback, snapshot);
    }
  }

  if (referencePriceFromSnapshot(snapshot) != null) {
    return { ...snapshot, parsedProduct: parsed };
  }

  if (!parsed || !hasValidPrice(parsed)) {
    return { ...snapshot, parsedProduct: parsed };
  }

  const enrichedEntry: PageSnapshot["windowProducts"][0] = {
    ProductCode: parsed.externalSku,
    Description: parsed.name,
    PriceForOneInc: parsed.price!.toFixed(2),
    PriceForOneEx: parsed.priceExGst?.toFixed(2),
    BrandText: parsed.brand,
    CategoryHierarchy: [parsed.category, parsed.subcategory].filter(Boolean).join("/") || undefined,
  };

  const rest = snapshot.windowProducts.filter(
    (entry) => entry.ProductCode?.toUpperCase() !== parsed!.externalSku?.toUpperCase(),
  );

  return {
    ...snapshot,
    windowProducts: [enrichedEntry, ...rest],
    loginHint: false,
    parsedProduct: parsed,
  };
}
