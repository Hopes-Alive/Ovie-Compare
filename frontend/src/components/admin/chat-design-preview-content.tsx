"use client";

import { ChatViewModeProvider } from "@/components/chat/chat-view-mode-context";
import { ChatBackground } from "@/components/chat/shell/chat-background";
import { ChatComposerBar } from "@/components/chat/shell/chat-composer-bar";
import { ChatMessagesBackdrop } from "@/components/chat/shell/chat-messages-backdrop";
import { ChatShellHeader } from "@/components/chat/shell/chat-shell-header";
import { SuggestedPrompts } from "@/components/chat/suggested-prompts";
import { ChatThemeProvider } from "@/components/chat/theme/chat-theme-provider";
import {
  getChatPanelClasses,
  getPreviewViewMode,
  shouldShowWideBackdrop,
} from "@/lib/chat-design/chat-view-mode";
import { cn } from "@/lib/utils";
import type { ChatDesignTheme } from "@/types/chat-design";

export type PreviewMode = "mobile" | "desktop";

type ChatDesignPreviewContentProps = {
  theme: ChatDesignTheme;
  mode: PreviewMode;
  mobileHeight?: number;
  desktopHeight?: number;
  className?: string;
};

function LiveChatShellPreview() {
  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      style={{ backgroundColor: "inherit" }}
    >
      <ChatBackground />
      <ChatShellHeader />
      <ChatMessagesBackdrop>
        <SuggestedPrompts />
      </ChatMessagesBackdrop>
      <ChatComposerBar disabled />
    </div>
  );
}

function PreviewPanel({
  theme,
  mode,
  className,
}: {
  theme: ChatDesignTheme;
  mode: PreviewMode;
  className?: string;
}) {
  const viewMode = getPreviewViewMode(mode);
  const showBackdrop = shouldShowWideBackdrop(viewMode.isWide, viewMode.layout);

  return (
    <ChatThemeProvider theme={theme}>
      <ChatViewModeProvider value={viewMode}>
        <div
          className={cn(
            "relative h-full w-full",
            showBackdrop && "flex items-center justify-center bg-slate-900/45 p-3"
          )}
        >
          <div
            className={cn(
              getChatPanelClasses(viewMode.isWide, viewMode.layout),
              "h-full max-h-full",
              className
            )}
            data-chat-layout={viewMode.layout}
            data-chat-wide={viewMode.isWide ? "true" : "false"}
            style={{ backgroundColor: theme.pageBg }}
          >
            <LiveChatShellPreview />
          </div>
        </div>
      </ChatViewModeProvider>
    </ChatThemeProvider>
  );
}

export function ChatDesignPreviewContent({
  theme,
  mode,
  mobileHeight = 500,
  desktopHeight = 380,
  className,
}: ChatDesignPreviewContentProps) {
  if (mode === "mobile") {
    return (
      <div className={cn("mx-auto w-[268px]", className)}>
        <div className="overflow-hidden rounded-[2.25rem] border-[5px] border-slate-800 bg-slate-900 shadow-2xl ring-1 ring-black/10">
          <div className="flex justify-center bg-slate-900 py-2.5">
            <div className="h-1.5 w-20 rounded-full bg-slate-700" />
          </div>
          <div className="overflow-hidden bg-black" style={{ height: mobileHeight }}>
            <PreviewPanel theme={theme} mode="mobile" className="rounded-none shadow-none" />
          </div>
          <div className="flex justify-center bg-slate-900 py-2.5">
            <div className="h-1 w-28 rounded-full bg-slate-700/80" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/60 bg-muted/30 p-2", className)}>
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <span className="size-2.5 rounded-full bg-red-400/90" />
        <span className="size-2.5 rounded-full bg-amber-400/90" />
        <span className="size-2.5 rounded-full bg-emerald-400/90" />
        <span className="ml-2 truncate text-[10px] text-muted-foreground">
          {theme.brandName || "Ovie"} · expanded desktop
        </span>
      </div>
      <div
        className="overflow-hidden rounded-lg border border-border/50 shadow-inner"
        style={{ height: desktopHeight }}
      >
        <PreviewPanel theme={theme} mode="desktop" />
      </div>
    </div>
  );
}
