"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { BestPriceBadge } from "@/components/chat/best-price-badge";
import { SupplierBadge } from "@/components/chat/supplier-badge";
import { SupplierLogoBanner } from "@/components/chat/supplier-logo-image";
import { useChatPanelCompact } from "@/hooks/use-chat-panel-compact";
import { getSupplierTheme } from "@/lib/suppliers/supplier-theme";
import { cn } from "@/lib/utils";

type SupplierProductSectionProps = {
  slug?: string | null;
  name: string;
  productCount: number;
  lowestPrice?: number | null;
  currency?: string;
  children: React.ReactNode;
  className?: string;
  defaultCollapsed?: boolean;
  isCheapestSupplier?: boolean;
  expandAll?: boolean;
};

export function SupplierProductSection({
  slug,
  name,
  productCount,
  lowestPrice,
  currency = "AUD",
  children,
  className,
  defaultCollapsed = false,
  isCheapestSupplier,
  expandAll,
}: SupplierProductSectionProps) {
  const theme = getSupplierTheme(slug);
  const compact = useChatPanelCompact();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    if (expandAll !== undefined) {
      setCollapsed(!expandAll);
    }
  }, [expandAll]);

  return (
    <section
      aria-label={`Products from ${name}`}
      className={cn(
        "overflow-hidden rounded-xl border shadow-sm",
        theme.sectionBorder,
        theme.sectionBg,
        className
      )}
    >
      <header
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed((c) => !c)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setCollapsed((c) => !c);
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col gap-3 border-l-4 px-4 py-3 transition-colors hover:brightness-[0.98] sm:flex-row sm:items-center sm:justify-between",
          !collapsed && "border-b",
          theme.headerBorder,
          theme.headerBg,
          slug === "henry-schein" && "border-l-blue-600",
          slug === "adam-dental" && "border-l-teal-600",
          !slug && "border-l-muted-foreground/40"
        )}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <SupplierLogoBanner slug={slug} name={name} compact={compact} className="max-w-xs" />
          <div className="flex flex-wrap items-center gap-2">
            {isCheapestSupplier && <BestPriceBadge size="sm" label="Cheapest" />}
            <p className="text-xs text-muted-foreground">
              {productCount} {productCount === 1 ? "product" : "products"}
              {lowestPrice != null && lowestPrice > 0 && (
                <>
                  {" · from "}
                  <span className="font-semibold tabular-nums text-foreground">
                    ${lowestPrice.toFixed(2)} {currency}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          <SupplierBadge slug={slug} name={name} size="sm" className="hidden sm:inline-flex" />
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              collapsed && "-rotate-90"
            )}
          />
        </div>
      </header>

      {!collapsed && <div className="flex flex-col gap-2.5 p-3">{children}</div>}
    </section>
  );
}
