import type { ChatDesignTheme } from "@/types/chat-design";

/** Pick the background image for the current chat layout. */
export function resolveActiveBackgroundImageUrl(
  isWide: boolean,
  theme: Pick<ChatDesignTheme, "backgroundImageUrl" | "expandedBackgroundImageUrl">
): string {
  if (isWide) {
    const expanded = theme.expandedBackgroundImageUrl?.trim();
    return expanded || theme.backgroundImageUrl?.trim() || "";
  }
  return theme.backgroundImageUrl?.trim() || "";
}
