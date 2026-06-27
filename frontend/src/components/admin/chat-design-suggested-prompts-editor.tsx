"use client";

import { ChevronDown, ChevronUp, GitCompare, Search, ShoppingCart, TrendingDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SuggestedPromptConfig, SuggestedPromptIcon } from "@/types/chat-design";

const ICON_OPTIONS: Array<{
  value: SuggestedPromptIcon;
  label: string;
  Icon: typeof Search;
}> = [
  { value: "search", label: "Search", Icon: Search },
  { value: "compare", label: "Compare", Icon: GitCompare },
  { value: "cart", label: "Cart", Icon: ShoppingCart },
  { value: "trending", label: "Trending", Icon: TrendingDown },
];

type ChatDesignSuggestedPromptsEditorProps = {
  prompts: SuggestedPromptConfig[];
  accentColor: string;
  onChange: (prompts: SuggestedPromptConfig[]) => void;
};

export function ChatDesignSuggestedPromptsEditor({
  prompts,
  accentColor,
  onChange,
}: ChatDesignSuggestedPromptsEditorProps) {
  function updatePrompt(index: number, patch: Partial<SuggestedPromptConfig>) {
    onChange(prompts.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function movePrompt(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= prompts.length) return;
    const next = [...prompts];
    [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
    onChange(next);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suggested prompts</CardTitle>
        <CardDescription>
          Quick-start cards on the empty chat screen. Reorder to control which appear first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {prompts.map((item, index) => (
          <div
            key={`prompt-${index}-${item.label}`}
            className="rounded-xl border border-border/60 bg-muted/10 p-4 transition-colors hover:border-border"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Prompt {index + 1}
              </span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === 0}
                  onClick={() => movePrompt(index, -1)}
                  aria-label={`Move prompt ${index + 1} up`}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === prompts.length - 1}
                  onClick={() => movePrompt(index, 1)}
                  aria-label={`Move prompt ${index + 1} down`}
                >
                  <ChevronDown className="size-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr,auto]">
              <div className="space-y-4">
                <Field label="Short label" hint={`${item.label.length}/24 recommended`}>
                  <Input
                    value={item.label}
                    onChange={(e) => updatePrompt(index, { label: e.target.value })}
                    placeholder="e.g. Find cheapest"
                    maxLength={32}
                  />
                </Field>
                <Field label="Full prompt" hint={`${item.prompt.length} characters`}>
                  <Textarea
                    value={item.prompt}
                    onChange={(e) => updatePrompt(index, { prompt: e.target.value })}
                    rows={2}
                    className="resize-y"
                    placeholder="What the user sends when they tap this card…"
                  />
                </Field>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Icon</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {ICON_OPTIONS.map(({ value, label, Icon }) => {
                    const selected = item.icon === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => updatePrompt(index, { icon: value })}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 text-xs transition-all",
                          selected
                            ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20"
                            : "border-border/60 text-muted-foreground hover:border-border hover:bg-muted/30"
                        )}
                      >
                        <span
                          className="flex size-8 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: selected ? accentColor : `${accentColor}99` }}
                        >
                          <Icon className="size-4" />
                        </span>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
