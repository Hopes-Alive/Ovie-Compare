import { Package } from "lucide-react";

import { FreshnessBadge } from "@/components/chat/freshness-badge";
import { LiveCheckButton } from "@/components/chat/live-check-button";
import type { ProductCardData, StockStatus } from "@/types/chat";

function stockLabel(status: StockStatus): string {
  switch (status) {
    case "in_stock":
      return "In stock";
    case "out_of_stock":
      return "Out of stock";
    case "low_stock":
      return "Low stock";
    case "unknown":
      return "Unknown";
  }
}

type ProductCardProps = {
  product: ProductCardData;
  onPriceUpdate?: (productId: string, newPrice: number) => void;
};

export function ProductCard({ product, onPriceUpdate }: ProductCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt=""
              className="size-full rounded-lg object-cover"
            />
          ) : (
            <Package className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">
            {product.supplier}
          </p>
          <p className="mt-0.5 font-medium leading-snug">{product.name}</p>
          <p className="mt-1 text-sm">
            ${product.price.toFixed(2)} {product.currency} ·{" "}
            {stockLabel(product.stockStatus)} · {product.deliveryText}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Checked {product.lastCheckedAgo}
            </span>
            <FreshnessBadge freshness={product.freshness} />
          </div>
        </div>
      </div>
      <div className="mt-3">
        <LiveCheckButton product={product} onPriceUpdate={onPriceUpdate} />
      </div>
    </div>
  );
}
