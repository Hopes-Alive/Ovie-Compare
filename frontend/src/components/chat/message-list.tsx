"use client";

import { MessageBubble } from "@/components/chat/message-bubble";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatMessage, ProductCardData } from "@/types/chat";

type MessageListProps = {
  messages: ChatMessage[];
  productOverrides?: Record<string, ProductCardData>;
  onPriceUpdate?: (productId: string, newPrice: number) => void;
};

export function MessageList({
  messages,
  productOverrides,
  onPriceUpdate,
}: MessageListProps) {
  return (
    <ScrollArea className="flex-1 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {messages.map((message) => {
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
      </div>
    </ScrollArea>
  );
}
