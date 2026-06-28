import { getAdapter } from "../../scrapers/registry.js";
import type { LiveCheckProductRow, ProductCheckError } from "./types.js";

/**
 * URLs that cannot be live-checked or AI-read (search listings, not product pages).
 * Henry Schein legitimately uses ?ProductCode= on product URLs — do not block those.
 */
export function isBadProductUrl(url: string, supplierSlug?: string): boolean {
  if (url.includes("ProductSearch=")) return true;

  if (/\/search\?/i.test(url) && !url.includes("ProductCode=")) return true;

  if (url.includes("ProductCode=")) {
    return supplierSlug !== "henry-schein";
  }

  return false;
}

export function isApprovedDomain(url: string, approvedDomains: string[]): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return approvedDomains.some((domain) => {
      const d = domain.toLowerCase();
      return hostname === d || hostname.endsWith(`.${d}`);
    });
  } catch {
    return false;
  }
}

export function validateProducts(
  productIds: string[],
  rows: LiveCheckProductRow[],
): ProductCheckError[] {
  const errors: ProductCheckError[] = [];
  const foundIds = new Set(rows.map((r) => r.id));

  for (const id of productIds) {
    if (!foundIds.has(id)) {
      errors.push({ message: "Product not found or inactive", productId: id });
    }
  }

  for (const row of rows) {
    if (!row.suppliers.live_check_enabled) {
      errors.push({
        message: "Live check is disabled for this supplier",
        productId: row.id,
      });
      continue;
    }

    const url = row.supplier_product_url;
    if (isBadProductUrl(url, row.suppliers.slug)) {
      errors.push({
        message: "Product URL is not a direct product page",
        productId: row.id,
      });
      continue;
    }

    try {
      const adapter = getAdapter(row.suppliers.adapter_key);
      if (!isApprovedDomain(url, adapter.approvedDomains)) {
        errors.push({
          message: "Product URL domain is not approved",
          productId: row.id,
        });
      }
    } catch (err) {
      errors.push({
        message: err instanceof Error ? err.message : "Unknown adapter error",
        productId: row.id,
      });
    }
  }

  return errors;
}
