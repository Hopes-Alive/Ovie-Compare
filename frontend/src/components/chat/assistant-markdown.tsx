"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

import { highlightPriceChildren, highlightPriceText } from "@/components/chat/highlight-price-text";
import { normalizeAssistantMarkdown } from "@/lib/chat/format-assistant-markdown";
import { cn } from "@/lib/utils";

export type AssistantMarkdownVariant = "body" | "lead";

function isPriceOnly(content: string): boolean {
  return /^(\$[\d,]+(?:\.\d{2})?|AUD\s*[\d,]+(?:\.\d{2})?)$/i.test(content.trim());
}

function buildComponents(variant: AssistantMarkdownVariant): Components {
  const isLead = variant === "lead";

  return {
    p: ({ children }) => (
      <p
        className={cn(
          "mb-3 last:mb-0 leading-[1.7]",
          isLead
            ? "text-[15px] font-normal text-foreground sm:text-base"
            : "text-sm font-normal text-foreground/85"
        )}
      >
        {highlightPriceChildren(children)}
      </p>
    ),
    ul: ({ children }) => (
      <ul
        className={cn(
          "mb-3 list-none space-y-2.5 pl-0 last:mb-0",
          "[&>li]:relative [&>li]:pl-4",
          "[&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.55em] [&>li]:before:size-1.5 [&>li]:before:rounded-full [&>li]:before:bg-primary/60"
        )}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol
        className={cn(
          "mb-3 list-decimal space-y-2.5 pl-5 last:mb-0",
          "marker:font-medium marker:text-muted-foreground",
          "[&>li]:text-sm [&>li]:font-normal [&>li]:leading-[1.7] [&>li]:text-foreground/85"
        )}
      >
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="text-sm font-normal leading-[1.7] text-foreground/85 [&_strong]:font-semibold [&_strong]:text-foreground">
        {highlightPriceChildren(children)}
      </li>
    ),
    strong: ({ children }) => {
      if (typeof children === "string" && isPriceOnly(children)) {
        return <>{highlightPriceText(children)}</>;
      }
      return (
        <strong className="font-semibold text-foreground">
          {highlightPriceChildren(children)}
        </strong>
      );
    },
    em: ({ children }) => (
      <em className="font-normal italic text-foreground/75">{highlightPriceChildren(children)}</em>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline decoration-primary/25 underline-offset-2 hover:decoration-primary/50"
      >
        {children}
      </a>
    ),
    h2: ({ children }) => (
      <h2 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-2 mt-4 text-sm font-semibold text-foreground first:mt-0">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="mb-1.5 mt-3 text-sm font-medium text-foreground/90 first:mt-0">{children}</h4>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-2 border-primary/40 py-0.5 pl-3 text-sm font-normal leading-relaxed text-foreground/80">
        {highlightPriceChildren(children)}
      </blockquote>
    ),
    hr: () => <hr className="my-4 border-border/50" />,
    code: ({ children }) => (
      <code className="rounded bg-muted/80 px-1 py-0.5 font-mono text-[0.85em] font-normal text-foreground">
        {children}
      </code>
    ),
  };
}

type AssistantMarkdownProps = {
  content: string;
  className?: string;
  variant?: AssistantMarkdownVariant;
};

export function AssistantMarkdown({
  content,
  className,
  variant = "body",
}: AssistantMarkdownProps) {
  const normalized = normalizeAssistantMarkdown(content);

  return (
    <div className={cn("max-w-none", className)}>
      <ReactMarkdown components={buildComponents(variant)}>{normalized}</ReactMarkdown>
    </div>
  );
}
