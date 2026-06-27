import { cn } from "@/lib/utils";

type AdminMetricCardProps = {
  title: string;
  value: React.ReactNode;
  description?: string;
  alert?: boolean;
  className?: string;
};

export function AdminMetricCard({
  title,
  value,
  description,
  alert = false,
  className,
}: AdminMetricCardProps) {
  return (
    <div className={cn("px-4 py-3.5", alert && "bg-amber-50/50", className)}>
      <p className="text-xs text-[var(--admin-muted)]">{title}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-[var(--admin-foreground)]">
        {value}
      </p>
      {description && (
        <p className="mt-0.5 text-xs text-[var(--admin-muted)]">{description}</p>
      )}
    </div>
  );
}
