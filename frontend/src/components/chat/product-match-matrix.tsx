import { ArrowUpRight, GitCompareArrows } from "lucide-react";

import { SupplierBadge } from "@/components/chat/supplier-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CONNECTED_SUPPLIERS } from "@/config/nav";
import { getSupplierDisplayName } from "@/lib/suppliers/display-name";
import { getMatchedProducts } from "@/lib/chat/product-sort";
import { cn } from "@/lib/utils";
import type { ProductCardData } from "@/types/chat";

type SupplierPriceCell = {
  price: number | null;
  url?: string | null;
};

function buildPriceMap(product: ProductCardData): Map<string, SupplierPriceCell> {
  const map = new Map<string, SupplierPriceCell>();

  if (product.supplier_slug) {
    map.set(product.supplier_slug, {
      price: product.price > 0 ? product.price : null,
      url: product.url,
    });
  }

  for (const alt of product.alternatives ?? []) {
    map.set(alt.supplier_slug, {
      price: alt.price != null && alt.price > 0 ? alt.price : null,
      url: alt.url,
    });
  }

  return map;
}

type ProductMatchMatrixProps = {
  products: ProductCardData[];
  currency?: string;
  className?: string;
};

export function ProductMatchMatrix({
  products,
  currency = "AUD",
  className,
}: ProductMatchMatrixProps) {
  const matched = getMatchedProducts(products);
  if (matched.length === 0) return null;

  const suppliers = CONNECTED_SUPPLIERS.filter((s) =>
    matched.some((p) => buildPriceMap(p).has(s.slug))
  );

  if (suppliers.length < 2) return null;

  return (
    <div
      className={cn(
        "mb-4 overflow-hidden rounded-xl border border-border/70 bg-background/90 shadow-sm",
        className
      )}
    >
      <div className="flex items-start gap-2.5 border-b border-border/60 bg-muted/25 px-4 py-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <GitCompareArrows className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Same product across suppliers</p>
          <p className="text-xs text-muted-foreground">
            Side-by-side prices for {matched.length} matched{" "}
            {matched.length === 1 ? "item" : "items"} · {currency}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[140px] pl-4">Product</TableHead>
            {suppliers.map((s) => (
              <TableHead key={s.slug} className="text-center">
                <SupplierBadge slug={s.slug} name={s.name} size="sm" />
              </TableHead>
            ))}
            <TableHead className="pr-4 text-right">Save</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {matched.map((product) => {
            const priceMap = buildPriceMap(product);
            const prices = [...priceMap.values()]
              .map((c) => c.price)
              .filter((p): p is number => p != null);
            const minPrice = prices.length > 0 ? Math.min(...prices) : null;
            const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
            const savings =
              minPrice != null && maxPrice != null ? maxPrice - minPrice : null;

            return (
              <TableRow key={product.id}>
                <TableCell className="max-w-[180px] pl-4">
                  <p className="truncate text-xs font-medium text-foreground" title={product.name}>
                    {product.name}
                  </p>
                </TableCell>
                {suppliers.map((s) => {
                  const cell = priceMap.get(s.slug);
                  const price = cell?.price;
                  const isBest = price != null && minPrice != null && price === minPrice;

                  return (
                    <TableCell key={s.slug} className="text-center">
                      {price != null ? (
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span
                            className={cn(
                              "text-sm font-bold tabular-nums",
                              isBest
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-foreground"
                            )}
                          >
                            ${price.toFixed(2)}
                          </span>
                          {cell?.url && (
                            <a
                              href={cell.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                            >
                              View <ArrowUpRight className="size-2.5" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="pr-4 text-right">
                  {savings != null && savings > 0 ? (
                    <span className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      ${savings.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
