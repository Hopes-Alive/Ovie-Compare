import { ArrowUpRight, Trophy } from "lucide-react";

import { SupplierBadge } from "@/components/chat/supplier-badge";
import { getSupplierDisplayName } from "@/lib/suppliers/display-name";
import { getSupplierTheme } from "@/lib/suppliers/supplier-theme";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/types/chat";

type PriceRow = {
  key: string;
  slug?: string;
  name: string;
  price: number;
  url?: string | null;
  isCurrent: boolean;
};

function buildPriceRows(
  product: ProductCardData,
  supplierName: string
): PriceRow[] {
  const rows: PriceRow[] = [
    {
      key: product.supplier_slug ?? product.supplier,
      slug: product.supplier_slug,
      name: supplierName,
      price: product.price,
      url: product.url,
      isCurrent: true,
    },
  ];

  for (const alt of product.alternatives ?? []) {
    if (alt.price == null || alt.price <= 0) continue;
    rows.push({
      key: alt.supplier_slug,
      slug: alt.supplier_slug,
      name: getSupplierDisplayName(alt.supplier_slug, alt.supplier),
      price: alt.price,
      url: alt.url,
      isCurrent: false,
    });
  }

  return rows.sort((a, b) => a.price - b.price);
}

type ProductAlternativeComparisonProps = {
  product: ProductCardData;
  supplierName: string;
  embedded?: boolean;
  className?: string;
};

export function ProductAlternativeComparison({
  product,
  supplierName,
  embedded,
  className,
}: ProductAlternativeComparisonProps) {
  const rows = buildPriceRows(product, supplierName);
  if (rows.length < 2) return null;

  const maxPrice = Math.max(...rows.map((r) => r.price));
  const minPrice = rows[0]!.price;
  const cheapest = rows[0]!;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Same product · price comparison
        </p>
        {cheapest.price < maxPrice && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            <Trophy className="size-3" />
            {cheapest.name} wins
          </span>
        )}
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const theme = getSupplierTheme(row.slug);
          const isCheapest = row.price === minPrice;
          const barWidth = maxPrice > 0 ? Math.max(12, (row.price / maxPrice) * 100) : 100;
          const savings = row.price - minPrice;

          return (
            <div
              key={row.key}
              className={cn(
                "rounded-lg border px-3 py-2.5",
                embedded ? cn(theme.cardBg, theme.cardBorder) : "border-border/50 bg-background/80",
                isCheapest && "ring-1 ring-emerald-500/25"
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <SupplierBadge slug={row.slug} name={row.name} size="sm" />
                  {row.isCurrent && (
                    <span className="text-[10px] font-medium text-muted-foreground">Listed</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      isCheapest ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
                    )}
                  >
                    ${row.price.toFixed(2)}
                  </span>
                  {row.url && (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      title={`View on ${row.name}`}
                    >
                      <ArrowUpRight className="size-3.5" />
                    </a>
                  )}
                </div>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isCheapest ? "bg-emerald-500" : theme.barFill
                  )}
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              {!isCheapest && savings > 0 && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  +${savings.toFixed(2)} vs cheapest
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
