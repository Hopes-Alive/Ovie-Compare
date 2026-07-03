import type { EnrichedPageSnapshot } from "./enrich-snapshot.js";
import { hasValidPrice } from "../../scrapers/parse-product-helpers.js";
import type { AiExtractionResult } from "./types.js";

function qtyFromSnapshot(snapshot: EnrichedPageSnapshot): number | null {
  const raw = snapshot.parsedProduct?.raw as { available_qty?: number | null } | undefined;
  if (raw?.available_qty != null && Number.isFinite(raw.available_qty)) {
    return Math.trunc(raw.available_qty);
  }
  return null;
}

function inferStockFromPageText(pageText: string): AiExtractionResult["stockStatus"] {
  const lower = pageText.toLowerCase();
  if (/out\s*of\s*stock/.test(lower)) return "out_of_stock";
  if (/low\s*stock/.test(lower)) return "low_stock";
  if (/in\s*stock/.test(lower)) return "in_stock";
  return "unknown";
}

/** Skip LLM when structured parser already has a reliable price on the loaded page. */
export function canUseParserFastPath(snapshot: EnrichedPageSnapshot): boolean {
  if (snapshot.loginHint) return false;
  const parsed = snapshot.parsedProduct;
  if (!hasValidPrice(parsed)) return false;
  if (!parsed?.name?.trim()) return false;
  return true;
}

/** Build extraction from Playwright parser + DOM — no LLM round-trip. */
export function extractionFromSnapshot(snapshot: EnrichedPageSnapshot): AiExtractionResult {
  const parsed = snapshot.parsedProduct!;
  const parsedStock = parsed.stockStatus;
  const stockStatus =
    parsedStock && parsedStock !== "unknown"
      ? parsedStock
      : inferStockFromPageText(snapshot.pageText);

  return {
    externalSku: parsed.externalSku ?? null,
    name: parsed.name,
    brand: parsed.brand ?? snapshot.brandField ?? null,
    category: parsed.category ?? null,
    subcategory: parsed.subcategory ?? null,
    description: snapshot.description ?? parsed.description ?? null,
    imageSrc: parsed.imageSrc ?? snapshot.imageUrls[0] ?? null,
    packSize: parsed.packSize ?? null,
    unitOfMeasure: parsed.unitOfMeasure ?? null,
    price: parsed.price ?? null,
    stockStatus,
    stockQuantity: qtyFromSnapshot(snapshot),
    deliveryText: snapshot.deliveryText ?? parsed.deliveryText ?? null,
    deliveryMinDays: parsed.deliveryMinDays ?? null,
    deliveryMaxDays: parsed.deliveryMaxDays ?? null,
    loginRequired: Boolean((parsed.raw as { login_required?: boolean })?.login_required),
    confidence: "high",
    notes: "Fast path — structured page parse (no LLM)",
  };
}
