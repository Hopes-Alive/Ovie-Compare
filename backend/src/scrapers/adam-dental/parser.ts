import type { Page } from "playwright";
import type { ProductDetail } from "../../types/scraper.js";
import { ADAM_DENTAL_BASE } from "./selectors.js";

// -------------------------------------------------------------------
// Raw shapes from the page
// -------------------------------------------------------------------

interface RawWindowProduct {
  Description?: string;
  ProductCode?: string;
  PriceForOneInc?: string;
  PriceForOneEx?: string;
  CategoryHierarchy?: string;
  BrandText?: string;
  Index?: number;
}

// Subset of the data-product-data array element we care about
interface RawProductData {
  ProductCode?: string;
  NettPriceFromFirstInc?: string;
  NettPriceFromFirstEx?: string;
  ImageFileName?: string;
  AvailableQty?: number;
  AllowOrderEntryForProduct?: boolean;
}

// -------------------------------------------------------------------
// Data cleaners — same patterns as Henry Schein
// -------------------------------------------------------------------

function cleanText(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const s = raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s.length > 0 ? s : undefined;
}

function cleanPrice(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  // Reject non-price strings like "Call us!", "POA", "N/A"
  if (/[a-zA-Z!?]/.test(raw.replace(/\binc\b|\bex\b|\bgst\b/gi, ""))) {
    return undefined;
  }
  const digits = raw.replace(/[^0-9.]/g, "");
  const value = parseFloat(digits);
  return isNaN(value) || value <= 0 ? undefined : value;
}

function cleanBrand(raw: string | undefined | null): string | undefined {
  const t = cleanText(raw);
  if (!t || t.toLowerCase() === "n/a" || t === "-") return undefined;
  if (t === t.toUpperCase() && t.length > 2) {
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }
  return t;
}

const CARTON_X_PATTERN = /\bCarton\s+(\d+)\s*x\s*(\d+)\b|\b(\d+)\s*x\s*(\d+)\b/i;
const DASH_PACK_PATTERN = /\b(\d+)[-\s]Pack\b/i;
const BOX_OF_PATTERN = /\b(?:box|carton)\s+of\s+(\d+)\b/i;
const SLASH_PK_PATTERN = /(\d+)\s*\/\s*(?:pk|box|bx|carton|ctn)\b/i;

function extractPackSize(name: string): string | undefined {
  const carton = name.match(CARTON_X_PATTERN);
  if (carton) {
    const a = carton[1] ?? carton[3];
    const b = carton[2] ?? carton[4];
    return `${a} x ${b}`;
  }
  const dashPack = name.match(DASH_PACK_PATTERN);
  if (dashPack) return dashPack[1];
  const boxOf = name.match(BOX_OF_PATTERN);
  if (boxOf) return boxOf[1];
  const slashPk = name.match(SLASH_PK_PATTERN);
  if (slashPk) return slashPk[1];
  return undefined;
}

const KNOWN_BRANDS = [
  "3M", "3M Solventum",
  "Acteon", "ADM", "Anaxdent", "Ansell", "Asiga",
  "Brasseler",
  "Candulor", "Coltene", "Colgate", "Curasept", "Cybertech",
  "DenTek", "Dentsply", "Dentsply Sirona", "Desktop Health", "DMG", "Durr",
  "EMS",
  "Formlabs",
  "GC", "GSK", "GlaxoSmithKline",
  "Haleon", "Henry Schein", "Heraeus", "Hu-Friedy", "Hu Friedy",
  "Intensiv", "Ivoclar",
  "Kerr", "Keystone", "Komet", "Kuraray",
  "Mectron", "Medilab", "Meisinger", "Microflex",
  "Nextdent", "Noritake", "NSK",
  "Oral-B", "Ormco",
  "SDI", "Saniflex", "Septodont", "Shofu", "SprintRay", "Straumann",
  "TePe", "Tokuyama",
  "Ultradent",
  "VOCO", "Vita",
  "W&H", "Wellmed",
  "Xylimelts",
];

function extractBrand(brandText: string | undefined, name: string): string | undefined {
  const cleaned = cleanBrand(brandText);
  if (cleaned) return cleaned;
  for (const brand of KNOWN_BRANDS) {
    if (name.toLowerCase().startsWith(brand.toLowerCase())) return brand;
  }
  return undefined;
}

function parseCategoryHierarchy(raw: string | undefined): {
  category: string | undefined;
  subcategory: string | undefined;
} {
  if (!raw) return { category: undefined, subcategory: undefined };
  const parts = raw.split("/").map((p) => p.trim()).filter(Boolean);
  return {
    category: parts[0],
    subcategory: parts[1],
  };
}

/**
 * Strip tracking params (CampaignCode, SearchID, SearchPos) from a product URL.
 * Preserves the canonical slug-based path.
 */
function cleanProductUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.delete("CampaignCode");
    u.searchParams.delete("SearchID");
    u.searchParams.delete("SearchPos");
    // If no params remain, remove the '?' entirely
    return u.searchParams.size > 0 ? u.toString() : u.origin + u.pathname;
  } catch {
    return raw;
  }
}

function buildImageUrl(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith("http")) return raw;
  if (raw.startsWith("/")) return `${ADAM_DENTAL_BASE}${raw}`;
  return undefined;
}

// -------------------------------------------------------------------
// Main parser — reads window.products + DOM data-product-data for prices
// -------------------------------------------------------------------

export async function parsePageProducts(page: Page): Promise<ProductDetail[]> {
  // 1. Structured metadata from window.products
  const rawProducts: RawWindowProduct[] = await page.evaluate(
    () => (window as unknown as { products?: RawWindowProduct[] }).products ?? [],
  );

  // 2. Price + image data from data-product-data attributes, keyed by SKU
  const productDataMap: Map<string, RawProductData> = await page.evaluate(() => {
    const map: [string, unknown][] = [];
    document
      .querySelectorAll<HTMLElement>("[data-role='product'][data-product-data]")
      .forEach((card) => {
        const code = card.getAttribute("data-product-code");
        const raw = card.getAttribute("data-product-data") ?? "[]";
        try {
          const arr = JSON.parse(raw) as unknown[];
          if (Array.isArray(arr) && arr.length > 0) {
            map.push([code ?? "", arr[0]]);
          }
        } catch {
          // skip malformed cards
        }
      });
    return map;
  }).then((entries) => new Map(entries as [string, RawProductData][]));

  // 3. Product URLs from DOM links, keyed by SKU
  const domLinks: Map<string, string> = await page.evaluate(() => {
    const map: [string, string][] = [];
    document
      .querySelectorAll<HTMLElement>("div[data-role='product'][data-product-code]")
      .forEach((card) => {
        const code = card.getAttribute("data-product-code");
        const anchor = card.querySelector<HTMLAnchorElement>("a[data-product-link]");
        if (code && anchor?.href) {
          map.push([code, anchor.href]);
        }
      });
    return map;
  }).then((entries) => new Map(entries));

  // 4. Images from DOM (data-image-src attr, relative paths)
  const domImages: Map<string, string> = await page.evaluate(() => {
    const map: [string, string][] = [];
    document
      .querySelectorAll<HTMLElement>("div[data-role='product'][data-product-code]")
      .forEach((card) => {
        const code = card.getAttribute("data-product-code");
        const img = card.querySelector<HTMLImageElement>("img[data-image-src]");
        if (code && img) {
          const src = img.getAttribute("data-image-src") ?? img.getAttribute("src");
          if (src) map.push([code, src]);
        }
      });
    return map;
  }).then((entries) => new Map(entries));

  return rawProducts
    .filter((item) => Boolean(item.Description && item.ProductCode))
    .map((item): ProductDetail => {
      const sku = item.ProductCode!.trim().toUpperCase();
      const name = cleanText(item.Description) ?? item.Description!;
      const { category, subcategory } = parseCategoryHierarchy(item.CategoryHierarchy);

      const pricingData = productDataMap.get(sku) ?? productDataMap.get(item.ProductCode!);
      const priceInc = cleanPrice(pricingData?.NettPriceFromFirstInc);
      const priceEx = cleanPrice(pricingData?.NettPriceFromFirstEx);

      // Detect APHRA / login-required products
      const isLoginRequired =
        priceInc === undefined &&
        (pricingData?.NettPriceFromFirstInc?.toLowerCase().includes("call") ||
          pricingData?.NettPriceFromFirstInc?.toLowerCase().includes("login") ||
          !pricingData);

      const rawUrl = domLinks.get(sku) ?? domLinks.get(item.ProductCode!);
      const productUrl = rawUrl
        ? cleanProductUrl(rawUrl)
        : `${ADAM_DENTAL_BASE}/search?ProductSearch=${encodeURIComponent(sku)}`;

      const rawImagePath =
        domImages.get(sku) ??
        domImages.get(item.ProductCode!) ??
        (pricingData?.ImageFileName ?? undefined);
      const imageUrl = buildImageUrl(rawImagePath);

      return {
        externalSku: sku,
        externalId: sku,
        name,
        brand: extractBrand(item.BrandText, name),
        price: priceInc,
        priceExGst: priceEx,
        stockStatus: "in_stock",
        url: productUrl,
        imageSrc: imageUrl,
        category,
        subcategory,
        packSize: extractPackSize(name),
        raw: {
          ...item,
          login_required: isLoginRequired,
        } as unknown as Record<string, unknown>,
      };
    });
}
