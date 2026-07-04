"use client";

import { useEffect, useRef } from "react";

import { AssistantLoadingPanel } from "@/components/chat/assistant-loading-panel";
import { MessageBubble } from "@/components/chat/message-bubble";
import { useChatPanelCompact } from "@/hooks/use-chat-panel-compact";
import { cn } from "@/lib/utils";
import type { ChatMessage, ProductCardData } from "@/types/chat";

type MessageListProps = {
  messages: ChatMessage[];
  productOverrides?: Record<string, ProductCardData>;
  variantOverrides?: Record<string, Partial<ProductCardData>>;
  onProductUpdate?: (productId: string, updates: Partial<ProductCardData>) => void;
  isLoading?: boolean;
};

function scrollAnchorIntoView(node: HTMLElement | null | undefined) {
  node?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function MessageList({
  messages,
  productOverrides,
  variantOverrides,
  onProductUpdate,
  isLoading,
}: MessageListProps) {
  const compact = useChatPanelCompact();
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);
  const prevLastProductCount = useRef(0);
  const prevLastMessageId = useRef<string | null>(null);

  const lastMsg = messages[messages.length - 1];
  const showTyping =
    isLoading && lastMsg?.role === "assistant" && !lastMsg.content;

  // Reset product tracking when a new assistant message starts
  useEffect(() => {
    if (lastMsg?.id && lastMsg.id !== prevLastMessageId.current) {
      prevLastMessageId.current = lastMsg.id;
      prevLastProductCount.current = 0;
    }
  }, [lastMsg?.id]);

  // Scroll when user sends — anchor top of the new exchange, not the bottom
  useEffect(() => {
    const added = messages.length - prevMessageCount.current;
    prevMessageCount.current = messages.length;

    if (added < 2) return;

    const latest = messages[messages.length - 1];
    const previous = messages[messages.length - 2];
    if (previous?.role === "user" && latest?.role === "assistant") {
      requestAnimationFrame(() => scrollAnchorIntoView(scrollAnchorRef.current));
    }
  }, [messages.length]);

  // When products load, re-anchor to the top of the answer — never scroll to bottom
  useEffect(() => {
    const productCount = lastMsg?.products?.length ?? 0;
    if (productCount <= prevLastProductCount.current) return;

    prevLastProductCount.current = productCount;
    requestAnimationFrame(() => scrollAnchorIntoView(scrollAnchorRef.current));
  }, [lastMsg?.products?.length, lastMsg?.id]);

  const anchorOnLastAssistant =
    lastMsg?.role === "assistant" && (Boolean(lastMsg.content) || Boolean(lastMsg.products));

  return (
    <div
      className={cn(
        "messages-container flex-1 overflow-y-auto",
        compact ? "px-2 py-4" : "px-3 py-5 sm:px-4 sm:py-6"
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-3xl flex-col",
          compact ? "gap-4" : "gap-5 sm:gap-6"
        )}
      >
        {messages.map((message, index) => {
          if (message.role === "assistant" && !message.content && !message.products) {
            return null;
          }
          const products = message.products?.map((p) => {
            const merged = productOverrides?.[p.id] ?? p;
            if (!merged.variants?.length || !variantOverrides) return merged;
            return {
              ...merged,
              variants: merged.variants.map((v) => {
                const patch = variantOverrides[v.id];
                return patch
                  ? { ...v, price: patch.price ?? v.price, stockStatus: patch.stockStatus ?? v.stockStatus }
                  : v;
              }),
            };
          });
          const isLast = index === messages.length - 1;
          const isStreaming =
            isLoading && isLast && message.role === "assistant";
          const isAnchor = isLast && anchorOnLastAssistant;

          return (
            <div
              key={message.id}
              ref={isAnchor ? scrollAnchorRef : undefined}
              className="scroll-mt-4"
            >
              <MessageBubble
                message={message}
                products={products}
                onProductUpdate={onProductUpdate}
                isStreaming={isStreaming}
              />
            </div>
          );
        })}

        {showTyping && (
          <div ref={scrollAnchorRef} className="scroll-mt-4">
            <AssistantLoadingPanel />
          </div>
        )}
      </div>
    </div>
  );
}
