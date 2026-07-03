"use client";

import { ArrowDownWideNarrow, LayoutGrid } from "lucide-react";
import { useMemo, useState } from "react";

import { AssistantResponseStats } from "@/components/chat/assistant-response-stats";
import { ProductCard } from "@/components/chat/product-card";
import { ProductComparisonSummary } from "@/components/chat/product-comparison-summary";
import { ProductMatchMatrix } from "@/components/chat/product-match-matrix";
import { SupplierProductSection } from "@/components/chat/supplier-product-section";
import { useChatPanelCompact } from "@/hooks/use-chat-panel-compact";
import type { ResponseStats } from "@/lib/chat/response-stats";
import { sortGroupsByMinPrice, sortProductsByPrice } from "@/lib/chat/product-sort";
import { groupProductsBySupplier } from "@/lib/suppliers/display-name";
import { getSupplierTheme } from "@/lib/suppliers/supplier-theme";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/types/chat";

type ViewMode = "supplier" | "price";

type ProductResultsPanelProps = {
  products: ProductCardData[];
  stats: ResponseStats;
  cheapestGroupKey: string | null;
  onProductUpdate?: (productId: string, updates: Partial<ProductCardData>) => void;
  className?: string;
};

function lowestPrice(products: ProductCardData[]): number | null {
  const prices = products.map((p) => p.price).filter((p) => p > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export function ProductResultsPanel({
  products,
  stats,
  cheapestGroupKey,
  onProductUpdate,
  className,
}: ProductResultsPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("supplier");
  const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined);

  const supplierGroups = useMemo(
    () => sortGroupsByMinPrice(groupProductsBySupplier(products)),
    [products]
  );
  const priceSorted = useMemo(() => sortProductsByPrice(products), [products]);
  const multiSupplier = supplierGroups.length > 1;
  const compact = useChatPanelCompact();

  function scrollToSupplier(key: string) {
    document.getElementById(`supplier-section-${key}`)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }

  return (
    <div className={cn(compact ? "space-y-4" : "space-y-5", className)}>
      <AssistantResponseStats stats={stats} compact={compact} />

      {multiSupplier && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {supplierGroups.map((group) => {
            const theme = getSupplierTheme(group.slug);
            const isCheapest = group.key === cheapestGroupKey;
            return (
              <button
                key={group.key}
                type="button"
                onClick={() => scrollToSupplier(group.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-90",
                  theme.chip,
                  isCheapest && "ring-2 ring-emerald-500/25"
                )}
              >
                {group.name}
              </button>
            );
          })}
        </div>
      )}

      {multiSupplier && (
        <ProductComparisonSummary
          groups={supplierGroups}
          currency={stats.currency}
          compact={compact}
        />
      )}
      <ProductMatchMatrix products={products} currency={stats.currency} />

      <p className={cn("leading-relaxed text-muted-foreground", compact ? "text-xs" : "text-sm")}>
        {multiSupplier ? (
          compact ? (
            <>
              Expand a supplier below for individual products and current prices. Use{" "}
              <span className="font-medium text-foreground/80">Expand all</span> or{" "}
              <span className="font-medium text-foreground/80">By price</span> to change the
              view.
            </>
          ) : (
            <>
              Each supplier is grouped below — expand a section to see individual products,
              photos, and supplier links. Use{" "}
              <span className="font-medium text-foreground/80">Check current status</span> on each
              card to refresh price and stock. Tap{" "}
              <span className="font-medium text-foreground/80">Expand all</span> to open
              everything at once, or switch to{" "}
              <span className="font-medium text-foreground/80">By price</span> to rank every
              listing from cheapest up.
            </>
          )
        ) : (
          <>
            Expand below to see individual products, photos, and use{" "}
            <span className="font-medium text-foreground/80">Check current status</span> to
            refresh price and stock from the supplier site.
          </>
        )}
      </p>

      <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("supplier")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              viewMode === "supplier"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="size-3.5" />
            By supplier
          </button>
          <button
            type="button"
            onClick={() => setViewMode("price")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              viewMode === "price"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ArrowDownWideNarrow className="size-3.5" />
            By price
          </button>
        </div>

        {viewMode === "supplier" && multiSupplier && (
          <button
            type="button"
            onClick={() => setExpandAll((prev) => (prev === true ? false : true))}
            className="self-end text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline sm:self-auto"
          >
            {expandAll === true ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>

      {viewMode === "supplier" ? (
        <div className={cn("flex flex-col", multiSupplier ? "gap-4" : "gap-0")}>
          {supplierGroups.map((group, index) => (
            <div
              key={group.key}
              id={`supplier-section-${group.key}`}
              className="chat-stagger-in scroll-mt-4"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <SupplierProductSection
                slug={group.slug}
                name={group.name}
                productCount={group.products.length}
                lowestPrice={lowestPrice(group.products)}
                currency={group.products[0]?.currency}
                defaultCollapsed
                isCheapestSupplier={group.key === cheapestGroupKey}
                expandAll={expandAll}
              >
                {sortProductsByPrice(group.products).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onProductUpdate={onProductUpdate}
                    showSupplierBadge={false}
                    variant="embedded"
                    supplierSlug={group.slug}
                    isBestPrice={product.id === stats.cheapestProductId}
                  />
                ))}
              </SupplierProductSection>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {priceSorted.map((product, index) => (
            <div
              key={product.id}
              className="chat-stagger-in"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <ProductCard
                product={product}
                onProductUpdate={onProductUpdate}
                showSupplierBadge
                variant="embedded"
                supplierSlug={product.supplier_slug}
                isBestPrice={product.id === stats.cheapestProductId}
                density="compact"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
