import { DEFAULT_CHAT_DESIGN } from "@/lib/chat-design/theme";
import type { ChatDesignTheme } from "@/types/chat-design";

export type SetupItem = {
  id: string;
  label: string;
  done: boolean;
};

export function getChatDesignSetupItems(theme: ChatDesignTheme): SetupItem[] {
  const supplierLogoCount = Object.values(theme.supplierLogos ?? {}).filter(Boolean).length;

  return [
    { id: "brand-name", label: "Brand name set", done: theme.brandName.trim().length > 0 },
    { id: "logo", label: "Logo uploaded", done: Boolean(theme.logoUrl) },
    { id: "banner", label: "Header banner", done: Boolean(theme.headerBannerImageUrl) },
    {
      id: "supplier-logos",
      label: "Supplier logos",
      done: supplierLogoCount > 0,
    },
    {
      id: "palette",
      label: "Custom palette",
      done: theme.primaryColor !== DEFAULT_CHAT_DESIGN.primaryColor,
    },
    {
      id: "background",
      label: "Background image",
      done: Boolean(theme.backgroundImageUrl || theme.expandedBackgroundImageUrl),
    },
    {
      id: "empty-state",
      label: "Empty state copy",
      done: theme.emptyStateTitle !== DEFAULT_CHAT_DESIGN.emptyStateTitle,
    },
    {
      id: "prompts",
      label: "Suggested prompts",
      done: theme.suggestedPrompts.some(
        (prompt, index) =>
          prompt.prompt !== DEFAULT_CHAT_DESIGN.suggestedPrompts[index]?.prompt
      ),
    },
  ];
}

export function getSetupProgress(items: SetupItem[]): {
  completed: number;
  total: number;
  percent: number;
} {
  const completed = items.filter((item) => item.done).length;
  const total = items.length;
  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
