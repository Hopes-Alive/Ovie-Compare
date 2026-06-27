import { cn } from "@/lib/utils";

type AdminTableCardProps = {
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export function AdminTableCard({
  children,
  footer,
  className,
}: AdminTableCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]",
        className
      )}
    >
      {children}
      {footer && (
        <div className="border-t border-[var(--admin-border)] px-4 py-2.5 text-xs text-[var(--admin-muted)]">
          {footer}
        </div>
      )}
    </div>
  );
}
