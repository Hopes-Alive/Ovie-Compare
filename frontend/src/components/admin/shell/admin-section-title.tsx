import { cn } from "@/lib/utils";

type AdminSectionTitleProps = {
  title: string;
  description?: string;
  className?: string;
};

export function AdminSectionTitle({
  title,
  description,
  className,
}: AdminSectionTitleProps) {
  return (
    <div className={cn("mb-3", className)}>
      <h2 className="text-sm font-medium text-[var(--admin-foreground)]">
        {title}
      </h2>
      {description && (
        <p className="mt-0.5 text-xs text-[var(--admin-muted)]">{description}</p>
      )}
    </div>
  );
}
