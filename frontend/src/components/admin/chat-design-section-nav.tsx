"use client";

import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Circle } from "lucide-react";

import { cn } from "@/lib/utils";

export type ChatDesignSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  complete?: boolean;
};

type ChatDesignSectionNavProps = {
  sections: ChatDesignSection[];
  activeSection: string;
  onSectionChange: (id: string) => void;
};

export function ChatDesignSectionNav({
  sections,
  activeSection,
  onSectionChange,
}: ChatDesignSectionNavProps) {
  return (
    <>
      <nav
        aria-label="Chat design sections"
        className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-1 scrollbar-none lg:hidden"
      >
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSectionChange(id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all",
              activeSection === id
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
            )}
          >
            <Icon className="size-4 opacity-70" />
            {label}
          </button>
        ))}
      </nav>

      <nav
        aria-label="Chat design sections"
        className="hidden lg:sticky lg:top-32 lg:block lg:w-56 lg:shrink-0"
      >
        <div className="rounded-xl border border-border/60 bg-card p-2 shadow-sm">
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sections
          </p>
          <ul className="space-y-0.5">
            {sections.map(({ id, label, icon: Icon, complete }) => {
              const active = activeSection === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onSectionChange(id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all",
                      active
                        ? "bg-primary/8 font-medium text-foreground ring-1 ring-primary/15"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        active ? "bg-primary/10 text-primary" : "bg-muted/50"
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    {complete ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-label="Complete" />
                    ) : (
                      <Circle className="size-3.5 shrink-0 text-muted-foreground/30" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </>
  );
}
