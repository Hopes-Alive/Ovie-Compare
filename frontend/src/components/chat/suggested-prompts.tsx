"use client";

import { ArrowRight, GitCompare, Search, ShoppingCart, TrendingDown } from "lucide-react";

import { useChatTheme } from "@/components/chat/theme/chat-theme-provider";
import { resolveAssetUrl } from "@/lib/chat-design/asset-url";
import { getChatTextColors } from "@/lib/chat-design/text-colors";
import type { SuggestedPromptIcon } from "@/types/chat-design";

const ICON_MAP = {
  search: Search,
  compare: GitCompare,
  cart: ShoppingCart,
  trending: TrendingDown,
} as const;

type SuggestedPromptsProps = {
  onSelect?: (prompt: string) => void;
};

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  const theme = useChatTheme();
  const textColors = getChatTextColors(theme);
  const initial = (theme.brandName || "O").slice(0, 1).toUpperCase();
  const logoUrl = resolveAssetUrl(theme.logoUrl);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8 text-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="mx-auto mb-4 size-14 rounded-2xl object-cover shadow-sm"
            />
          ) : (
            <div
              className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-sm"
              style={{ backgroundColor: theme.primaryColor }}
            >
              {initial}
            </div>
          )}
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ color: textColors.emptyStateTitle }}
          >
            {theme.emptyStateTitle}
          </h1>
          <p
            className="mx-auto mt-2 max-w-sm text-sm"
            style={{ color: textColors.emptyStateSubtitle }}
          >
            {theme.emptyStateSubtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {theme.suggestedPrompts.map((item) => (
            <PromptCard
              key={item.prompt}
              icon={item.icon}
              label={item.label}
              prompt={item.prompt}
              accent={theme.accentColor}
              labelColor={textColors.promptLabel}
              promptColor={textColors.promptBody}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PromptCard({
  icon,
  label,
  prompt,
  accent,
  labelColor,
  promptColor,
  onSelect,
}: {
  icon: SuggestedPromptIcon;
  label: string;
  prompt: string;
  accent: string;
  labelColor: string;
  promptColor: string;
  onSelect?: (prompt: string) => void;
}) {
  const Icon = ICON_MAP[icon] ?? Search;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(prompt)}
      className="group flex items-start gap-3 rounded-2xl border border-border/80 bg-card/80 p-3.5 text-left backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <div
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ backgroundColor: `${accent}cc` }}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: labelColor }}
        >
          {label}
        </p>
        <p className="text-sm leading-snug" style={{ color: promptColor }}>
          {prompt}
        </p>
      </div>
      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}
