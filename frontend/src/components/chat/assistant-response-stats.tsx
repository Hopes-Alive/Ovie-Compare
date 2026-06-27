import { Boxes, DollarSign, Store, Trophy } from "lucide-react";

import type { ResponseStats } from "@/lib/chat/response-stats";
import { cn } from "@/lib/utils";

type AssistantResponseStatsProps = {
  stats: ResponseStats;
  compact?: boolean;
  className?: string;
};

function StatCard({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: typeof Boxes;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-xl border border-border/60 bg-background p-3 shadow-sm",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-foreground/55">
          {label}
        </span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function AssistantResponseStats({
  stats,
  compact = false,
  className,
}: AssistantResponseStatsProps) {
  const hasRange =
    stats.minPrice != null &&
    stats.maxPrice != null &&
    stats.minPrice !== stats.maxPrice;

  const showSeparateRange = hasRange && stats.supplierCount <= 1;
  const multiSupplier = stats.supplierCount > 1;

  return (
    <div
      className={cn(
        "grid gap-2 [&>*]:min-w-0",
        compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4 md:gap-3",
        className
      )}
    >
      <StatCard icon={Boxes} label="Products">
        <p
          className={cn(
            "font-bold tabular-nums leading-none text-foreground",
            compact ? "text-xl" : "text-xl sm:text-2xl"
          )}
        >
          {stats.productCount}
        </p>
      </StatCard>

      {multiSupplier && (
        <StatCard icon={Store} label="Suppliers">
          <p
            className={cn(
              "font-bold tabular-nums leading-none text-foreground",
              compact ? "text-xl" : "text-xl sm:text-2xl"
            )}
          >
            {stats.supplierCount}
          </p>
        </StatCard>
      )}

      {showSeparateRange && (
        <StatCard icon={DollarSign} label="Range">
          <p className="text-sm font-bold tabular-nums leading-snug text-foreground">
            ${stats.minPrice!.toFixed(2)}
            <span className="font-normal text-foreground/40"> – </span>
            ${stats.maxPrice!.toFixed(2)}
          </p>
          <p className="mt-1 text-[10px] font-medium text-foreground/45">{stats.currency}</p>
        </StatCard>
      )}

      {stats.minPrice != null && (
        <StatCard
          icon={Trophy}
          label="From"
          className={cn(
            "border-emerald-200/90 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/25",
            compact && multiSupplier && "col-span-2"
          )}
        >
          <p
            className={cn(
              "font-bold tabular-nums leading-none text-emerald-800 dark:text-emerald-300",
              compact ? "text-xl" : "text-xl sm:text-2xl"
            )}
          >
            ${stats.minPrice.toFixed(2)}
          </p>
          <p className="mt-1 text-[10px] font-medium leading-snug text-emerald-700/70 dark:text-emerald-400/70">
            {stats.currency}
            {hasRange && multiSupplier && (
              <>
                {compact ? (
                  <>
                    <br />
                    <span className="text-foreground/45">
                      Up to ${stats.maxPrice!.toFixed(2)}
                    </span>
                  </>
                ) : (
                  <span className="text-foreground/45">
                    {" "}
                    · up to ${stats.maxPrice!.toFixed(2)}
                  </span>
                )}
              </>
            )}
          </p>
        </StatCard>
      )}
    </div>
  );
}
