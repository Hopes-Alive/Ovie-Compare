import { HenryScheinAdapter } from "../../scrapers/henry-schein/adapter.js";
import { AdamDentalAdapter } from "../../scrapers/adam-dental/adapter.js";

export async function launchBrowserForSlug(slug: string) {
  if (slug === "henry-schein") return HenryScheinAdapter.launchBrowser();
  if (slug === "adam-dental") return AdamDentalAdapter.launchBrowser();
  throw new Error(`No browser launcher for supplier: ${slug}`);
}

export function groupBySupplier<T extends { suppliers: { slug: string } }>(
  rows: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const slug = row.suppliers.slug;
    const list = groups.get(slug) ?? [];
    list.push(row);
    groups.set(slug, list);
  }
  return groups;
}

export function pricesDiffer(
  a: number | null | undefined,
  b: number | null | undefined,
): boolean {
  const na = a == null ? null : Number(a);
  const nb = b == null ? null : Number(b);
  if (na == null && nb == null) return false;
  if (na == null || nb == null) return true;
  return Math.abs(na - nb) > 0.001;
}
