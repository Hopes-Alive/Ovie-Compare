import type { ProductCardData } from "@/types/chat";

export type ResponseStats = {
  productCount: number;
  supplierCount: number;
  minPrice: number | null;
  maxPrice: number | null;
  cheapestProductId: string | null;
  currency: string;
};

export function computeResponseStats(products: ProductCardData[]): ResponseStats {
  const priced = products.filter((p) => p.price > 0);
  const supplierKeys = new Set(
    products.map((p) => p.supplier_slug || p.supplier || "unknown")
  );

  let cheapestProductId: string | null = null;
  let minPrice: number | null = null;
  let maxPrice: number | null = null;

  if (priced.length > 0) {
    const cheapest = priced.reduce((a, b) => (a.price <= b.price ? a : b));
    cheapestProductId = cheapest.id;
    minPrice = cheapest.price;
    maxPrice = Math.max(...priced.map((p) => p.price));
  }

  return {
    productCount: products.length,
    supplierCount: supplierKeys.size,
    minPrice,
    maxPrice,
    cheapestProductId,
    currency: products[0]?.currency ?? "AUD",
  };
}
