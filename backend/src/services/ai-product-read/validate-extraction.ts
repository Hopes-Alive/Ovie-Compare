import type { ProductDetail } from "../../types/scraper.js";
import type { WindowProductEntry } from "./capture-page-snapshot.js";
import type { AiExtractionResult } from "./types.js";
import type { LiveCheckProductRow } from "../live-check/types.js";
import type { EnrichedPageSnapshot } from "./enrich-snapshot.js";
import { mergeExtraction } from "./merge-extraction.js";

function parseWindowPrice(entry: WindowProductEntry): number | null {
  const raw = entry.PriceForOneInc ?? entry.PriceForOneEx;
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Best price from window.products for cross-check. */
export function referencePriceFromSnapshot(snapshot: { windowProducts: WindowProductEntry[] }): number | null {
  for (const entry of snapshot.windowProducts) {
    const p = parseWindowPrice(entry);
    if (p != null) return p;
  }
  return null;
}

export type ValidatedExtraction = {
  product: ProductDetail;
  loginRequired: boolean;
  notes?: string;
};

function resolveStockStatus(
  extraction: AiExtractionResult,
  row: LiveCheckProductRow,
): ProductDetail["stockStatus"] {
  if (extraction.stockStatus !== "unknown") {
    return extraction.stockStatus;
  }

  const existing = row.stock_status;
  if (existing && existing !== "unknown") {
    return existing as ProductDetail["stockStatus"];
  }

  if (row.suppliers.slug === "henry-schein") {
    return "in_stock";
  }

  return "unknown";
}

export function buildAiReadContext(row: LiveCheckProductRow): import("./types.js").AiReadContext {
  return {
    url: row.supplier_product_url,
    supplierName: row.suppliers.name,
    supplierSlug: row.suppliers.slug,
    currentDatabase: {
      external_id: row.external_id,
      external_sku: row.external_sku,
      supplier_product_url: row.supplier_product_url,
      name: row.name,
      brand: row.brand,
      category: row.category,
      subcategory: row.subcategory,
      description: row.description,
      image_src: row.image_src,
      pack_size: row.pack_size,
      unit_of_measure: row.unit_of_measure,
      price: row.price != null ? Number(row.price) : null,
      currency: row.currency,
      price_includes_gst: row.price_includes_gst,
      stock_status: row.stock_status,
      stock_quantity: row.stock_quantity,
      delivery_text: row.delivery_text,
      delivery_min_days: row.delivery_min_days,
      delivery_max_days: row.delivery_max_days,
    },
  };
}

export function validateExtraction(
  extraction: AiExtractionResult,
  snapshot: EnrichedPageSnapshot,
  row: LiveCheckProductRow,
): ValidatedExtraction {
  const refPrice = referencePriceFromSnapshot(snapshot);
  // A DOM-confirmed login wall (visible "Login to buy" text) is ground truth
  // for what an anonymous visitor sees — it overrides even a numeric price
  // found in window.products/data-product-data, which some SAP Commerce PDPs
  // still populate behind the scenes. `extraction.loginRequired` alone (just
  // the LLM's own read of the page) is weaker and still deferred to a parsed
  // structured price when one exists.
  const domConfirmedLoginRequired = snapshot.loginHint;
  const loginRequired = extraction.loginRequired || domConfirmedLoginRequired;
  const parsed = snapshot.parsedProduct;

  if (
    loginRequired &&
    (domConfirmedLoginRequired || extraction.price == null || extraction.price <= 0) &&
    (domConfirmedLoginRequired || !hasParsedPrice(parsed))
  ) {
    const product = mergeExtraction(snapshot, {
      ...extraction,
      price: row.price != null ? Number(row.price) : null,
      stockStatus: resolveStockStatus(extraction, row) ?? "unknown",
      loginRequired: true,
    }, parsed);
    return {
      product: {
        ...product,
        price: row.price != null ? Number(row.price) : undefined,
        raw: { ...product.raw, login_required: true, ai_notes: extraction.notes },
      },
      loginRequired: true,
      notes: extraction.notes ?? "Price requires supplier login",
    };
  }

  if (extraction.confidence === "low" && extraction.price == null && !hasParsedPrice(parsed)) {
    throw new Error(extraction.notes ?? "AI could not confidently read a price from this page");
  }

  if (extraction.price != null) {
    if (extraction.price < 0 || extraction.price > 100_000) {
      throw new Error("AI extracted an invalid price");
    }
    if (refPrice != null && Math.abs(extraction.price - refPrice) > 0.05) {
      throw new Error(
        `AI price $${extraction.price.toFixed(2)} does not match page data $${refPrice.toFixed(2)}`,
      );
    }
  }

  const merged = mergeExtraction(snapshot, extraction, parsed);
  if (!merged.name?.trim()) {
    throw new Error("AI could not determine product name");
  }

  return {
    product: merged,
    loginRequired: false,
    notes: extraction.notes,
  };
}

function hasParsedPrice(parsed: ProductDetail | null | undefined): boolean {
  return parsed?.price != null && parsed.price > 0;
}
