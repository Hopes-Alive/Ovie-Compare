import { ArrowUpRight } from "lucide-react";

import { FreshnessBadge } from "@/components/chat/freshness-badge";
import { LiveCheckButton } from "@/components/chat/live-check-button";
import { ProductImageCarousel } from "@/components/chat/product-image-carousel";
import { Badge } from "@/components/ui/badge";
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

function stockColor(status: StockStatus): string {
  switch (status) {
    case "in_stock":
      return "text-green-600 dark:text-green-400";
    case "out_of_stock":
      return "text-red-500";
    case "low_stock":
      return "text-amber-500";
    case "unknown":
      return "text-muted-foreground";
  }
}

type ProductCardProps = {
  product: ProductCardData;
  onPriceUpdate?: (productId: string, newPrice: number) => void;
};

export function ProductCard({ product, onPriceUpdate }: ProductCardProps) {
  const hasAlternatives = product.alternatives && product.alternatives.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Main product row */}
      <div className="flex gap-0">
        {/* Product image carousel */}
        <div className="h-28 w-28 shrink-0">
          <ProductImageCarousel
            imageUrls={product.imageUrls ?? (product.imageUrl ? [product.imageUrl] : [])}
            name={product.name}
          />
        </div>

        {/* Product details */}
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{product.supplier}</p>
              <p className="mt-0.5 font-medium leading-snug">{product.name}</p>
            </div>
            {product.url && (
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="View on supplier site"
              >
                <ArrowUpRight className="size-4" />
              </a>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold">
              {product.price > 0
                ? `$${product.price.toFixed(2)} ${product.currency}`
                : "Price unavailable"}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className={stockColor(product.stockStatus)}>
              {stockLabel(product.stockStatus)}
            </span>
            {product.deliveryText && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{product.deliveryText}</span>
              </>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Checked {product.lastCheckedAgo}
            </span>
            <FreshnessBadge freshness={product.freshness} />
          </div>
        </div>
      </div> {/* end main row */}

      {/* Cross-supplier alternatives (canonical matches) */}
      {hasAlternatives && (
        <div className="border-t border-border bg-muted/40 px-4 py-2.5">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Also available at
          </p>
          <div className="space-y-1.5">
            {product.alternatives!.map((alt) => (
              <div key={alt.supplier_slug} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {alt.supplier}
                  </Badge>
                  <span className="truncate text-xs text-muted-foreground">{alt.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-sm font-semibold">
                    {alt.price != null && alt.price > 0
                      ? `$${alt.price.toFixed(2)}`
                      : "—"}
                  </span>
                  {alt.url && (
                    <a
                      href={alt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ArrowUpRight className="size-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Price difference callout */}
          {(() => {
            const mainPrice = product.price;
            const alt = product.alternatives!.find(
              (a) => a.price != null && a.price > 0
            );
            if (!alt || !mainPrice || mainPrice <= 0 || !alt.price) return null;
            const diff = Math.abs(mainPrice - alt.price);
            const cheaper =
              mainPrice < alt.price ? product.supplier : alt.supplier;
            return (
              <p className="mt-2 text-xs font-medium text-green-700 dark:text-green-400">
                {cheaper} is cheaper by ${diff.toFixed(2)} {product.currency}
              </p>
            );
          })()}
        </div>
      )}

      {/* Live check */}
      <div className="border-t border-border px-4 py-2.5">
        <LiveCheckButton product={product} onPriceUpdate={onPriceUpdate} />
      </div>
    </div>
  );
}
