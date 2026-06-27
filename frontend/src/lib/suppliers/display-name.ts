import { CONNECTED_SUPPLIERS } from "@/config/nav";

const SUPPLIER_ORDER = CONNECTED_SUPPLIERS.map((s) => s.slug);

/** Canonical display name for a supplier (slug-aware, with raw-name fallback). */
export function getSupplierDisplayName(
  slug?: string | null,
  rawName?: string | null
): string {
  if (slug) {
    const match = CONNECTED_SUPPLIERS.find((s) => s.slug === slug);
    if (match) return match.name;
  }

  const name = rawName?.trim() ?? "";
  if (!name) return "Supplier";

  const lower = name.toLowerCase();
  if (lower.includes("henry schein")) return "Henry Schein";
  if (lower.includes("adam dental")) return "Adam Dental";

  return name;
}

export function getSupplierSortIndex(slug?: string | null, rawName?: string | null): number {
  if (slug) {
    const idx = SUPPLIER_ORDER.indexOf(slug as (typeof SUPPLIER_ORDER)[number]);
    if (idx >= 0) return idx;
  }

  const display = getSupplierDisplayName(slug, rawName).toLowerCase();
  if (display.includes("henry schein")) return 0;
  if (display.includes("adam dental")) return 1;
  return SUPPLIER_ORDER.length;
}

export type SupplierProductGroup = {
  key: string;
  slug: string;
  name: string;
  products: import("@/types/chat").ProductCardData[];
};

/** Group product cards by supplier for section headings. */
export function groupProductsBySupplier(
  products: import("@/types/chat").ProductCardData[]
): SupplierProductGroup[] {
  const groups = new Map<string, SupplierProductGroup>();

  for (const product of products) {
    const slug = product.supplier_slug ?? "";
    const name = getSupplierDisplayName(slug, product.supplier);
    const key = slug || name;

    const existing = groups.get(key);
    if (existing) {
      existing.products.push(product);
    } else {
      groups.set(key, { key, slug, name, products: [product] });
    }
  }

  return [...groups.values()].sort(
    (a, b) =>
      getSupplierSortIndex(a.slug, a.name) - getSupplierSortIndex(b.slug, b.name)
  );
}
