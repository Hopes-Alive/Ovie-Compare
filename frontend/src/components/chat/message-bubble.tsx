"use client";

import { ComparisonTable } from "@/components/chat/comparison-table";
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

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] space-y-3 rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <p>{message.content}</p>
        {displayProducts && displayProducts.length > 0 && (
          <div className="space-y-3 pt-1">
            <ComparisonTable products={displayProducts} />
            <div className="space-y-3">
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
    </div>
  );
}
