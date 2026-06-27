"use client";

import { useChatViewMode } from "@/hooks/use-chat-view-mode";
import {
  getChatPanelClasses,
  shouldShowWideBackdrop,
} from "@/lib/chat-design/chat-view-mode";

import { ChatViewModeProvider } from "./chat-view-mode-context";

type ChatLayoutProps = {
  children: React.ReactNode;
};

export function ChatLayout({ children }: ChatLayoutProps) {
  const viewMode = useChatViewMode();
  const showBackdrop = shouldShowWideBackdrop(viewMode.isWide, viewMode.layout);

  return (
    <ChatViewModeProvider value={viewMode}>
      <div className="fixed inset-0 flex items-center justify-center p-0 md:p-4">
        {showBackdrop && (
          <button
            type="button"
            aria-label="Contract chat panel"
            className="absolute inset-0 z-0 bg-slate-900/45 backdrop-blur-[2px] animate-in fade-in duration-300"
            onClick={viewMode.toggleViewMode}
          />
        )}
        <div
          className={getChatPanelClasses(viewMode.isWide, viewMode.layout)}
          data-chat-layout={viewMode.layout}
          data-chat-wide={viewMode.isWide ? "true" : "false"}
          style={{ backgroundColor: "var(--chat-panel-bg, #f8fafc)" }}
        >
          {children}
        </div>
      </div>
    </ChatViewModeProvider>
  );
}

// Re-export for convenience
export { useChatViewModeContext } from "./chat-view-mode-context";
