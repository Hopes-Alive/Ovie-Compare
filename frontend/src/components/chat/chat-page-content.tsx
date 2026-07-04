"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MessageList } from "@/components/chat/message-list";
import { ChatBackground } from "@/components/chat/shell/chat-background";
import { ChatComposerBar } from "@/components/chat/shell/chat-composer-bar";
import { ChatMessagesBackdrop } from "@/components/chat/shell/chat-messages-backdrop";
import { ChatShellHeader } from "@/components/chat/shell/chat-shell-header";
import { SuggestedPrompts } from "@/components/chat/suggested-prompts";
import { ChatThemeProvider } from "@/components/chat/theme/chat-theme-provider";
import { DEFAULT_CHAT_DESIGN, resolveChatDesign } from "@/lib/chat-design/theme";
import type { ChatDesignTheme } from "@/types/chat-design";
import type { ChatMessage, ProductCardData } from "@/types/chat";

function createId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const CHAT_SESSION_KEY = "ovie-chat-session-token";

type SseEvent =
  | { type: "token"; text: string }
  | { type: "products"; products: ProductCardData[]; total: number; fallback: boolean }
  | { type: "error"; message: string }
  | { type: "done"; sessionToken?: string };

export function ChatPageContent() {
  const [theme, setTheme] = useState<ChatDesignTheme>(DEFAULT_CHAT_DESIGN);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [productOverrides, setProductOverrides] = useState<Record<string, ProductCardData>>({});
  // Patches for a *variant* option (id differs from its parent card's own id) —
  // applied onto the matching entry of the card's `variants[]` array instead of
  // replacing the whole card, which represents a different DB row/SKU.
  const [variantOverrides, setVariantOverrides] = useState<Record<string, Partial<ProductCardData>>>({});
  const [isLoading, setIsLoading] = useState(false);

  const messagesRef = useRef<ChatMessage[]>([]);
  const sessionTokenRef = useRef<string | null>(null);
  messagesRef.current = messages;

  useEffect(() => {
    sessionTokenRef.current = sessionStorage.getItem(CHAT_SESSION_KEY);
  }, []);

  useEffect(() => {
    fetch("/api/chat-design")
      .then((r) => r.json())
      .then((data: { theme?: Partial<ChatDesignTheme> }) => {
        if (data.theme) setTheme(resolveChatDesign(data.theme));
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  const isEmpty = messages.length === 0;

  const handleSend = useCallback(async (text: string) => {
    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: text,
    };
    const assistantId = createId();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setIsLoading(true);

    const history = messagesRef.current.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          sessionToken: sessionTokenRef.current,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: SseEvent;
          try {
            event = JSON.parse(raw) as SseEvent;
          } catch {
            continue;
          }

          if (event.type === "token") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + event.text } : m
              )
            );
          } else if (event.type === "products") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, products: event.products } : m
              )
            );
          } else if (event.type === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: event.message || "Something went wrong. Please try again." }
                  : m
              )
            );
            break;
          } else if (event.type === "done") {
            if (event.sessionToken) {
              sessionTokenRef.current = event.sessionToken;
              sessionStorage.setItem(CHAT_SESSION_KEY, event.sessionToken);
            }
            break;
          }
        }
      }
    } catch (err) {
      const errorText =
        err instanceof Error
          ? err.message
          : "Connection error. Please check that the backend is running.";
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: errorText } : m))
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleProductUpdate = useCallback(
    (productId: string, updates: Partial<ProductCardData>) => {
      const allCards = messages.flatMap((m) => m.products ?? []);
      const isTopLevelCard = allCards.some((p) => p.id === productId);

      if (isTopLevelCard) {
        setProductOverrides((prev) => {
          const base = prev[productId] ?? allCards.find((p) => p.id === productId);
          if (!base) return prev;
          return { ...prev, [productId]: { ...base, ...updates } };
        });
        return;
      }

      // Not a card's own id — it's the currently-selected variant option.
      setVariantOverrides((prev) => ({
        ...prev,
        [productId]: { ...prev[productId], ...updates },
      }));
    },
    [messages]
  );

  return (
    <ChatThemeProvider theme={theme}>
      <div
        className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden"
        style={{ backgroundColor: theme.pageBg }}
      >
        <ChatBackground />
        <ChatShellHeader
          onNewChat={() => {
            setMessages([]);
            sessionTokenRef.current = null;
            sessionStorage.removeItem(CHAT_SESSION_KEY);
          }}
        />

        <ChatMessagesBackdrop>
          {isEmpty ? (
            <SuggestedPrompts onSelect={handleSend} />
          ) : (
            <MessageList
              messages={messages}
              productOverrides={productOverrides}
              variantOverrides={variantOverrides}
              onProductUpdate={handleProductUpdate}
              isLoading={isLoading}
            />
          )}
        </ChatMessagesBackdrop>

        <ChatComposerBar onSend={handleSend} disabled={isLoading} />
      </div>
    </ChatThemeProvider>
  );
}
