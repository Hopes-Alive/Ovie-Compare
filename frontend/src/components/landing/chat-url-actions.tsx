"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";

type ChatUrlActionsProps = {
  chatUrl: string;
};

export function ChatUrlActions({ chatUrl }: ChatUrlActionsProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(chatUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="break-all rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">
        {chatUrl}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={handleCopy} className="flex-1">
          {copied ? (
            <Check data-icon="inline-start" />
          ) : (
            <Copy data-icon="inline-start" />
          )}
          {copied ? "Copied" : "Copy URL"}
        </Button>
        <Button
          className="flex-1"
          render={
            <a href={ROUTES.chat} target="_blank" rel="noopener noreferrer" />
          }
        >
          <ExternalLink data-icon="inline-start" />
          Open in new tab
        </Button>
      </div>
    </div>
  );
}
