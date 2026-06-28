const SUPPLIER_BASE: Record<string, string> = {
  "henry-schein": "https://www.henryschein.com.au",
  "adam-dental": "https://www.adamdental.com.au",
};

/** Parse image_src — comma-separated URLs or JSON array string. */
export function parseImageSrc(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];

  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } catch {
      // fall through to comma split
    }
  }

  return trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function resolveProductImageUrl(
  raw: string,
  supplierSlug?: string | null
): string {
  const url = raw.trim();
  if (!url) return "";

  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;

  const base = supplierSlug ? SUPPLIER_BASE[supplierSlug] : undefined;
  if (base && url.startsWith("/")) return `${base}${url}`;

  return url;
}

export function henryScheinImageUrlsForCode(code: string): string[] {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return [];

  const base = `${SUPPLIER_BASE["henry-schein"]}/images/ProductImages`;
  const urls = [
    `${base}/500/${normalized}.jpg`,
    `${base}/250/${normalized}.jpg`,
    `${base}/${normalized}.jpg`,
  ];

  for (let i = 2; i <= 5; i++) {
    urls.push(`${base}/500/${normalized}_${i}.jpg`);
    urls.push(`${base}/${normalized}_${i}.jpg`);
  }

  return urls;
}

/** Adam Dental product images at /Images/ProductImages/{size}/{SKU}.jpg */
export function adamDentalImageUrlsForCode(code: string): string[] {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return [];

  const base = `${SUPPLIER_BASE["adam-dental"]}/Images/ProductImages`;
  const urls: string[] = [];
  for (const size of ["500", "Medium", "250", "Small"]) {
    urls.push(`${base}/${size}/${normalized}.jpg`);
  }
  return urls;
}

function extractHenryScheinProductCode(url: string): string | null {
  const match = url.match(/ProductImages\/(?:Original|Large|Thumbnail|\d+)?\/?([^/?#]+)\.(jpg|jpeg|png)/i);
  if (!match) return null;
  return match[1].replace(/_\d+$/, "").toUpperCase();
}

function expandHenryScheinStoredUrl(url: string, externalSku?: string | null): string[] {
  if (/ProductImages\/Original\//i.test(url) || /ProductImages\/Large\//i.test(url)) {
    const code = extractHenryScheinProductCode(url) ?? externalSku ?? "";
    return henryScheinImageUrlsForCode(code);
  }
  return [url];
}

/** Build ordered unique image URLs for chat cards (primary DB value + supplier fallbacks). */
export function buildProductImageUrls(
  imageSrc: string | null | undefined,
  supplierSlug: string,
  externalSku: string | null | undefined
): string[] {
  const urls: string[] = [];

  const push = (url: string) => {
    if (url && !urls.includes(url)) urls.push(url);
  };

  if (supplierSlug === "henry-schein" && externalSku) {
    for (const url of henryScheinImageUrlsForCode(externalSku)) push(url);
  }

  if (supplierSlug === "adam-dental" && externalSku) {
    for (const url of adamDentalImageUrlsForCode(externalSku)) push(url);
  }

  for (const raw of parseImageSrc(imageSrc)) {
    const resolved = resolveProductImageUrl(raw, supplierSlug);
    if (!resolved) continue;

    const candidates =
      supplierSlug === "henry-schein"
        ? expandHenryScheinStoredUrl(resolved, externalSku)
        : [resolved];

    for (const candidate of candidates) {
      push(resolveProductImageUrl(candidate, supplierSlug));
    }
  }

  return urls;
}

/** Extract product gallery image URLs from a supplier PDP (SAP Commerce). */
export async function extractProductPageImageUrls(
  page: import("playwright").Page,
  supplierSlug: string
): Promise<string[]> {
  const selectors = [
    ".widget-product-gallery .product-detail-img",
    ".product-detail-img",
    ".widget-product-primary-image img",
    "[data-role='product-image'] img",
    "img[itemprop='image']",
  ];

  const found: string[] = [];

  for (const selector of selectors) {
    try {
      const srcs = await page.locator(selector).evaluateAll((nodes) =>
        nodes
          .map((node) => node.getAttribute("src"))
          .filter((src): src is string => Boolean(src?.trim()))
      );
      for (const src of srcs) {
        const resolved = resolveProductImageUrl(src, supplierSlug);
        if (resolved.startsWith("http") && !found.includes(resolved)) {
          found.push(resolved);
        }
      }
      if (found.length > 0) return found;
    } catch {
      // try next selector
    }
  }

  return found;
}

export async function extractProductPageImageUrl(
  page: import("playwright").Page,
  supplierSlug: string
): Promise<string | undefined> {
  const urls = await extractProductPageImageUrls(page, supplierSlug);
  return urls[0];
}
