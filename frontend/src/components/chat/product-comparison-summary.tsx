import { ArrowDown, Trophy } from "lucide-react";

import { SupplierLogoBanner } from "@/components/chat/supplier-logo-image";
import type { SupplierProductGroup } from "@/lib/suppliers/display-name";
import { cn } from "@/lib/utils";

type SupplierPriceSummary = {
  slug: string;
  name: string;
  minPrice: number;
  productCount: number;
};

function buildSummaries(groups: SupplierProductGroup[]): SupplierPriceSummary[] {
  return groups
    .map((group) => {
      const prices = group.products.map((p) => p.price).filter((p) => p > 0);
      if (prices.length === 0) return null;
      return {
        slug: group.slug,
        name: group.name,
        minPrice: Math.min(...prices),
        productCount: group.products.length,
      };
    })
    .filter((s): s is SupplierPriceSummary => s != null)
    .sort((a, b) => a.minPrice - b.minPrice);
}

type ProductComparisonSummaryProps = {
  groups: SupplierProductGroup[];
  currency?: string;
  compact?: boolean;
  className?: string;
};

export function ProductComparisonSummary({
  groups,
  currency = "AUD",
  compact = false,
  className,
}: ProductComparisonSummaryProps) {
  if (groups.length < 2) return null;

  const summaries = buildSummaries(groups);
  if (summaries.length < 2) return null;

  const cheapest = summaries[0]!;
  const runnerUp = summaries[1]!;
  const savings = runnerUp.minPrice - cheapest.minPrice;
  const savingsPct =
    runnerUp.minPrice > 0 ? Math.round((savings / runnerUp.minPrice) * 100) : 0;

  return (
    <section
      className={cn("space-y-3", className)}
      aria-label="Supplier price comparison"
    >
      <div className="space-y-1 px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Compare suppliers
        </p>
        {compact ? (
          <div className="space-y-0.5">
            <p className="text-sm leading-snug text-foreground">
              <span className="font-semibold">{cheapest.name}</span> is the cheapest
            </p>
            {savings > 0 && (
              <p className="text-xs text-muted-foreground">
                Save{" "}
                <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  ${savings.toFixed(2)} {currency}
                </span>
                {savingsPct > 0 && <> ({savingsPct}% vs {runnerUp.name})</>}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm leading-snug text-foreground">
            <span className="font-semibold">{cheapest.name}</span> is the cheapest
            {savings > 0 && (
              <>
                {" — "}
                <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  ${savings.toFixed(2)} {currency}
                </span>{" "}
                less
                {savingsPct > 0 && (
                  <span className="text-muted-foreground"> ({savingsPct}%)</span>
                )}
              </>
            )}
          </p>
        )}
      </div>

      <div
        className={cn(
          "grid gap-2.5",
          compact ? "grid-cols-1" : summaries.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"
        )}
      >
        {summaries.map((summary, index) => (
          <SupplierCompareCard
            key={summary.slug || summary.name}
            summary={summary}
            currency={currency}
            compact={compact}
            isCheapest={index === 0}
            delta={summary.minPrice - cheapest.minPrice}
            savings={savings}
            runnerUpName={runnerUp.name}
          />
        ))}
      </div>
    </section>
  );
}

function SupplierCompareCard({
  summary,
  currency,
  compact,
  isCheapest,
  delta,
  savings,
  runnerUpName,
}: {
  summary: SupplierPriceSummary;
  currency: string;
  compact: boolean;
  isCheapest: boolean;
  delta: number;
  savings: number;
  runnerUpName: string;
}) {
  const savingsNote = isCheapest
    ? savings > 0 && (
        <>
          Save{" "}
          <span className="font-semibold tabular-nums">${savings.toFixed(2)}</span> vs{" "}
          {runnerUpName}
        </>
      )
    : delta > 0 && (
        <>
          <span className="font-semibold tabular-nums text-foreground/75">
            +${delta.toFixed(2)}
          </span>{" "}
          vs cheapest
        </>
      );

  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border bg-background shadow-sm",
        compact ? "p-3" : "p-3.5 sm:p-4",
        isCheapest
          ? "border-emerald-300/70 ring-1 ring-emerald-500/15 dark:border-emerald-800/60"
          : "border-border/60"
      )}
    >
      {isCheapest && (
        <span className="mb-2.5 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white">
          <Trophy className="size-2.5 shrink-0" aria-hidden />
          Best price
        </span>
      )}

      <SupplierLogoBanner slug={summary.slug} name={summary.name} compact={compact} />

      <p className="mt-2 text-xs text-muted-foreground">
        {summary.productCount}{" "}
        {summary.productCount === 1 ? "listing" : "listings"}
      </p>

      <div className="mt-3 flex items-end justify-between gap-3 border-t border-border/50 pt-3">
        <span className="pb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          From
        </span>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              "font-bold tabular-nums leading-none",
              compact ? "text-lg" : "text-xl sm:text-2xl",
              isCheapest
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-foreground"
            )}
          >
            ${summary.minPrice.toFixed(2)}
          </p>
          <p className="mt-1 text-[10px] font-medium text-muted-foreground">{currency}</p>
        </div>
      </div>

      {savingsNote && (
        <div
          className={cn(
            "mt-2.5 flex items-start gap-1.5 text-xs leading-snug",
            isCheapest
              ? "text-emerald-800 dark:text-emerald-300"
              : "text-muted-foreground"
          )}
        >
          {isCheapest && (
            <ArrowDown className="mt-0.5 size-3 shrink-0 opacity-70" aria-hidden />
          )}
          <span>{savingsNote}</span>
        </div>
      )}
    </article>
  );
}
