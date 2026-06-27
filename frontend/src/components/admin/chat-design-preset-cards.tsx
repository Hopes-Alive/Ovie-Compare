"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ChatDesignTheme } from "@/types/chat-design";

type Preset = {
  name: string;
  description: string;
  colors: Partial<ChatDesignTheme>;
};

const PRESETS: Preset[] = [
  {
    name: "Professional Blue",
    description: "Clean and trustworthy",
    colors: {
      primaryColor: "#2563eb",
      accentColor: "#0ea5e9",
      pageBg: "#f0f7ff",
      headerBg: "#1e40af",
      headerText: "#ffffff",
      composerBg: "#ffffff",
      composerInputBg: "#eff6ff",
    },
  },
  {
    name: "Clinical Teal",
    description: "Calm healthcare feel",
    colors: {
      primaryColor: "#0d9488",
      accentColor: "#14b8a6",
      pageBg: "#f0fdfa",
      headerBg: "#0f766e",
      headerText: "#ffffff",
      composerBg: "#ffffff",
      composerInputBg: "#ccfbf1",
    },
  },
  {
    name: "Warm Neutral",
    description: "Approachable and warm",
    colors: {
      primaryColor: "#b45309",
      accentColor: "#f59e0b",
      pageBg: "#fffbeb",
      headerBg: "#78350f",
      headerText: "#ffffff",
      composerBg: "#ffffff",
      composerInputBg: "#fef3c7",
    },
  },
  {
    name: "Slate Pro",
    description: "Modern dark header",
    colors: {
      primaryColor: "#6366f1",
      accentColor: "#818cf8",
      pageBg: "#f8fafc",
      headerBg: "#0f172a",
      headerText: "#f8fafc",
      composerBg: "#ffffff",
      composerInputBg: "#f1f5f9",
    },
  },
];

type ChatDesignPresetCardsProps = {
  activePrimary?: string;
  onSelect: (colors: Partial<ChatDesignTheme>) => void;
};

export function ChatDesignPresetCards({ activePrimary, onSelect }: ChatDesignPresetCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {PRESETS.map((preset) => {
        const isActive = activePrimary === preset.colors.primaryColor;
        const swatches = [
          preset.colors.primaryColor,
          preset.colors.accentColor,
          preset.colors.headerBg,
          preset.colors.pageBg,
        ].filter(Boolean) as string[];

        return (
          <button
            key={preset.name}
            type="button"
            onClick={() => onSelect(preset.colors)}
            className={cn(
              "group relative overflow-hidden rounded-xl border text-left transition-all",
              "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "border-primary shadow-sm ring-1 ring-primary/20"
                : "border-border/70 bg-card"
            )}
          >
            <div className="flex h-14">
              {swatches.map((color, i) => (
                <span
                  key={`${preset.name}-${i}`}
                  className="flex-1 transition-transform group-hover:scale-y-105"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex items-start justify-between gap-2 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{preset.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{preset.description}</p>
              </div>
              {isActive && (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
