"use client";

import { useEffect, useRef } from "react";

import { MessageBubble } from "@/components/chat/message-bubble";
import type { ChatMessage, ProductCardData } from "@/types/chat";

type MessageListProps = {
  messages: ChatMessage[];
  productOverrides?: Record<string, ProductCardData>;
  onPriceUpdate?: (productId: string, newPrice: number) => void;
  isLoading?: boolean;
};

export function MessageList({
  messages,
  productOverrides,
  onPriceUpdate,
  isLoading,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages change or new content streams in
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Show typing dots if loading and the last assistant message has no content yet
  const lastMsg = messages[messages.length - 1];
  const showTyping =
    isLoading &&
    lastMsg?.role === "assistant" &&
    !lastMsg.content;

  return (
    <div className="messages-container flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {messages.map((message) => {
          // Don't render the empty assistant placeholder — typing indicator handles it
          if (message.role === "assistant" && !message.content && !message.products) {
            return null;
          }
          const products = message.products?.map(
            (p) => productOverrides?.[p.id] ?? p
          );
          return (
            <MessageBubble
              key={message.id}
              message={message}
              products={products}
              onPriceUpdate={onPriceUpdate}
            />
          );
        })}

        {/* Typing indicator */}
        {showTyping && (
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              O
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                <span className="size-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                <span className="size-2 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
