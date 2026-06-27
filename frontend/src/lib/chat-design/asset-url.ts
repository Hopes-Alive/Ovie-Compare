/** Resolve stored upload paths to browser URLs (via Next.js proxy). */
export function resolveAssetUrl(url: string | undefined | null): string {
  if (!url?.trim()) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/uploads/")) return `/api${url}`;
  return url;
}
