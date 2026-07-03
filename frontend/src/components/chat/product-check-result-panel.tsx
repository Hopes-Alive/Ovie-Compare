import { CheckCircle2, Lock, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatStockLabel } from "@/lib/chat/product-check-labels";
import type { ProductCheckFieldChange } from "@/types/chat";

export type { ProductCheckFieldChange };

type ProductCheckResultPanelProps = {
  variant: "live" | "ai";
  result: "unchanged" | "changed" | "login_required";
  changes?: ProductCheckFieldChange[];
  oldPrice: number | null;
  newPrice: number | null;
  oldStockStatus?: string | null;
  stockStatus?: string | null;
};

const VARIANT_HEADER = {
  live: {
    changed: "border-emerald-200 bg-emerald-50/80 text-emerald-950",
    unchanged: "border-emerald-200/80 bg-emerald-50/50 text-emerald-900",
    icon: "text-emerald-600",
  },
  ai: {
    changed: "border-violet-200 bg-violet-50/80 text-violet-950",
    unchanged: "border-violet-200/80 bg-violet-50/50 text-violet-900",
    icon: "text-violet-600",
  },
} as const;

function formatPrice(price: number | null): string {
  if (price == null) return "—";
  return `$${price.toFixed(2)}`;
}

function normalizeStock(value: string | null | undefined): string {
  if (!value) return "—";
  return formatStockLabel(value);
}

function priceFallbackChange(
  oldPrice: number | null,
  newPrice: number | null,
): ProductCheckFieldChange | null {
  if (oldPrice == null && newPrice == null) return null;
  if (oldPrice != null && newPrice != null && Math.abs(oldPrice - newPrice) <= 0.001) {
    return null;
  }
  return {
    label: "Price",
    from: formatPrice(oldPrice),
    to: formatPrice(newPrice),
  };
}

function stockFallbackChange(
  oldStock: string | null | undefined,
  newStock: string | null | undefined,
): ProductCheckFieldChange | null {
  const from = normalizeStock(oldStock);
  const to = normalizeStock(newStock);
  if (from === to) return null;
  if (from === "—" && to === "—") return null;
  return { label: "Stock", from, to };
}

function resolveVisibleChanges(
  result: ProductCheckResultPanelProps["result"],
  changes: ProductCheckFieldChange[],
  oldPrice: number | null,
  newPrice: number | null,
  oldStockStatus: string | null | undefined,
  stockStatus: string | null | undefined,
): ProductCheckFieldChange[] {
  if (result !== "changed") return [];

  const merged = [...changes];
  const labels = new Set(merged.map((c) => c.label.toLowerCase()));

  const priceChange = priceFallbackChange(oldPrice, newPrice);
  if (priceChange && !labels.has("price")) merged.push(priceChange);

  const stockChange = stockFallbackChange(oldStockStatus, stockStatus);
  if (stockChange && !labels.has("stock")) merged.push(stockChange);

  return merged;
}

function FieldChangeRow({ change }: { change: ProductCheckFieldChange }) {
  const from = change.from.trim() || "—";
  const to = change.to.trim() || "—";
  const isNew = from === "—";

  return (
    <li className="flex flex-col gap-0.5 rounded-md bg-background/60 px-2 py-1.5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
        {change.label}
      </span>
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs">
        {isNew ? (
          <span className="text-muted-foreground">Was empty</span>
        ) : (
          <span
            className="max-w-[45%] truncate text-muted-foreground line-through decoration-muted-foreground/40"
            title={from}
          >
            {from}
          </span>
        )}
        <span className="shrink-0 text-muted-foreground" aria-hidden>
          →
        </span>
        <span className="font-medium text-foreground" title={to}>
          {to}
        </span>
      </div>
    </li>
  );
}

function statusSummary(price: number | null, stockStatus?: string | null): string {
  const parts = [formatPrice(price)];
  if (stockStatus) parts.push(normalizeStock(stockStatus));
  return parts.join(" · ");
}

export function ProductCheckResultPanel({
  variant,
  result,
  changes = [],
  oldPrice,
  newPrice,
  oldStockStatus,
  stockStatus,
}: ProductCheckResultPanelProps) {
  const styles = VARIANT_HEADER[variant];
  const visibleChanges = resolveVisibleChanges(
    result,
    changes,
    oldPrice,
    newPrice,
    oldStockStatus,
    stockStatus,
  );

  if (result === "login_required") {
    return (
      <div
        className={cn(
          "rounded-lg border px-3 py-2.5 text-xs leading-relaxed",
          "border-amber-200 bg-amber-50 text-amber-950",
        )}
        role="status"
      >
        <div className="flex items-start gap-2">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-medium">Could not verify live data</p>
            <p className="mt-0.5 text-amber-800/90">
              Supplier login may be required to see the current price.
            </p>
            <p className="mt-1.5 text-[11px] text-amber-800/75">
              Last known: {statusSummary(oldPrice, oldStockStatus ?? stockStatus)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (result === "unchanged" || visibleChanges.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border px-3 py-2.5 text-xs",
          styles.unchanged,
        )}
        role="status"
      >
        <div className="flex items-start gap-2">
          <CheckCircle2 className={cn("mt-0.5 size-3.5 shrink-0", styles.icon)} />
          <div>
            <p className="font-medium">Up to date</p>
            <p className="mt-0.5 opacity-80">
              {statusSummary(newPrice ?? oldPrice, stockStatus ?? oldStockStatus)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const count = visibleChanges.length;

  return (
    <div
      className={cn("rounded-lg border px-3 py-2.5 text-xs", styles.changed)}
      role="status"
    >
      <div className="mb-2 flex items-center gap-2">
        {variant === "ai" ? (
          <Sparkles className={cn("size-3.5 shrink-0", styles.icon)} />
        ) : (
          <CheckCircle2 className={cn("size-3.5 shrink-0", styles.icon)} />
        )}
        <p className="font-semibold">
          {count === 1 ? "1 field updated" : `${count} fields updated`}
        </p>
      </div>
      <ul className="space-y-1.5">
        {visibleChanges.map((change) => (
          <FieldChangeRow key={`${change.label}-${change.from}-${change.to}`} change={change} />
        ))}
      </ul>
    </div>
  );
}
