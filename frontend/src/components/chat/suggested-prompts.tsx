"use client";

import { ArrowRight, GitCompare, Search, ShoppingCart, TrendingDown } from "lucide-react";

import { useChatTheme } from "@/components/chat/theme/chat-theme-provider";
import { resolveAssetUrl } from "@/lib/chat-design/asset-url";
import { getChatTextColors } from "@/lib/chat-design/text-colors";
import { useChatPanelCompact } from "@/hooks/use-chat-panel-compact";
import { cn } from "@/lib/utils";
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
  const compact = useChatPanelCompact();
  const textColors = getChatTextColors(theme);
  const initial = (theme.brandName || "O").slice(0, 1).toUpperCase();
  const logoUrl = resolveAssetUrl(theme.logoUrl);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div
        className={cn(
          "mx-auto w-full max-w-lg",
          compact ? "px-3 py-5 pb-6" : "px-4 py-8 pb-10"
        )}
      >
        <div className={cn("text-center", compact ? "mb-5" : "mb-8")}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className={cn(
                "mx-auto rounded-2xl object-cover shadow-sm",
                compact ? "mb-3 size-12" : "mb-4 size-14"
              )}
            />
          ) : (
            <div
              className={cn(
                "mx-auto flex items-center justify-center rounded-2xl font-bold text-white shadow-sm",
                compact ? "mb-3 size-12 text-xl" : "mb-4 size-14 text-2xl"
              )}
              style={{ backgroundColor: theme.primaryColor }}
            >
              {initial}
            </div>
          )}
          <h1
            className={cn(
              "font-bold tracking-tight",
              compact ? "text-lg" : "text-xl"
            )}
            style={{ color: textColors.emptyStateTitle }}
          >
            {theme.emptyStateTitle}
          </h1>
          <p
            className={cn(
              "mx-auto mt-2 text-sm leading-relaxed",
              compact ? "max-w-xs" : "max-w-sm"
            )}
            style={{ color: textColors.emptyStateSubtitle }}
          >
            {theme.emptyStateSubtitle}
          </p>
        </div>

        <div className={cn("grid gap-2", compact ? "grid-cols-1" : "md:grid-cols-2")}>
          {theme.suggestedPrompts.map((item) => (
            <PromptCard
              key={item.prompt}
              icon={item.icon}
              label={item.label}
              prompt={item.prompt}
              accent={theme.accentColor}
              labelColor={textColors.promptLabel}
              promptColor={textColors.promptBody}
              compact={compact}
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
  compact,
  onSelect,
}: {
  icon: SuggestedPromptIcon;
  label: string;
  prompt: string;
  accent: string;
  labelColor: string;
  promptColor: string;
  compact: boolean;
  onSelect?: (prompt: string) => void;
}) {
  const Icon = ICON_MAP[icon] ?? Search;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(prompt)}
      className={cn(
        "group flex w-full items-start gap-3 rounded-2xl border border-border/80 bg-card/80 text-left backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-sm",
        compact ? "p-3" : "p-3.5"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex shrink-0 items-center justify-center rounded-lg text-white",
          compact ? "size-7" : "size-8"
        )}
        style={{ backgroundColor: `${accent}cc` }}
      >
        <Icon className={compact ? "size-3.5" : "size-4"} />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: labelColor }}
        >
          {label}
        </p>
        <p
          className={cn("leading-snug", compact ? "text-[13px]" : "text-sm")}
          style={{ color: promptColor }}
        >
          {prompt}
        </p>
      </div>
      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground/30 transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
    </button>
  );
}
