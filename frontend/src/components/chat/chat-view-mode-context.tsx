"use client";

import { createContext, useContext } from "react";

import type { ChatViewMode } from "@/lib/chat-design/chat-view-mode";
import { getPreviewViewMode } from "@/lib/chat-design/chat-view-mode";

export type ChatViewModeContextValue = {
  layout: "portrait-phone" | "phone-landscape" | "desktop";
  viewMode: ChatViewMode;
  canToggle: boolean;
  isWide: boolean;
  setViewMode: (mode: ChatViewMode) => void;
  toggleViewMode: () => void;
};

const ChatViewModeContext = createContext<ChatViewModeContextValue | null>(null);

/** @deprecated Use getPreviewViewMode("mobile") */
export const PREVIEW_VIEW_MODE: ChatViewModeContextValue = getPreviewViewMode("mobile");

export function ChatViewModeProvider({
  value,
  children,
}: {
  value: ChatViewModeContextValue;
  children: React.ReactNode;
}) {
  return (
    <ChatViewModeContext.Provider value={value}>{children}</ChatViewModeContext.Provider>
  );
}

export function useChatViewModeContext(): ChatViewModeContextValue {
  const ctx = useContext(ChatViewModeContext);
  if (!ctx) {
    throw new Error("useChatViewModeContext must be used within ChatViewModeProvider");
  }
  return ctx;
}
