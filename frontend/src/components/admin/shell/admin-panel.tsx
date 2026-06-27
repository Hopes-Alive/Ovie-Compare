import { cn } from "@/lib/utils";

type AdminPanelProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function AdminPanel({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: AdminPanelProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]",
        className
      )}
    >
      {title && (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--admin-border)] px-4 py-3">
          <div>
            <h3 className="text-sm font-medium text-[var(--admin-foreground)]">
              {title}
            </h3>
            {description && (
              <p className="mt-0.5 text-xs text-[var(--admin-muted)]">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-4", contentClassName)}>{children}</div>
    </section>
  );
}
