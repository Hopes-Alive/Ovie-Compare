import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const PRICE_PATTERN = /(\$[\d,]+(?:\.\d{2})?|AUD\s*[\d,]+(?:\.\d{2})?)/gi;

export function highlightPriceText(text: string, className?: string): ReactNode {
  const parts = text.split(/(\$[\d,]+(?:\.\d{2})?|AUD\s*[\d,]+(?:\.\d{2})?)/gi);

  return parts.map((part, index) => {
    PRICE_PATTERN.lastIndex = 0;
    if (PRICE_PATTERN.test(part)) {
      return (
        <span
          key={index}
          className={cn(
            "rounded px-1 font-medium tabular-nums text-emerald-800 dark:text-emerald-300",
            "bg-emerald-100/80 dark:bg-emerald-950/50",
            className
          )}
        >
          {part}
        </span>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function highlightPriceChildren(children: ReactNode): ReactNode {
  if (typeof children === "string") {
    return highlightPriceText(children);
  }

  if (Array.isArray(children)) {
    return children.map((child, index) => (
      <Fragment key={index}>{highlightPriceChildren(child)}</Fragment>
    ));
  }

  return children;
}
