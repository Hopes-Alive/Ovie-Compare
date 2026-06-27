"use client";

import { AssistantAvatar } from "@/components/chat/assistant-avatar";
import { AssistantAnswerPanel } from "@/components/chat/assistant-answer-panel";
import { ProductResultsPanel } from "@/components/chat/product-results-panel";
import { useChatPanelCompact } from "@/hooks/use-chat-panel-compact";
import { computeResponseStats } from "@/lib/chat/response-stats";
import { groupProductsBySupplier } from "@/lib/suppliers/display-name";
import { cn } from "@/lib/utils";
import type { ChatMessage, ProductCardData } from "@/types/chat";

type MessageBubbleProps = {
  message: ChatMessage;
  products?: ProductCardData[];
  onPriceUpdate?: (productId: string, newPrice: number) => void;
  isStreaming?: boolean;
};

function lowestPrice(products: ProductCardData[]): number | null {
  const prices = products.map((p) => p.price).filter((p) => p > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export function MessageBubble({
  message,
  products,
  onPriceUpdate,
  isStreaming,
}: MessageBubbleProps) {
  const compact = useChatPanelCompact();
  const isUser = message.role === "user";
  const displayProducts = products ?? message.products;
  const hasContent = Boolean(message.content?.trim());
  const supplierGroups = displayProducts?.length
    ? groupProductsBySupplier(displayProducts)
    : [];
  const stats = displayProducts?.length
    ? computeResponseStats(displayProducts)
    : null;

  const cheapestGroupKey = supplierGroups.reduce<string | null>((bestKey, group) => {
    const groupMin = lowestPrice(group.products);
    if (groupMin == null) return bestKey;
    if (!bestKey) return group.key;
    const currentBest = supplierGroups.find((g) => g.key === bestKey);
    const currentMin = currentBest ? lowestPrice(currentBest.products) : null;
    if (currentMin == null || groupMin < currentMin) return group.key;
    return bestKey;
  }, null);

  if (isUser) {
    return (
      <div className="chat-message-in flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground shadow-md">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <article className="chat-message-in flex items-start gap-3">
      <AssistantAvatar className="mt-1" />

      <div className="min-w-0 flex-1">
        <div className="min-w-0 flex-1 overflow-x-hidden rounded-2xl border border-border/70 bg-card/95 shadow-lg backdrop-blur-sm">
          {hasContent && (
            <div className={cn("py-4", compact ? "px-3" : "px-4 sm:px-5")}>
              <AssistantAnswerPanel content={message.content} isStreaming={isStreaming} />
            </div>
          )}

          {supplierGroups.length > 0 && stats && (
            <div
              className={cn(
                compact ? "px-3 py-4" : "px-4 py-5 sm:px-5",
                hasContent && "border-t border-border/50"
              )}
            >
              <h3 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground sm:mb-4">
                Product results
              </h3>
              <ProductResultsPanel
                products={displayProducts!}
                stats={stats}
                cheapestGroupKey={cheapestGroupKey}
                onPriceUpdate={onPriceUpdate}
              />
            </div>
          )}

          {(hasContent || supplierGroups.length > 0) && !isStreaming && (
            <div
              className={cn(
                "border-t border-border/50 bg-muted/20 py-2.5",
                compact ? "px-3" : "px-4 sm:px-5"
              )}
            >
              <p className="text-[11px] text-muted-foreground">
                Prices in {stats?.currency ?? "AUD"} · sourced from supplier catalogues · use{" "}
                <span className="font-medium text-foreground/80">Check live price</span> to
                refresh
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
