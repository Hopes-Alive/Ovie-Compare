import { cn } from "@/lib/utils";
import { formatStockLabel } from "@/lib/chat/product-check-labels";

export type ProductCheckFieldChange = {
  label: string;
  from: string;
  to: string;
};

type ProductCheckResultPanelProps = {
  variant: "live" | "ai";
  result: "unchanged" | "changed" | "login_required";
  changes?: ProductCheckFieldChange[];
  oldPrice: number | null;
  newPrice: number | null;
  stockStatus?: string | null;
};

const VARIANT_STYLES = {
  live: "border-emerald-200 bg-emerald-50 text-emerald-900",
  ai: "border-violet-200 bg-violet-50 text-violet-900",
} as const;

function formatPrice(price: number | null): string {
  if (price == null) return "—";
  return `$${price.toFixed(2)}`;
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

function changeSentence(change: ProductCheckFieldChange): string {
  const label = change.label.toLowerCase();
  const from = change.from.trim() || "—";
  const to = change.to.trim() || "—";

  if (from === "—" || from === "") {
    return `${label.charAt(0).toUpperCase()}${label.slice(1)} is now ${to}.`;
  }

  return `${label.charAt(0).toUpperCase()}${label.slice(1)} was ${from}, now ${to}.`;
}

function statusSummary(price: number | null, stockStatus?: string | null): string {
  const parts = [formatPrice(price)];
  if (stockStatus) parts.push(formatStockLabel(stockStatus));
  return parts.join(", ");
}

export function ProductCheckResultPanel({
  variant,
  result,
  changes = [],
  oldPrice,
  newPrice,
  stockStatus,
}: ProductCheckResultPanelProps) {
  const visibleChanges =
    changes.length > 0
      ? changes
      : result === "changed"
        ? [priceFallbackChange(oldPrice, newPrice)].filter(
            (c): c is ProductCheckFieldChange => c != null,
          )
        : [];

  if (result === "login_required") {
    return (
      <div
        className={cn(
          "rounded-lg border px-3 py-2 text-xs leading-relaxed",
          "border-amber-200 bg-amber-50 text-amber-900",
        )}
      >
        <p>Could not verify — login may be required.</p>
        <p className="mt-1 opacity-80">
          Last known: {statusSummary(oldPrice, stockStatus)}
        </p>
      </div>
    );
  }

  if (result === "unchanged" || visibleChanges.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border px-3 py-2 text-xs leading-relaxed",
          VARIANT_STYLES[variant],
        )}
      >
        <p>No changes — still {statusSummary(newPrice ?? oldPrice, stockStatus)}.</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2 text-xs leading-relaxed",
        VARIANT_STYLES[variant],
      )}
    >
      <div className="space-y-1">
        {visibleChanges.map((change) => (
          <p key={change.label}>{changeSentence(change)}</p>
        ))}
      </div>
    </div>
  );
}
