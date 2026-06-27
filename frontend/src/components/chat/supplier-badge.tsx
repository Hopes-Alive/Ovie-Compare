import { cn } from "@/lib/utils";
import { getSupplierDisplayName } from "@/lib/suppliers/display-name";
import { getSupplierTheme } from "@/lib/suppliers/supplier-theme";

type SupplierBadgeProps = {
  slug?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function SupplierBadge({
  slug,
  name,
  size = "md",
  className,
}: SupplierBadgeProps) {
  const displayName = getSupplierDisplayName(slug, name);
  const theme = getSupplierTheme(slug);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold tracking-tight",
        size === "sm" && "px-2 py-0.5 text-[10px]",
        size === "md" && "px-2.5 py-0.5 text-xs",
        size === "lg" && "px-3 py-1 text-sm",
        theme.badge,
        className
      )}
    >
      {displayName}
    </span>
  );
}

type SupplierSectionHeaderProps = {
  slug?: string | null;
  name?: string | null;
  productCount: number;
  className?: string;
};

/** @deprecated Prefer SupplierProductSection for grouped product lists */
export function SupplierSectionHeader({
  slug,
  name,
  productCount,
  className,
}: SupplierSectionHeaderProps) {
  const theme = getSupplierTheme(slug);
  const displayName = getSupplierDisplayName(slug, name);

  return (
    <div
      className={cn(
        "mb-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 shadow-sm",
        theme.sectionBorder,
        theme.headerBg,
        className
      )}
    >
      <SupplierBadge slug={slug} name={displayName} size="lg" />
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {productCount} {productCount === 1 ? "product" : "products"}
      </span>
    </div>
  );
}
