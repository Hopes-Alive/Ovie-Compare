"use client";

import ReactMarkdown from "react-markdown";

import { ProductCard } from "@/components/chat/product-card";
import { cn } from "@/lib/utils";
import type { ChatMessage, ProductCardData } from "@/types/chat";

type MessageBubbleProps = {
  message: ChatMessage;
  products?: ProductCardData[];
  onPriceUpdate?: (productId: string, newPrice: number) => void;
};

export function MessageBubble({
  message,
  products,
  onPriceUpdate,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const displayProducts = products ?? message.products;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary select-none">
          O
        </div>

        {/* Text bubble */}
        <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm leading-relaxed text-foreground">
          <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2 [&>ul]:pl-4 [&>ol]:pl-4 [&_strong]:font-semibold [&_li]:mb-0.5">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        </div>
      </div>

      {/* Product cards — outside the bubble, full message width */}
      {displayProducts && displayProducts.length > 0 && (
        <div className="pl-11">
          {/* Summary bar */}
          <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {displayProducts.length} product{displayProducts.length !== 1 ? "s" : ""} found
          </p>
          <div className="grid gap-3 sm:grid-cols-1">
            {displayProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onPriceUpdate={onPriceUpdate}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
