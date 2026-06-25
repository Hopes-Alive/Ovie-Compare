"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ROUTES, getChatUrl } from "@/config/routes";

export function OverviewActions() {
  const [copied, setCopied] = useState(false);
  const chatUrl = getChatUrl();

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
    <div className="mt-8 flex flex-wrap gap-3">
      <Button render={<a href={ROUTES.chat} target="_blank" rel="noopener noreferrer" />}>
        <ExternalLink data-icon="inline-start" />
        Open chat
      </Button>
      <Button variant="outline" onClick={handleCopy}>
        {copied ? (
          <Check data-icon="inline-start" />
        ) : (
          <Copy data-icon="inline-start" />
        )}
        {copied ? "Copied" : "Copy chat URL"}
      </Button>
    </div>
  );
}
