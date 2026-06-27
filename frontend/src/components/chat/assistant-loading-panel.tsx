"use client";

import { Search } from "lucide-react";

import { AssistantAvatar } from "@/components/chat/assistant-avatar";
import { useChatTheme } from "@/components/chat/theme/chat-theme-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type AssistantLoadingPanelProps = {
  className?: string;
};

export function AssistantLoadingPanel({ className }: AssistantLoadingPanelProps) {
  const theme = useChatTheme();

  return (
    <article
      className={cn("chat-message-in flex items-start gap-3", className)}
      aria-busy="true"
      aria-live="polite"
      aria-label="Assistant is searching suppliers"
    >
      <AssistantAvatar className="mt-1" />

      <div className="min-w-0 flex-1">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-lg backdrop-blur-sm">
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            <div className="mb-4 flex items-center gap-2.5">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${theme.primaryColor}12` }}
              >
                <Search
                  className="size-3.5 animate-pulse"
                  style={{ color: theme.primaryColor }}
                  aria-hidden
                />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Searching suppliers</p>
                <p className="text-xs text-muted-foreground">
                  Comparing prices across catalogues…
                </p>
              </div>
              <span className="ml-auto flex shrink-0 items-center gap-1 pt-0.5">
                <TypingDots color={theme.primaryColor} />
              </span>
            </div>

            <div className="space-y-2.5">
              <Skeleton className="chat-skeleton-shimmer !animate-none h-[15px] w-[94%] rounded-md" />
              <Skeleton className="chat-skeleton-shimmer !animate-none h-[15px] w-[82%] rounded-md" />
              <Skeleton className="chat-skeleton-shimmer !animate-none h-[15px] w-[68%] rounded-md" />
              <div className="space-y-2 pt-1">
                <Skeleton className="chat-skeleton-shimmer !animate-none h-3 w-[88%] rounded" />
                <Skeleton className="chat-skeleton-shimmer !animate-none h-3 w-[72%] rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function TypingDots({ color }: { color: string }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="chat-typing-dot size-1.5 rounded-full"
          style={{
            backgroundColor: color,
            animationDelay: `${i * 160}ms`,
          }}
          aria-hidden
        />
      ))}
    </>
  );
}
