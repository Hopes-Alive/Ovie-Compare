"use client";

import { Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatInputProps = {
  onSend?: (message: string) => void;
  disabled?: boolean;
};

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    // TODO: replace with POST /api/chat
    onSend?.(trimmed);
    setValue("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-border bg-background px-4 py-4"
    >
      <div className="mx-auto flex max-w-3xl gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ask about dental supplies…"
          className="min-h-[44px] resize-none"
          rows={1}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <Button type="submit" size="icon-lg" disabled={disabled || !value.trim()}>
          <Send />
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </form>
  );
}
