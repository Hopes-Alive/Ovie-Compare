import type { Freshness } from "@/types/chat";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const FRESHNESS_CONFIG: Record<
  Freshness,
  { label: string; className: string }
> = {
  fresh: {
    label: "Fresh",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  moderate: {
    label: "Moderate",
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  stale: {
    label: "Stale",
    className: "border-red-200 bg-red-50 text-red-800",
  },
};

type FreshnessBadgeProps = {
  freshness: Freshness;
  className?: string;
};

export function FreshnessBadge({ freshness, className }: FreshnessBadgeProps) {
  const config = FRESHNESS_CONFIG[freshness];

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
