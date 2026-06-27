"use client";

import { AlertTriangle, Check, Copy } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import {
  formatContrastRatio,
  getContrastLevel,
  getContrastRatio,
} from "@/lib/chat-design/contrast";
import { cn } from "@/lib/utils";

type ChatDesignColorFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** When set, shows a contrast ratio hint against this background color */
  contrastAgainst?: string;
};

export function ChatDesignColorField({
  label,
  value,
  onChange,
  className,
  contrastAgainst,
}: ChatDesignColorFieldProps) {
  const swatch = value || "#000000";
  const [copied, setCopied] = useState(false);
  const contrastRatio =
    contrastAgainst && value ? getContrastRatio(value, contrastAgainst) : null;
  const contrastLevel = contrastRatio ? getContrastLevel(contrastRatio) : null;

  async function copyHex() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {contrastRatio !== null && contrastLevel && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium",
              contrastLevel === "good" && "text-emerald-600",
              contrastLevel === "fair" && "text-amber-600",
              contrastLevel === "poor" && "text-red-600"
            )}
          >
            {contrastLevel === "poor" && <AlertTriangle className="size-3" />}
            {contrastLevel === "good" && <Check className="size-3" />}
            {formatContrastRatio(contrastRatio)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/20 p-1.5">
        <label className="relative size-10 shrink-0 cursor-pointer overflow-hidden rounded-md ring-1 ring-border/80">
          <span
            className="absolute inset-0"
            style={{ backgroundColor: swatch }}
            aria-hidden
          />
          <input
            type="color"
            value={swatch}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label={`${label} color picker`}
          />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 min-w-0 flex-1 border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => void copyHex()}
          disabled={!value}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-40"
          aria-label={`Copy ${label} hex value`}
          title="Copy hex"
        >
          {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      {contrastLevel === "poor" && (
        <p className="text-[11px] text-red-600/90">
          Low contrast — text may be hard to read on this background.
        </p>
      )}
    </div>
  );
}
