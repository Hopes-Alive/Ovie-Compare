import type { Page } from "playwright";
import { extractProductPageImageUrl } from "./product-images.js";

const SELECTOR_TIMEOUT_MS = 1000;

export type DomStockStatus = "in_stock" | "out_of_stock" | "low_stock" | null;

/** One row of a PDP's "Product Code / Size / Availability / Price" variant options table. */
export type VariantRow = {
  sku: string;
  optionLabel: string | null;
  price: number | null;
  stockStatus: DomStockStatus;
};

export type PdpDomFields = {
  pageTitle: string | null;
  h1: string | null;
  breadcrumbs: string[];
  description: string | null;
  brandField: string | null;
  deliveryText: string | null;
  metaDescription: string | null;
  imageSrc: string | null;
  stockStatus: DomStockStatus;
  /**
   * True when the rendered page shows an unambiguous "Login to buy" / "Call
   * us for price" CTA. Some SAP Commerce PDPs still carry a numeric price in
   * `window.products` / `data-product-data` even while the template hides it
   * behind this CTA for anonymous visitors — the DOM text is ground truth for
   * what a real (non-logged-in) visitor actually sees, so a positive match
   * here must override any structured price the JSON parse found.
   */
  loginToBuyDetected: boolean;
  /**
   * All rows of the variant options table, when this PDP has more than one
   * (a genuine configurable product — size/shade/pack). Empty when the page
   * has no such table or only a single row.
   */
  variantRows: VariantRow[];
};

/** Reject obviously-generic placeholder/logo images picked up by broad selectors. */
export function isPlaceholderImageUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  return /placeholder|no[-_]?image|coming[-_]?soon/i.test(url);
}

async function locatorText(
  page: Page,
  selector: string,
  minLength = 1,
): Promise<string | undefined> {
  try {
    const text = await page.locator(selector).first().textContent({ timeout: SELECTOR_TIMEOUT_MS });
    const cleaned = text
      ?.replace(/_{2,}/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned && cleaned.length >= minLength ? cleaned : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract PDP fields from SAP Commerce product detail pages (Henry Schein +
 * Adam Dental). `skuHint` scopes stock-availability lookup to the correct
 * variant row on pages that render a "Product Code / Availability / Price"
 * options table for multiple SKUs (sizes, shades, pack sizes) — grabbing the
 * first `.cart-product-availability` badge on such pages would silently
 * attribute a sibling variant's stock to the wrong product.
 */
type EvaluatedPdpFields = {
  pageTitle: string | null;
  h1: string | null;
  breadcrumbs: string[];
  metaDescription: string | null;
  deliveryText: string | null;
  imageUrls: string[];
  availabilityClass: string;
  availabilityText: string;
  loginToBuyDetected: boolean;
  variantRows: { sku: string; optionLabel: string | null; priceText: string | null; availabilityText: string | null }[];
};

// Distinctive CTA phrases SAP Commerce templates render in place of a price
// for anonymous/APHRA-restricted visitors. Matched only against short, leaf
// text nodes so we don't false-positive on unrelated body copy.
const LOGIN_TO_BUY_PATTERN = /login to buy|call (?:us )?for price|call us!?$/i;
const LOGIN_TO_BUY_MAX_TEXT_LENGTH = 40;

export async function extractPdpDomFields(
  page: Page,
  supplierSlug: string,
  skuHint?: string | null,
): Promise<PdpDomFields> {
  const evaluated = await page.evaluate<EvaluatedPdpFields>(`(() => {
    const skuHint = ${JSON.stringify(skuHint?.trim().toUpperCase() ?? "")};
    const loginToBuyRe = new RegExp(${JSON.stringify(LOGIN_TO_BUY_PATTERN.source)}, "i");
    const clean = (raw) => (raw ? String(raw).replace(/_{2,}/g, " ").replace(/\\s+/g, " ").trim() : null);
    const breadcrumbs = Array.from(
      document.querySelectorAll(".breadcrumb a, .breadcrumbs a, nav[aria-label='breadcrumb'] a"),
    )
      .map((el) => clean(el.textContent))
      .filter(Boolean);
    const metaDescription =
      document.querySelector("meta[name='description']")?.content?.trim() || null;
    const deliveryText =
      clean(
        document.querySelector(".widget-product-field-Delivery, .delivery-info, [data-field='Delivery']")
          ?.textContent,
      ) || null;
    const imageUrls = [];
    document
      .querySelectorAll(".product-detail-img, .widget-product-gallery img, img[itemprop='image'], [data-role='product'] img")
      .forEach((img) => {
        const src = img.getAttribute("src") || img.getAttribute("data-image-src") || img.getAttribute("data-src");
        if (src && src.trim()) imageUrls.push(src.trim());
      });

    // Variant options table: each ".data-list-item" row (excluding the
    // ".data-list-heading" header row) has a product-code column, an option
    // label (size/shade — the one cv-data-zone-2 cell with no special
    // class), a ".cart-product-availability" badge, and a "price-right"
    // price cell (excluding the "Total" column, which is qty-dependent).
    const dataRows = Array.from(document.querySelectorAll(".data-list-item:not(.data-list-heading)"));
    const variantRows = dataRows.map((row) => {
      const codeCell = row.querySelector(".cv-data-zone-1 .data-list-column:not(.image-column)");
      const sku = clean(codeCell && codeCell.textContent) || "";
      const zone2Cells = Array.from(row.querySelectorAll(".cv-data-zone-2 .data-list-column"));
      let optionLabel = null;
      let priceText = null;
      for (const cell of zone2Cells) {
        const cls = cell.className || "";
        if (/\\bAvailability\\b/.test(cls) || /\\bQty\\b/.test(cls)) continue;
        if (/price-right/.test(cls)) {
          if (!/Total/i.test(cls) && priceText === null) priceText = clean(cell.textContent);
          continue;
        }
        if (optionLabel === null) optionLabel = clean(cell.textContent);
      }
      const avail = row.querySelector(".cart-product-availability");
      const availabilityText = avail ? clean(avail.textContent) : null;
      return { sku, optionLabel, priceText, availabilityText };
    }).filter((r) => r.sku);

    let availabilityClass = "";
    let availabilityText = "";
    let matchedRow = null;
    if (skuHint) {
      for (const row of dataRows) {
        const codeCell = row.querySelector(".cv-data-zone-1 .data-list-column:not(.image-column)");
        const code = clean(codeCell && codeCell.textContent);
        if (code && code.toUpperCase() === skuHint) {
          matchedRow = row;
          break;
        }
      }
    }
    if (matchedRow) {
      const avail = matchedRow.querySelector(".cart-product-availability");
      if (avail) {
        availabilityClass = avail.className;
        availabilityText = clean(avail.textContent) || "";
      }
    } else {
      // No variant table (or no row matched) — only trust a page-level badge
      // when it's unambiguous (exactly one candidate on the page).
      const allAvail = document.querySelectorAll(".cart-product-availability, [class*='product-availability']");
      if (allAvail.length === 1) {
        availabilityClass = allAvail[0].className;
        availabilityText = clean(allAvail[0].textContent) || "";
      }
    }

    let loginToBuyDetected = false;
    const allEls = document.querySelectorAll("a, button, span, div, p");
    for (const el of allEls) {
      if (el.children.length > 0) continue;
      const text = clean(el.textContent);
      if (text && text.length <= ${LOGIN_TO_BUY_MAX_TEXT_LENGTH} && loginToBuyRe.test(text)) {
        loginToBuyDetected = true;
        break;
      }
    }

    return {
      pageTitle: clean(document.title),
      h1: clean(document.querySelector("h1")?.textContent),
      breadcrumbs,
      metaDescription,
      deliveryText,
      imageUrls: imageUrls.slice(0, 10),
      availabilityClass,
      availabilityText,
      loginToBuyDetected,
      variantRows,
    };
  })()`);

  const description = await locatorText(page, ".widget-product-field-ProductDescription", 15);
  const brandField = await locatorText(page, ".widget-product-field-CUS_BrandText", 1);
  const rawImageSrc =
    (await extractProductPageImageUrl(page, supplierSlug)) ??
    evaluated.imageUrls[0] ??
    null;
  const imageSrc = isPlaceholderImageUrl(rawImageSrc) ? null : rawImageSrc;

  return {
    pageTitle: evaluated.pageTitle,
    h1: evaluated.h1,
    breadcrumbs: evaluated.breadcrumbs,
    description: description ?? null,
    brandField: brandField ?? null,
    deliveryText: evaluated.deliveryText,
    metaDescription: evaluated.metaDescription,
    imageSrc,
    stockStatus: classifyAvailability(evaluated.availabilityClass, evaluated.availabilityText),
    loginToBuyDetected: evaluated.loginToBuyDetected,
    variantRows: evaluated.variantRows.map((r) => ({
      sku: r.sku.toUpperCase(),
      optionLabel: r.optionLabel,
      price: cleanVariantPriceText(r.priceText),
      stockStatus: classifyAvailability("", r.availabilityText),
    })),
  };
}

/** Parse a variant-table price cell ("$7.95"); rejects non-numeric placeholders like "Call us!". */
function cleanVariantPriceText(raw: string | null | undefined): number | null {
  if (!raw) return null;
  if (/[a-zA-Z!?]/.test(raw.replace(/\binc\b|\bex\b|\bgst\b/gi, ""))) return null;
  const digits = raw.replace(/[^0-9.]/g, "");
  const value = parseFloat(digits);
  return Number.isNaN(value) || value <= 0 ? null : value;
}

/** Classify the SAP Commerce "cart-product-availability" widget into our stock enum. */
function classifyAvailability(className: string, text: string | null): DomStockStatus {
  const haystack = `${className} ${text ?? ""}`.toLowerCase();
  if (!haystack.trim()) return null;
  if (/out-of-stock|out of stock|unavailable|sold-out|sold out/.test(haystack)) return "out_of_stock";
  if (/low-stock|low stock|limited stock|backorder|back-order/.test(haystack)) return "low_stock";
  if (/in-stock|in stock|available/.test(haystack)) return "in_stock";
  return null;
}
