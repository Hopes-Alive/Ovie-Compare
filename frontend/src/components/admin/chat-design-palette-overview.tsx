"use client";

import { cn } from "@/lib/utils";
import type { ChatDesignTheme } from "@/types/chat-design";

const PALETTE_GROUPS = [
  {
    label: "Brand",
    swatches: [
      { key: "primaryColor" as const, label: "Primary" },
      { key: "accentColor" as const, label: "Accent" },
    ],
  },
  {
    label: "Surfaces",
    swatches: [
      { key: "pageBg" as const, label: "Page" },
      { key: "headerBg" as const, label: "Header" },
      { key: "composerBg" as const, label: "Composer" },
      { key: "composerInputBg" as const, label: "Input" },
    ],
  },
  {
    label: "Text",
    swatches: [
      { key: "headerText" as const, label: "Header" },
      { key: "emptyStateTitleText" as const, label: "Title" },
      { key: "promptText" as const, label: "Prompts" },
    ],
  },
] as const;

type ChatDesignPaletteOverviewProps = {
  theme: ChatDesignTheme;
  compact?: boolean;
  className?: string;
};

export function ChatDesignPaletteOverview({
  theme,
  compact = false,
  className,
}: ChatDesignPaletteOverviewProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-card to-muted/20",
        className
      )}
    >
      <div className="flex h-3">
        {[
          theme.primaryColor,
          theme.accentColor,
          theme.headerBg,
          theme.pageBg,
          theme.composerInputBg,
        ].map((color, i) => (
          <span key={i} className="flex-1" style={{ backgroundColor: color }} />
        ))}
      </div>

      <div className={cn("p-4", compact && "p-3")}>
        {!compact && (
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Current palette
          </p>
        )}
        <div className={cn("grid gap-4", compact ? "grid-cols-1" : "sm:grid-cols-3")}>
          {PALETTE_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-[11px] font-medium text-muted-foreground">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.swatches.map(({ key, label }) => (
                  <div
                    key={key}
                    className="flex items-center gap-1.5 rounded-md border border-border/50 bg-background/80 px-2 py-1"
                    title={`${label}: ${theme[key]}`}
                  >
                    <span
                      className="size-4 shrink-0 rounded ring-1 ring-black/10"
                      style={{ backgroundColor: theme[key] }}
                    />
                    <span className="text-[10px] font-medium text-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
