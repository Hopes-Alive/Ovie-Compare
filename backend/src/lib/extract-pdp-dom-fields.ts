import type { Page } from "playwright";
import { extractProductPageImageUrl } from "./product-images.js";

const SELECTOR_TIMEOUT_MS = 1000;

export type DomStockStatus = "in_stock" | "out_of_stock" | "low_stock" | null;

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
};

export async function extractPdpDomFields(
  page: Page,
  supplierSlug: string,
  skuHint?: string | null,
): Promise<PdpDomFields> {
  const evaluated = await page.evaluate<EvaluatedPdpFields>(`(() => {
    const skuHint = ${JSON.stringify(skuHint?.trim().toUpperCase() ?? "")};
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

    // Variant options table: each ".data-list-item" row has a product-code
    // column and its own ".cart-product-availability" badge.
    let availabilityClass = "";
    let availabilityText = "";
    let matchedRow = null;
    if (skuHint) {
      const rows = document.querySelectorAll(".data-list-item");
      for (const row of rows) {
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

    return {
      pageTitle: clean(document.title),
      h1: clean(document.querySelector("h1")?.textContent),
      breadcrumbs,
      metaDescription,
      deliveryText,
      imageUrls: imageUrls.slice(0, 10),
      availabilityClass,
      availabilityText,
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
  };
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
