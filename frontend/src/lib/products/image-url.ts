const SUPPLIER_BASE: Record<string, string> = {
  "henry-schein": "https://www.henryschein.com.au",
  "adam-dental": "https://www.adamdental.com.au",
};

/** Resolve supplier product image URLs for display in chat (not chat-design uploads). */
export function resolveProductImageUrl(
  raw: string,
  supplierSlug?: string | null
): string {
  const url = raw.trim();
  if (!url) return "";

  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;

  const base = supplierSlug ? SUPPLIER_BASE[supplierSlug] : undefined;
  if (base && url.startsWith("/")) return `${base}${url}`;

  return url;
}

export function normalizeProductImageUrls(
  imageUrls: string[] | undefined,
  supplierSlug?: string | null
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of imageUrls ?? []) {
    const resolved = resolveProductImageUrl(raw, supplierSlug);
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
      result.push(resolved);
    }
  }

  return result;
}
