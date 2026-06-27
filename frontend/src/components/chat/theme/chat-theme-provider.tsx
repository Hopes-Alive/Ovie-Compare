"use client";

import { createContext, useContext } from "react";

import type { ChatDesignTheme } from "@/types/chat-design";
import { DEFAULT_CHAT_DESIGN } from "@/lib/chat-design/theme";

const ChatThemeContext = createContext<ChatDesignTheme>(DEFAULT_CHAT_DESIGN);

export function ChatThemeProvider({
  theme,
  children,
}: {
  theme: ChatDesignTheme;
  children: React.ReactNode;
}) {
  return (
    <ChatThemeContext.Provider value={theme}>{children}</ChatThemeContext.Provider>
  );
}

export function useChatTheme(): ChatDesignTheme {
  return useContext(ChatThemeContext);
}
