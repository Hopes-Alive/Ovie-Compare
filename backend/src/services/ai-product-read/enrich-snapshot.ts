import type { Page } from "playwright";
import { getAdapter } from "../../scrapers/registry.js";
import { hasValidPrice } from "../../scrapers/parse-product-helpers.js";
import type { LiveCheckProductRow } from "../live-check/types.js";
import { capturePageSnapshot, type PageSnapshot } from "./capture-page-snapshot.js";
import { referencePriceFromSnapshot } from "./validate-extraction.js";

/**
 * Capture page text for the LLM. When the PDP hides price ("Call us!"), fall back to
 * the supplier adapter parse path (category listing) so window.products includes
 * the same pricing the seed scrape uses.
 */
export async function captureSnapshotForProductRead(
  page: Page,
  row: LiveCheckProductRow,
): Promise<PageSnapshot> {
  const url = row.supplier_product_url;
  const snapshot = await capturePageSnapshot(page, url);

  if (referencePriceFromSnapshot(snapshot) != null) {
    return snapshot;
  }

  const adapter = getAdapter(row.suppliers.adapter_key);
  const parsed = await adapter.parseProductPage(page, url, {
    externalSku: row.external_sku,
  });

  if (!hasValidPrice(parsed)) {
    return snapshot;
  }

  const enrichedEntry = {
    ProductCode: parsed!.externalSku,
    Description: parsed!.name,
    PriceForOneInc: parsed!.price!.toFixed(2),
    PriceForOneEx: parsed!.priceExGst?.toFixed(2),
  };

  const rest = snapshot.windowProducts.filter(
    (entry) => entry.ProductCode?.toUpperCase() !== parsed!.externalSku?.toUpperCase(),
  );

  return {
    ...snapshot,
    windowProducts: [enrichedEntry, ...rest],
    loginHint: false,
  };
}
