"use client";

import { Loader2, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useChatTheme } from "@/components/chat/theme/chat-theme-provider";
import { getChatTextColors } from "@/lib/chat-design/text-colors";
import { getSendButtonColors } from "@/lib/chat-design/theme";

type ChatComposerBarProps = {
  onSend?: (message: string) => void;
  disabled?: boolean;
};

export function ChatComposerBar({ onSend, disabled = false }: ChatComposerBarProps) {
  const theme = useChatTheme();
  const textColors = getChatTextColors(theme);
  const send = getSendButtonColors(theme);
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend?.(trimmed);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div
      className="chat-shell-composer shrink-0 px-4 py-3"
      style={{
        backgroundColor: theme.composerBg,
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
        <div
          className="flex items-end gap-2 rounded-full border px-3 py-2 shadow-sm transition-shadow focus-within:shadow-md"
          style={{
            backgroundColor: theme.composerInputBg,
            borderColor: `${theme.primaryColor}25`,
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={disabled ? "Searching…" : "Ask about dental supplies…"}
            disabled={disabled}
            rows={1}
            className="max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed focus:outline-none disabled:opacity-50"
            style={{ color: textColors.composerInput }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 disabled:scale-100 disabled:opacity-60"
            style={{
              backgroundColor: canSend ? send.bg : send.disabledBg,
              color: canSend ? send.text : send.disabledText,
            }}
            aria-label="Send message"
          >
            {disabled ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
        <p
          className="mt-1.5 text-center text-[11px]"
          style={{ color: textColors.composerDisclaimer }}
        >
          Prices may be outdated · Always verify before ordering
        </p>
      </form>
    </div>
  );
}
