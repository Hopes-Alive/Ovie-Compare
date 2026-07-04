import type { ProductDetail } from "../types/scraper.js";
import { isPlaceholderImageUrl, type PdpDomFields } from "../lib/extract-pdp-dom-fields.js";

/** Adds/replaces a `ProductCode` query param — the existing convention for giving each
 * variant of a configurable product its own DB-unique `supplier_product_url` (see
 * `buildProductUrl` in `henry-schein/parser.ts`). Falls back to string concatenation if
 * `baseUrl` isn't a valid absolute URL. */
function withProductCodeParam(baseUrl: string, sku: string): string {
  try {
    const u = new URL(baseUrl);
    u.searchParams.set("ProductCode", sku);
    return u.toString();
  } catch {
    return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}ProductCode=${encodeURIComponent(sku)}`;
  }
}

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

/**
 * Fill gaps in a `window.products`/`data-product-data` parse with fields only
 * visible in the rendered DOM of the actual product detail page (description,
 * brand, delivery text, a higher-confidence image, and — critically — a real
 * stock signal for login-gated/APHRA-restricted products where AvailableQty
 * is never exposed). Never overwrites a value the structured parse already
 * found; only fills nulls/placeholders/"unknown".
 *
 * Exception: `domFields.loginToBuyDetected` always wins over a structured
 * price. Some SAP Commerce PDPs still carry a numeric price in the
 * `window.products`/`data-product-data` JSON even while the page visibly
 * renders a "Login to buy" CTA instead of a price for anonymous visitors —
 * that JSON number is not a real, groundable public price, so it must not
 * override or survive alongside an on-page login wall.
 */
export function mergeDomFields(
  detail: ProductDetail | null,
  domFields: PdpDomFields,
  fallbackImageCandidates: string[] = [],
): ProductDetail | null {
  if (!detail) return null;

  const description = detail.description ?? domFields.description ?? undefined;
  const brand = detail.brand ?? domFields.brandField ?? undefined;
  const deliveryText = detail.deliveryText ?? domFields.deliveryText ?? undefined;

  const currentImageOk = !isPlaceholderImageUrl(detail.imageSrc);
  const imageSrc = currentImageOk
    ? detail.imageSrc
    : (domFields.imageSrc ??
      fallbackImageCandidates.find((u) => !isPlaceholderImageUrl(u)) ??
      detail.imageSrc);

  const stockStatus =
    detail.stockStatus && detail.stockStatus !== "unknown"
      ? detail.stockStatus
      : (domFields.stockStatus ?? detail.stockStatus);

  if (domFields.loginToBuyDetected) {
    return {
      ...detail,
      description,
      brand,
      deliveryText,
      imageSrc,
      stockStatus,
      price: undefined,
      priceExGst: undefined,
      raw: { ...(detail.raw ?? {}), login_required: true },
    };
  }

  return { ...detail, description, brand, deliveryText, imageSrc, stockStatus };
}

/**
 * When `parseProductPage` is asked to resolve a specific variant SKU (e.g. a
 * size stored as its own DB row, used by live check / refresh Pass B) but
 * that SKU never appears in the page's structured `window.products` /
 * `data-product-data` (only the *parent* configurable product does — the
 * variant table is DOM-only), reconstruct a `ProductDetail` for that variant
 * from the parent's shared fields (name/brand/category/raw metadata) plus
 * the matching row of the DOM variant options table (real price/stock).
 * Returns null when no row matches the hint (e.g. a discontinued SKU).
 */
export function buildVariantMatch(
  pageProducts: ProductDetail[],
  domFields: PdpDomFields,
  skuHint: string,
): ProductDetail | null {
  const upperSku = skuHint.trim().toUpperCase();
  const row = domFields.variantRows.find((r) => r.sku === upperSku);
  const template = pageProducts[0];
  if (!row || !template) return null;

  return {
    ...template,
    externalSku: row.sku,
    externalId: row.sku,
    variantLabel: row.optionLabel ?? undefined,
    price: row.price ?? undefined,
    priceExGst: undefined,
    stockStatus: row.stockStatus ?? "unknown",
    raw: { ...(template.raw ?? {}), login_required: false, variant_sku: row.sku },
  };
}

/**
 * Expand a single PDP parse into one `ProductDetail` per row of its variant
 * options table (size/shade/pack) when the page has more than one — e.g. a
 * configurable product like gloves sold in XS–XL, each its own SKU/price/
 * stock. Returns the ordinary single-item array (via `mergeDomFields`) when
 * the page has no such table or only one row.
 *
 * The base product's own placeholder (`P-BIOGLOVE`-style parent SKU with no
 * real price) is intentionally **not** included in the output — it isn't a
 * purchasable product, so it should never reach `upsertProducts`.
 */
export function expandProductVariants(
  detail: ProductDetail | null,
  domFields: PdpDomFields,
): ProductDetail[] {
  const merged = mergeDomFields(detail, domFields);
  if (!merged) return [];
  if (domFields.variantRows.length <= 1) return [merged];

  return domFields.variantRows.map((row) => ({
    ...merged,
    externalSku: row.sku,
    externalId: row.sku,
    url: withProductCodeParam(merged.url, row.sku),
    variantLabel: row.optionLabel ?? undefined,
    price: row.price ?? undefined,
    priceExGst: undefined,
    stockStatus: row.stockStatus ?? "unknown",
    raw: { ...(merged.raw ?? {}), login_required: false, variant_sku: row.sku },
  }));
}
