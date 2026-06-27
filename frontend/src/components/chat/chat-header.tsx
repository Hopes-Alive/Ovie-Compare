"use client";

import Link from "next/link";
import { PenSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CONNECTED_SUPPLIERS } from "@/config/nav";
import { ROUTES } from "@/config/routes";

type ChatHeaderProps = {
  onNewChat?: () => void;
};

export function ChatHeader({ onNewChat }: ChatHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-background/95 backdrop-blur px-4 py-2.5">
      {/* Brand + suppliers */}
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.home}
          className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:opacity-80 transition-opacity"
        >
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
            O
          </div>
          <span className="text-sm font-semibold text-foreground">Ovie</span>
        </Link>

        <span className="text-muted-foreground/40 text-sm">·</span>

        {/* Connected suppliers */}
        <div className="hidden items-center gap-1 sm:flex">
          {CONNECTED_SUPPLIERS.map((supplier, i) => (
            <span key={supplier.slug} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground/40 text-xs">&amp;</span>}
              <span className="text-xs font-medium text-muted-foreground">
                {supplier.name}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onNewChat}
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <PenSquare className="size-4" />
        <span className="hidden sm:inline">New chat</span>
      </Button>
    </header>
  );
}
