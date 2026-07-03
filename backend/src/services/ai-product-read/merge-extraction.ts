import type { ProductDetail } from "../../types/scraper.js";
import type { AiExtractionResult } from "./types.js";
import type { EnrichedPageSnapshot } from "./enrich-snapshot.js";

function pickString(...values: Array<string | null | undefined>): string | undefined {
  for (const v of values) {
    const s = v?.trim();
    if (s) return s;
  }
  return undefined;
}

function pickNumber(...values: Array<number | null | undefined>): number | undefined {
  for (const v of values) {
    if (v != null && Number.isFinite(v)) return v;
  }
  return undefined;
}

function stockFromQty(qty: number | null | undefined): ProductDetail["stockStatus"] | undefined {
  if (qty == null) return undefined;
  return qty > 0 ? "in_stock" : "out_of_stock";
}

function qtyFromParsed(parsed: ProductDetail | null): number | null {
  const raw = parsed?.raw as { available_qty?: number | null } | undefined;
  if (raw?.available_qty != null && Number.isFinite(raw.available_qty)) {
    return raw.available_qty;
  }
  return null;
}

/**
 * Merge adapter parse, DOM snapshot, and LLM extraction into one ProductDetail.
 * Parser wins for structured pricing/stock; LLM fills text fields the parser may miss.
 */
export function mergeExtraction(
  snapshot: EnrichedPageSnapshot,
  llm: AiExtractionResult,
  parsed: ProductDetail | null,
): ProductDetail {
  const parsedQty = qtyFromParsed(parsed);
  const stockStatus =
    llm.stockStatus !== "unknown"
      ? llm.stockStatus
      : parsed?.stockStatus ?? (parsedQty != null ? stockFromQty(parsedQty) : undefined) ?? "unknown";

  const name =
    pickString(llm.name, parsed?.name, snapshot.h1, snapshot.pageTitle) ?? "Unknown product";

  return {
    externalSku: pickString(llm.externalSku ?? undefined, parsed?.externalSku, undefined),
    externalId: pickString(parsed?.externalId, parsed?.externalSku, llm.externalSku ?? undefined),
    name,
    brand: pickString(llm.brand ?? undefined, parsed?.brand, snapshot.brandField ?? undefined),
    category: pickString(llm.category ?? undefined, parsed?.category),
    subcategory: pickString(llm.subcategory ?? undefined, parsed?.subcategory),
    description: pickString(
      llm.description ?? undefined,
      parsed?.description,
      snapshot.description ?? undefined,
      snapshot.metaDescription ?? undefined,
    ),
    imageSrc: pickString(llm.imageSrc ?? undefined, parsed?.imageSrc, snapshot.imageUrls[0]),
    packSize: pickString(llm.packSize ?? undefined, parsed?.packSize),
    unitOfMeasure: pickString(llm.unitOfMeasure ?? undefined, parsed?.unitOfMeasure),
    price: pickNumber(llm.price ?? undefined, parsed?.price) ?? undefined,
    priceExGst: parsed?.priceExGst,
    stockStatus,
    deliveryText: pickString(llm.deliveryText ?? undefined, parsed?.deliveryText, snapshot.deliveryText ?? undefined),
    deliveryMinDays: pickNumber(llm.deliveryMinDays ?? undefined, parsed?.deliveryMinDays),
    deliveryMaxDays: pickNumber(llm.deliveryMaxDays ?? undefined, parsed?.deliveryMaxDays),
    url: snapshot.url,
    raw: {
      ai_read: true,
      ai_confidence: llm.confidence,
      ai_notes: llm.notes,
      login_required: llm.loginRequired || snapshot.loginHint,
      available_qty: parsedQty ?? llm.stockQuantity ?? null,
      window_products_count: snapshot.windowProducts.length,
      dom_product_data_count: snapshot.domProductData.length,
      breadcrumbs: snapshot.breadcrumbs,
      ...(parsed?.raw ?? {}),
    },
  };
}
