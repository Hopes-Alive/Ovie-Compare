import { Trophy } from "lucide-react";

import { cn } from "@/lib/utils";

type BestPriceBadgeProps = {
  size?: "sm" | "md";
  label?: string;
  className?: string;
};

/** Single consistent "best price" badge used across the chat UI. */
export function BestPriceBadge({
  size = "md",
  label = "Best price",
  className,
}: BestPriceBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-600 font-semibold uppercase tracking-wide text-white",
        size === "sm" && "px-1.5 py-0.5 text-[9px]",
        size === "md" && "px-2 py-0.5 text-[10px]",
        className
      )}
    >
      <Trophy className={cn(size === "sm" ? "size-2.5" : "size-3")} />
      {label}
    </span>
  );
}
