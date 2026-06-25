"use client";

import { useCallback, useState } from "react";

import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageList } from "@/components/chat/message-list";
import { SuggestedPrompts } from "@/components/chat/suggested-prompts";
import { mockChatMessages, SHOW_DEMO } from "@/data/mock/chat";
import type { ChatMessage, ProductCardData } from "@/types/chat";

function createId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ChatPageContent() {
  const [messages, setMessages] = useState<ChatMessage[]>(
    SHOW_DEMO ? mockChatMessages : []
  );
  const [productOverrides, setProductOverrides] = useState<
    Record<string, ProductCardData>
  >({});

  const isEmpty = messages.length === 0;

  const handleSend = useCallback((text: string) => {
    // TODO: replace with POST /api/chat
    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: text,
    };
    const assistantMessage: ChatMessage = {
      id: createId(),
      role: "assistant",
      content:
        "Chat API is not wired yet. This is a UI preview — connect POST /api/chat to get real product results.",
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);
  }, []);

  const handlePriceUpdate = useCallback(
    (productId: string, newPrice: number) => {
      setProductOverrides((prev) => {
        const base =
          prev[productId] ??
          messages
            .flatMap((m) => m.products ?? [])
            .find((p) => p.id === productId);
        if (!base) return prev;
        return {
          ...prev,
          [productId]: {
            ...base,
            price: newPrice,
            lastCheckedAgo: "just now",
            freshness: "fresh",
          },
        };
      });
    },
    [messages]
  );

  return (
    <>
      <ChatHeader onNewChat={() => setMessages([])} />
      {isEmpty ? (
        <SuggestedPrompts onSelect={handleSend} />
      ) : (
        <MessageList
          messages={messages}
          productOverrides={productOverrides}
          onPriceUpdate={handlePriceUpdate}
        />
      )}
      <ChatInput onSend={handleSend} />
    </>
  );
}
