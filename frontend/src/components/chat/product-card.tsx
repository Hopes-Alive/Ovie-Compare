"use client";

import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useState } from "react";

import { BestPriceBadge } from "@/components/chat/best-price-badge";
import { FreshnessBadge } from "@/components/chat/freshness-badge";
import { LiveCheckButton } from "@/components/chat/live-check-button";
import { ProductAlternativeComparison } from "@/components/chat/product-alternative-comparison";
import { ProductImageCarousel } from "@/components/chat/product-image-carousel";
import { SupplierBadge } from "@/components/chat/supplier-badge";
import { getSupplierDisplayName } from "@/lib/suppliers/display-name";
import { getSupplierTheme } from "@/lib/suppliers/supplier-theme";
import { cn } from "@/lib/utils";
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

function stockClass(status: StockStatus): string {
  switch (status) {
    case "in_stock":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "out_of_stock":
      return "bg-red-50 text-red-700 ring-red-200/80 dark:bg-red-950/40 dark:text-red-300";
    case "low_stock":
      return "bg-amber-50 text-amber-700 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground ring-border";
  }
}

function productMetadataLines(product: ProductCardData): string[] {
  const lines: string[] = [];
  if (product.isNew && product.addedAgo) {
    lines.push(`New · added ${product.addedAgo}`);
  }
  if (product.priceChangeStatus === "changed" && product.priceChangedAgo) {
    const prev =
      product.previousPrice != null && product.previousPrice > 0
        ? ` ($${product.previousPrice.toFixed(2)} → $${product.price.toFixed(2)})`
        : "";
    lines.push(`Price updated ${product.priceChangedAgo}${prev}`);
  } else if (product.priceChangeStatus === "unchanged") {
    lines.push(`Price unchanged · checked ${product.lastCheckedAgo}`);
  } else if (product.lastCheckedAgo && product.lastCheckedAgo !== "unknown") {
    lines.push(`Checked ${product.lastCheckedAgo}`);
  } else {
    lines.push("Not checked yet");
  }
  return lines;
}

type ProductCardProps = {
  product: ProductCardData;
  onPriceUpdate?: (productId: string, newPrice: number) => void;
  showSupplierBadge?: boolean;
  variant?: "default" | "embedded";
  supplierSlug?: string | null;
  isBestPrice?: boolean;
  density?: "comfortable" | "compact";
};

export function ProductCard({
  product,
  onPriceUpdate,
  showSupplierBadge = true,
  variant = "default",
  supplierSlug,
  isBestPrice,
  density = "comfortable",
}: ProductCardProps) {
  const hasAlternatives = product.alternatives && product.alternatives.length > 0;
  const supplierName = getSupplierDisplayName(product.supplier_slug, product.supplier);
  const theme = getSupplierTheme(supplierSlug ?? product.supplier_slug);
  const isEmbedded = variant === "embedded";
  const isCompact = density === "compact";
  const [altsOpen, setAltsOpen] = useState(false);

  const priceDisplay =
    product.price > 0 ? `$${product.price.toFixed(2)}` : "Price N/A";
  const metadataLines = productMetadataLines(product);

  if (isCompact) {
    return (
      <article
        className={cn(
          "overflow-hidden rounded-lg border shadow-sm transition-all",
          theme.cardBg,
          theme.cardBorder,
          theme.cardHover,
          isBestPrice && "ring-1 ring-emerald-500/30"
        )}
      >
        <div className="flex items-start gap-3 p-3">
          <div className="size-14 shrink-0 overflow-hidden rounded-md bg-muted/40">
            <ProductImageCarousel
              imageUrls={product.imageUrls ?? (product.imageUrl ? [product.imageUrl] : [])}
              supplierSlug={product.supplier_slug}
              name={product.name}
              className="rounded-md"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <SupplierBadge slug={product.supplier_slug} name={supplierName} size="sm" />
              {isBestPrice && <BestPriceBadge size="sm" label="Best" />}
            </div>
            <h4 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
              {product.name}
            </h4>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                  stockClass(product.stockStatus)
                )}
              >
                {stockLabel(product.stockStatus)}
              </span>
              <FreshnessBadge freshness={product.freshness} className="text-[9px]" />
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span
              className={cn(
                "text-lg font-bold tabular-nums",
                isBestPrice ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
              )}
            >
              {priceDisplay}
            </span>
            {product.url && (
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-md border px-2 py-1 text-[10px] font-medium",
                  theme.cardBorder,
                  theme.accentBg,
                  theme.accentText
                )}
              >
                View <ArrowUpRight className="size-3" />
              </a>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border shadow-sm transition-all",
        isEmbedded
          ? cn(theme.cardBg, theme.cardBorder, theme.cardHover)
          : "border-border/70 bg-background hover:shadow-md",
        isBestPrice && "ring-1 ring-emerald-500/30"
      )}
    >
      {showSupplierBadge && (
        <div
          className={cn(
            "flex items-center border-b px-3 py-2 sm:px-4",
            isEmbedded ? cn(theme.headerBorder, theme.headerBg) : "border-border/60 bg-muted/20"
          )}
        >
          <SupplierBadge slug={product.supplier_slug} name={supplierName} size="sm" />
        </div>
      )}

      <div className="flex gap-3 p-3 sm:gap-4 sm:p-3.5">
        <div className="size-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-muted/30 sm:size-24">
          <ProductImageCarousel
            imageUrls={product.imageUrls ?? (product.imageUrl ? [product.imageUrl] : [])}
            supplierSlug={product.supplier_slug}
            name={product.name}
            className="rounded-lg"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-start gap-2">
            <h4 className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground [overflow-wrap:anywhere] sm:text-[15px]">
              {product.name}
            </h4>
            {isBestPrice && <BestPriceBadge size="sm" />}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                stockClass(product.stockStatus)
              )}
            >
              {stockLabel(product.stockStatus)}
            </span>
            <FreshnessBadge freshness={product.freshness} className="text-[10px]" />
          </div>

          {product.deliveryText && (
            <p className="text-xs leading-relaxed text-muted-foreground">{product.deliveryText}</p>
          )}

          <div className="flex items-end justify-between gap-3 border-t border-border/40 pt-2">
            <div>
              <span
                className={cn(
                  "text-xl font-bold tabular-nums sm:text-2xl",
                  isBestPrice
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-foreground"
                )}
              >
                {priceDisplay}
              </span>
              {product.price > 0 && (
                <span className="ml-1.5 text-xs font-medium text-muted-foreground">
                  {product.currency}
                </span>
              )}
              <div className="mt-0.5 space-y-0.5">
                {metadataLines.map((line) => (
                  <p key={line} className="text-[11px] text-muted-foreground">
                    {line}
                  </p>
                ))}
              </div>
            </div>
            {product.url && (
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                  isEmbedded
                    ? cn(theme.cardBorder, theme.accentBg, theme.accentText, "hover:opacity-90")
                    : "border-border/70 bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                View
                <ArrowUpRight className="size-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {hasAlternatives && (
        <div
          className={cn(
            "border-t",
            isEmbedded
              ? cn(theme.headerBorder, "bg-black/[0.02] dark:bg-white/[0.03]")
              : "border-border/60 bg-muted/20"
          )}
        >
          <button
            type="button"
            onClick={() => setAltsOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left sm:px-3.5"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Same product at other suppliers
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                altsOpen && "rotate-180"
              )}
            />
          </button>
          {altsOpen && (
            <div className="px-3 pb-3 sm:px-3.5">
              <ProductAlternativeComparison
                product={product}
                supplierName={supplierName}
                embedded={isEmbedded}
              />
            </div>
          )}
        </div>
      )}

      <div
        className={cn(
          "border-t px-3 py-2 sm:px-3.5",
          isEmbedded ? theme.headerBorder : "border-border/60"
        )}
      >
        <LiveCheckButton product={product} onPriceUpdate={onPriceUpdate} />
      </div>
    </article>
  );
}
