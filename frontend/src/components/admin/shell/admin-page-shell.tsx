import { cn } from "@/lib/utils";

type AdminPageShellProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  headerExtra?: React.ReactNode;
  stickyHeader?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function AdminPageShell({
  title,
  description,
  actions,
  headerExtra,
  stickyHeader = false,
  children,
  className,
}: AdminPageShellProps) {
  return (
    <div className={cn("flex min-h-full flex-col", className)}>
      <header
        className={cn(
          "border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-4 lg:px-8",
          stickyHeader &&
            "sticky top-0 z-20 bg-[var(--admin-surface)]/95 backdrop-blur-sm"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-[var(--admin-foreground)]">
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 text-sm text-[var(--admin-muted)]">
                {description}
              </p>
            )}
            {headerExtra}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 px-6 py-5 lg:px-8 lg:py-6">{children}</div>
    </div>
  );
}
