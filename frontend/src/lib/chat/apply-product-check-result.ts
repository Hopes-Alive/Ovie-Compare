import type { ProductCardData, ProductCheckFieldChange, StockStatus } from "@/types/chat";

type ProductCheckResultEvent = {
  changed: boolean;
  oldPrice: number | null;
  newPrice: number | null;
  oldStockStatus?: string | null;
  stockStatus?: string;
  changes?: ProductCheckFieldChange[];
};

function mapStockStatus(value: string | undefined): StockStatus | undefined {
  if (!value) return undefined;
  if (
    value === "in_stock" ||
    value === "out_of_stock" ||
    value === "low_stock" ||
    value === "unknown"
  ) {
    return value;
  }
  return undefined;
}

function parsePriceFromChange(changes: ProductCheckFieldChange[] | undefined, which: "from" | "to") {
  const priceChange = changes?.find((c) => c.label.toLowerCase() === "price");
  if (!priceChange) return null;
  const raw = which === "from" ? priceChange.from : priceChange.to;
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Apply live-check / AI-read SSE result to the product card display. */
export function buildProductCardUpdatesFromCheck(
  event: ProductCheckResultEvent,
): Partial<ProductCardData> {
  const updates: Partial<ProductCardData> = {
    lastCheckedAgo: "just now",
    freshness: "fresh",
  };

  if (event.newPrice != null && event.newPrice > 0) {
    updates.price = event.newPrice;
  }

  const stock = mapStockStatus(event.stockStatus);
  if (stock && stock !== "unknown") {
    updates.stockStatus = stock;
  }

  if (event.changed) {
    updates.priceChangeStatus = "changed";
    updates.priceChangedAgo = "just now";
    const prev =
      event.oldPrice ??
      parsePriceFromChange(event.changes, "from");
    if (prev != null && prev > 0) {
      updates.previousPrice = prev;
    }
  }

  return updates;
}
