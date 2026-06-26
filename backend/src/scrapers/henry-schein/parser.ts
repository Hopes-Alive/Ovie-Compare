import type { Page } from "playwright";
import type { ProductDetail } from "../../types/scraper.js";
import { HENRY_SCHEIN_BASE, IMAGE_URL } from "./selectors.js";

// -------------------------------------------------------------------
// Raw shape injected by Henry Schein into window.products
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

// -------------------------------------------------------------------
// Data cleaners
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
  // Title-case if all-caps
  if (t === t.toUpperCase() && t.length > 2) {
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }
  return t;
}

// "Carton 10 x 100" or "10 x 100"
const CARTON_X_PATTERN = /\bCarton\s+(\d+)\s*x\s*(\d+)\b|\b(\d+)\s*x\s*(\d+)\b/i;
// "200-Pack", "100 Pack", "100-pack", "Pack of 100"
const DASH_PACK_PATTERN = /\b(\d+)[-\s]Pack\b|\bPack\s+of\s+(\d+)\b/i;
// "Box of 10", "Carton of 10"
const BOX_OF_PATTERN = /\b(?:box|carton)\s+of\s+(\d+)\b/i;
// "200pk", "10pc", "5pcs", "10 pieces"
const SHORT_PK_PATTERN = /\b(\d+)\s*(?:pk|pcs?|pieces?)\b/i;
// "10/Box", "50/Pk", "12/Carton"
const SLASH_UNIT_PATTERN = /\b(\d+)\s*\/\s*(?:pk|box|bx|carton|ctn|pack)\b/i;

function extractPackSize(name: string): string | undefined {
  const carton = name.match(CARTON_X_PATTERN);
  if (carton) {
    const a = carton[1] ?? carton[3];
    const b = carton[2] ?? carton[4];
    return `${a} x ${b}`;
  }
  const dashPack = name.match(DASH_PACK_PATTERN);
  if (dashPack) return dashPack[1] ?? dashPack[2];
  const boxOf = name.match(BOX_OF_PATTERN);
  if (boxOf) return boxOf[1];
  const slashUnit = name.match(SLASH_UNIT_PATTERN);
  if (slashUnit) return slashUnit[1];
  const shortPk = name.match(SHORT_PK_PATTERN);
  if (shortPk) return shortPk[1];
  return undefined;
}

// Known brand prefixes in Henry Schein catalog (add more as discovered)
const KNOWN_BRANDS = [
  // Henry Schein house brands
  "Henry Schein",
  "Essentials",
  "Saniflex",
  // 3D printing
  "Nextdent",
  "Formlabs",
  "Straumann",
  "SprintRay",
  "Asiga",
  "Keystone",
  "Desktop Health",
  // Dental materials
  "Kerr",
  "3M",
  "GC",
  "Dentsply",
  "Ivoclar",
  "VOCO",
  "SDI",
  "Ultradent",
  "Shofu",
  "Kuraray",
  "Tokuyama",
  "Coltene",
  "Dentsply Sirona",
  "Septodont",
  "DMG",
  "Ormco",
  "Hu-Friedy",
  "Hu Friedy",
  "NSK",
  "W&H",
  "EMS",
  "Acteon",
  "Mectron",
  "Komet",
  "Brasseler",
  "Intensiv",
  "Meisinger",
  "Noritake",
  "Vita",
  "Heraeus",
  "Candulor",
  "Anaxdent",
  "Curasept",
  "Colgate",
  "Oral-B",
  "GlaxoSmithKline",
  "GSK",
  "TePe",
  "Haleon",
  "Xylimelts",
  "DenTek",
  "Ansell",
  "Microflex",
  "Medilab",
];

function extractBrand(
  brandText: string | undefined,
  name: string,
): string | undefined {
  const cleaned = cleanBrand(brandText);
  if (cleaned) return cleaned;
  // Try to match a known brand from the product name
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

function buildProductUrl(
  urlFromDom: string | null,
  sku: string,
  pageUrl: string,
): string {
  if (urlFromDom && urlFromDom.startsWith("http")) {
    return urlFromDom;
  }
  if (urlFromDom && urlFromDom.startsWith("/")) {
    return `${HENRY_SCHEIN_BASE}${urlFromDom}`;
  }
  // Fallback: category URL + SKU search (not ideal but better than slugify)
  const categoryPath = pageUrl.split("?")[0].replace(HENRY_SCHEIN_BASE, "");
  return `${HENRY_SCHEIN_BASE}${categoryPath}?ProductCode=${sku}`;
}

// -------------------------------------------------------------------
// Main parser — reads window.products + real DOM links
// -------------------------------------------------------------------
export async function parsePageProducts(page: Page): Promise<ProductDetail[]> {
  // 1. Read structured data from window.products
  const rawProducts: RawWindowProduct[] = await page.evaluate(
    () =>
      (window as unknown as { products?: RawWindowProduct[] }).products ?? [],
  );

  // 2. Extract real product URLs from DOM, keyed by product-code attribute
  const domLinks: Record<string, string> = await page.evaluate(() => {
    const map: Record<string, string> = {};
    document
      .querySelectorAll<HTMLElement>("div[data-role='product'][data-product-code]")
      .forEach((card) => {
        const code = card.getAttribute("data-product-code");
        const anchor = card.querySelector<HTMLAnchorElement>(
          ".widget-productlist-title a[data-product-link]",
        );
        if (code && anchor?.href) {
          map[code] = anchor.href;
        }
      });
    return map;
  });

  const pageUrl = page.url();

  return rawProducts
    .filter((item) => Boolean(item.Description && item.ProductCode))
    .map((item): ProductDetail => {
      const sku = item.ProductCode!.trim().toUpperCase();
      const name = cleanText(item.Description) ?? item.Description!;
      const { category, subcategory } = parseCategoryHierarchy(
        item.CategoryHierarchy,
      );

      return {
        externalSku: sku,
        externalId: sku,
        name,
        brand: extractBrand(item.BrandText, name),
        price: cleanPrice(item.PriceForOneInc),
        priceExGst: cleanPrice(item.PriceForOneEx),
        stockStatus: "in_stock",  // Henry Schein listing pages don't show stock status
        url: buildProductUrl(domLinks[item.ProductCode!] ?? null, sku, pageUrl),
        imageSrc: IMAGE_URL(sku),
        category,
        subcategory,
        packSize: extractPackSize(name),
        raw: item as unknown as Record<string, unknown>,
      };
    });
}
