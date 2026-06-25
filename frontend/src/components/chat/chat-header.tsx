"use client";

import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CONNECTED_SUPPLIERS } from "@/config/nav";
import { ROUTES } from "@/config/routes";

type ChatHeaderProps = {
  onNewChat?: () => void;
};

export function ChatHeader({ onNewChat }: ChatHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4 py-3">
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.home}
          className="text-sm font-semibold text-foreground hover:underline"
        >
          Ovie
        </Link>
        <div className="hidden items-center gap-1.5 sm:flex">
          {CONNECTED_SUPPLIERS.map((supplier) => (
            <Badge key={supplier.slug} variant="secondary">
              {supplier.name}
            </Badge>
          ))}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onNewChat}>
        <MessageSquarePlus data-icon="inline-start" />
        New chat
      </Button>
    </header>
  );
}
