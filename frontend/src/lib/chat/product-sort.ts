import type { SupplierProductGroup } from "@/lib/suppliers/display-name";
import type { ProductCardData } from "@/types/chat";

export function sortProductsByPrice(products: ProductCardData[]): ProductCardData[] {
  return [...products].sort((a, b) => {
    const aPrice = a.price > 0 ? a.price : Number.POSITIVE_INFINITY;
    const bPrice = b.price > 0 ? b.price : Number.POSITIVE_INFINITY;
    return aPrice - bPrice;
  });
}

export function sortGroupsByMinPrice(
  groups: SupplierProductGroup[]
): SupplierProductGroup[] {
  return [...groups].sort((a, b) => {
    const aMin = Math.min(...a.products.map((p) => p.price).filter((p) => p > 0));
    const bMin = Math.min(...b.products.map((p) => p.price).filter((p) => p > 0));
    if (!Number.isFinite(aMin)) return 1;
    if (!Number.isFinite(bMin)) return -1;
    return aMin - bMin;
  });
}

export function getMatchedProducts(products: ProductCardData[]): ProductCardData[] {
  return products.filter((p) => p.alternatives && p.alternatives.length > 0);
}
