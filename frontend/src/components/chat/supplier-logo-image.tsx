"use client";

import { useChatTheme } from "@/components/chat/theme/chat-theme-provider";
import { getSupplierLogoUrl } from "@/lib/chat-design/supplier-logos";
import {
  getSupplierInitials,
  getSupplierTheme,
} from "@/lib/suppliers/supplier-theme";
import { cn } from "@/lib/utils";

type SupplierLogoImageProps = {
  slug?: string | null;
  name: string;
  className?: string;
  tileClassName?: string;
  showInitialsFallback?: boolean;
};

/** Square tile — initials or small logo (section headers, chips). */
export function SupplierLogoImage({
  slug,
  name,
  className,
  tileClassName,
  showInitialsFallback = true,
}: SupplierLogoImageProps) {
  const theme = useChatTheme();
  const logoUrl = getSupplierLogoUrl(theme, slug);
  const supplierTheme = getSupplierTheme(slug);

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className={cn("object-contain", className)}
      />
    );
  }

  if (!showInitialsFallback) return null;

  return (
    <span
      className={cn(
        "flex items-center justify-center font-bold tracking-tight",
        supplierTheme.iconBg,
        supplierTheme.iconText,
        tileClassName ?? className
      )}
    >
      {getSupplierInitials(name)}
    </span>
  );
}

type SupplierLogoBannerProps = {
  slug?: string | null;
  name: string;
  className?: string;
  compact?: boolean;
};

/** Wide logo strip — comparison cards and prominent brand rows. */
export function SupplierLogoBanner({
  slug,
  name,
  className,
  compact = false,
}: SupplierLogoBannerProps) {
  const theme = useChatTheme();
  const logoUrl = getSupplierLogoUrl(theme, slug);
  const supplierTheme = getSupplierTheme(slug);

  if (logoUrl) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-lg border border-border/50 bg-white px-3 shadow-sm dark:bg-background",
          compact ? "h-10 py-1.5" : "h-12 py-2",
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={name}
          className={cn(
            "w-auto max-w-full object-contain object-center",
            compact ? "max-h-7" : "max-h-8"
          )}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg border px-3",
        supplierTheme.headerBg,
        supplierTheme.sectionBorder,
        compact ? "h-10" : "h-12",
        className
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold",
          supplierTheme.iconBg,
          supplierTheme.iconText
        )}
      >
        {getSupplierInitials(name)}
      </span>
      <span className={cn("truncate text-sm font-semibold", supplierTheme.titleText)}>
        {name}
      </span>
    </div>
  );
}
