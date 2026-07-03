import type { Page } from "playwright";
import { extractPdpDomFields } from "../../lib/extract-pdp-dom-fields.js";

const PAGE_WAIT_MS = 1500;
const PAGE_TIMEOUT_MS = 60_000;
const MAX_TEXT_CHARS = 5000;
const MAX_WINDOW_PRODUCTS = 5;

export type WindowProductEntry = {
  ProductCode?: string;
  Description?: string;
  PriceForOneInc?: string;
  PriceForOneEx?: string;
  AvailableQty?: string | number;
  CategoryHierarchy?: string;
  BrandText?: string;
  [key: string]: unknown;
};

export type PageSnapshot = {
  url: string;
  pageText: string;
  windowProducts: WindowProductEntry[];
  loginHint: boolean;
  pageTitle: string | null;
  h1: string | null;
  breadcrumbs: string[];
  description: string | null;
  brandField: string | null;
  deliveryText: string | null;
  metaDescription: string | null;
  imageUrls: string[];
  domProductData: unknown[];
};

export async function capturePageSnapshot(
  page: Page,
  url: string,
  supplierSlug: string,
  skuHint?: string | null,
): Promise<PageSnapshot> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
  await page
    .waitForFunction(
      () => {
        const w = window as unknown as { products?: unknown[] };
        return (w.products?.length ?? 0) > 0 || document.querySelector("h1") != null;
      },
      { timeout: 4000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(PAGE_WAIT_MS);

  const domFields = await extractPdpDomFields(page, supplierSlug, skuHint);

  const captured = await page.evaluate(
    ({ maxChars, maxProducts }) => {
      const text = document.body?.innerText ?? "";
      const products =
        (window as unknown as { products?: WindowProductEntry[] }).products ?? [];
      const loginHint = /call us|login to see|sign in to see|sign in for price/i.test(text);

      const domProductData: unknown[] = [];
      document
        .querySelectorAll<HTMLElement>("[data-role='product'][data-product-data]")
        .forEach((card) => {
          const raw = card.getAttribute("data-product-data") ?? "[]";
          try {
            const arr = JSON.parse(raw) as unknown[];
            if (Array.isArray(arr)) domProductData.push(...arr.slice(0, 3));
          } catch {
            // skip
          }
        });

      return {
        pageText: text.slice(0, maxChars),
        windowProducts: products.slice(0, maxProducts),
        loginHint,
        domProductData: domProductData.slice(0, 5),
      };
    },
    { maxChars: MAX_TEXT_CHARS, maxProducts: MAX_WINDOW_PRODUCTS },
  );

  return {
    url,
    pageText: captured.pageText,
    windowProducts: captured.windowProducts,
    loginHint: captured.loginHint,
    pageTitle: domFields.pageTitle,
    h1: domFields.h1,
    breadcrumbs: domFields.breadcrumbs,
    description: domFields.description,
    brandField: domFields.brandField,
    deliveryText: domFields.deliveryText,
    metaDescription: domFields.metaDescription,
    imageUrls: domFields.imageSrc ? [domFields.imageSrc] : [],
    domProductData: captured.domProductData,
  };
}
