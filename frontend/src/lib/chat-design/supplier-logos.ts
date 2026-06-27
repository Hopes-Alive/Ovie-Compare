import type { ChatDesignTheme } from "@/types/chat-design";
import { resolveAssetUrl } from "@/lib/chat-design/asset-url";

/** Logo URL for a supplier slug from chat design theme, or null if unset. */
export function getSupplierLogoUrl(
  theme: ChatDesignTheme,
  slug?: string | null
): string | null {
  if (!slug) return null;
  const raw = theme.supplierLogos?.[slug]?.trim();
  return raw ? resolveAssetUrl(raw) : null;
}
