"use client";

import { CHAT_SUGGESTED_PROMPTS } from "@/config/nav";
import { Button } from "@/components/ui/button";

type SuggestedPromptsProps = {
  onSelect?: (prompt: string) => void;
};

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mx-auto max-w-lg text-center">
        <h2 className="text-lg font-semibold text-foreground">
          Compare dental supplies
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask about products, prices, and stock across Henry Schein and Adam
          Dental.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {CHAT_SUGGESTED_PROMPTS.map((prompt) => (
            <Button
              key={prompt}
              variant="outline"
              className="h-auto justify-start px-4 py-3 text-left text-sm font-normal"
              onClick={() => onSelect?.(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
