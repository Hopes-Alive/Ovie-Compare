import { cn } from "@/lib/utils";

import { AdminMetricCard } from "./admin-metric-card";

type StatItem = {
  title: string;
  value: React.ReactNode;
  description?: string;
  alert?: boolean;
};

type AdminStatGridProps = {
  stats: StatItem[];
  columns?: 2 | 3 | 4 | 5;
  className?: string;
};

const COLUMN_CLASS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
} as const;

export function AdminStatGrid({
  stats,
  columns = 4,
  className,
}: AdminStatGridProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]",
        className
      )}
    >
      <div
        className={cn(
          "grid divide-y divide-[var(--admin-border)]",
          COLUMN_CLASS[columns],
          "sm:divide-x sm:divide-y-0"
        )}
      >
        {stats.map((stat) => (
          <AdminMetricCard key={stat.title} {...stat} />
        ))}
      </div>
    </div>
  );
}
