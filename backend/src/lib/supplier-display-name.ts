const SUPPLIERS = [
  { slug: "henry-schein", name: "Henry Schein" },
  { slug: "adam-dental", name: "Adam Dental" },
] as const;

export function getSupplierDisplayName(
  slug?: string | null,
  rawName?: string | null
): string {
  if (slug) {
    const match = SUPPLIERS.find((s) => s.slug === slug);
    if (match) return match.name;
  }

  const name = rawName?.trim() ?? "";
  if (!name) return "Supplier";

  const lower = name.toLowerCase();
  if (lower.includes("henry schein")) return "Henry Schein";
  if (lower.includes("adam dental")) return "Adam Dental";

  return name;
}
