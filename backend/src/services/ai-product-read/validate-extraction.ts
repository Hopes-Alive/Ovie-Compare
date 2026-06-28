import type { ProductDetail } from "../../types/scraper.js";
import type { PageSnapshot, WindowProductEntry } from "./capture-page-snapshot.js";
import type { AiExtractionResult } from "./types.js";
import type { LiveCheckProductRow } from "../live-check/types.js";

function parseWindowPrice(entry: WindowProductEntry): number | null {
  const raw = entry.PriceForOneInc ?? entry.PriceForOneEx;
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Best price from window.products for cross-check. */
export function referencePriceFromSnapshot(snapshot: PageSnapshot): number | null {
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

export function validateExtraction(
  extraction: AiExtractionResult,
  snapshot: PageSnapshot,
  row: LiveCheckProductRow,
): ValidatedExtraction {
  const refPrice = referencePriceFromSnapshot(snapshot);
  const loginRequired = extraction.loginRequired || snapshot.loginHint;

  if (loginRequired && (extraction.price == null || extraction.price <= 0)) {
    return {
      product: {
        url: row.supplier_product_url,
        name: extraction.name || row.name,
        externalSku: row.external_sku ?? undefined,
        brand: extraction.brand ?? row.brand ?? undefined,
        packSize: extraction.packSize ?? row.pack_size ?? undefined,
        price: row.price != null ? Number(row.price) : undefined,
        stockStatus: resolveStockStatus(extraction, row),
        raw: { login_required: true, ai_notes: extraction.notes },
      },
      loginRequired: true,
      notes: extraction.notes ?? "Price requires supplier login",
    };
  }

  if (extraction.confidence === "low" && extraction.price == null) {
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

  const name = extraction.name.trim() || row.name;
  if (!name) {
    throw new Error("AI could not determine product name");
  }

  return {
    product: {
      url: row.supplier_product_url,
      name,
      externalSku: row.external_sku ?? undefined,
      brand: extraction.brand ?? row.brand ?? undefined,
      packSize: extraction.packSize ?? row.pack_size ?? undefined,
      price: extraction.price ?? undefined,
      stockStatus: resolveStockStatus(extraction, row),
      raw: {
        ai_read: true,
        ai_confidence: extraction.confidence,
        ai_notes: extraction.notes,
        window_products_count: snapshot.windowProducts.length,
      },
    },
    loginRequired: false,
    notes: extraction.notes,
  };
}
