"use client";

import { ChatBackground } from "@/components/chat/shell/chat-background";
import { ChatComposerBar } from "@/components/chat/shell/chat-composer-bar";
import { ChatShellHeader } from "@/components/chat/shell/chat-shell-header";
import { SuggestedPrompts } from "@/components/chat/suggested-prompts";
import { ChatThemeProvider } from "@/components/chat/theme/chat-theme-provider";
import {
  ChatViewModeProvider,
  PREVIEW_VIEW_MODE,
} from "@/components/chat/chat-view-mode-context";
import type { ChatDesignTheme } from "@/types/chat-design";

type ChatDesignPreviewProps = {
  theme: ChatDesignTheme;
};

/** Scaled phone mockup of the chat shell (not message content) */
export function ChatDesignPreview({ theme }: ChatDesignPreviewProps) {
  return (
    <div className="mx-auto w-[280px] shrink-0">
      <div className="mb-2 text-center text-xs font-medium text-muted-foreground">
        Live preview
      </div>
      <div className="overflow-hidden rounded-[2rem] border-4 border-slate-800 bg-slate-900 shadow-xl">
        <div className="h-[520px] overflow-hidden">
          <ChatThemeProvider theme={theme}>
            <ChatViewModeProvider value={PREVIEW_VIEW_MODE}>
              <div
                className="relative flex h-full flex-col overflow-hidden"
                style={{ backgroundColor: theme.pageBg }}
              >
                <ChatBackground />
                <div className="relative z-10 flex h-full min-h-0 flex-col">
                  <ChatShellHeader />
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <SuggestedPrompts />
                  </div>
                  <ChatComposerBar disabled />
                </div>
              </div>
            </ChatViewModeProvider>
          </ChatThemeProvider>
        </div>
      </div>
    </div>
  );
}
