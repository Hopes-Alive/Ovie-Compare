"use client";

import { createContext, useContext } from "react";

import type { ChatViewMode } from "@/lib/chat-design/chat-view-mode";

export type ChatViewModeContextValue = {
  layout: "portrait-phone" | "phone-landscape" | "desktop";
  viewMode: ChatViewMode;
  canToggle: boolean;
  isWide: boolean;
  setViewMode: (mode: ChatViewMode) => void;
  toggleViewMode: () => void;
};

const ChatViewModeContext = createContext<ChatViewModeContextValue | null>(null);

/** Static values for admin preview mockup (no expand/contract) */
export const PREVIEW_VIEW_MODE: ChatViewModeContextValue = {
  layout: "portrait-phone",
  viewMode: "narrow",
  canToggle: false,
  isWide: false,
  setViewMode: () => {},
  toggleViewMode: () => {},
};

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
