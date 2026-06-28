import type { ProductDetail } from "../types/scraper.js";

export type ParseProductPageOptions = {
  externalSku?: string | null;
};

export function extractProductCodeFromUrl(url: string): string | undefined {
  try {
    const code = new URL(url).searchParams.get("ProductCode");
    return code?.trim().toUpperCase() || undefined;
  } catch {
    return undefined;
  }
}

export function hasValidPrice(product: ProductDetail | null | undefined): boolean {
  return product?.price != null && product.price > 0;
}

export function pickProductMatch(
  products: ProductDetail[],
  pageUrl: string,
  skuHint?: string | null,
): ProductDetail | null {
  if (products.length === 0) return null;

  const sku = skuHint?.trim().toUpperCase() ?? extractProductCodeFromUrl(pageUrl);
  if (sku) {
    const bySku = products.find((p) => p.externalSku?.trim().toUpperCase() === sku);
    if (bySku) return bySku;
    // Never fall back to another product when the caller supplied a SKU.
    if (skuHint) return null;
  }

  return (
    products.find((p) => p.url === pageUrl || pageUrl.includes(p.externalSku ?? "")) ??
    products[0] ??
    null
  );
}

/** Adam Dental category URLs mirror CategoryHierarchy segments from window.products. */
export function categoryPathFromHierarchy(hierarchy: string | undefined | null): string | null {
  if (!hierarchy?.trim()) return null;

  const slugPath = hierarchy
    .split("/")
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .replace(/\s*&\s*/g, "-and-")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join("/");

  return slugPath ? `/${slugPath}` : null;
}

export function categoryPathFromProduct(
  product: ProductDetail | null | undefined,
): string | null {
  const hierarchy = (product?.raw as { CategoryHierarchy?: string } | undefined)?.CategoryHierarchy;
  return categoryPathFromHierarchy(hierarchy);
}
