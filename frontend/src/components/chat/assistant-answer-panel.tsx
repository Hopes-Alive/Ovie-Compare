"use client";

import { AssistantMarkdown } from "@/components/chat/assistant-markdown";
import { highlightPriceText } from "@/components/chat/highlight-price-text";
import { useChatTheme } from "@/components/chat/theme/chat-theme-provider";
import {
  isBoldSummaryLine,
  normalizeAssistantMarkdown,
  splitFollowUp,
  stripOuterBold,
} from "@/lib/chat/format-assistant-markdown";
import { parseAssistantContent } from "@/lib/chat/parse-assistant-content";
import { cn } from "@/lib/utils";

type AssistantAnswerPanelProps = {
  content: string;
  isStreaming?: boolean;
  className?: string;
};

export function AssistantAnswerPanel({
  content,
  isStreaming,
  className,
}: AssistantAnswerPanelProps) {
  const theme = useChatTheme();
  const normalized = normalizeAssistantMarkdown(content);
  const { takeaway, body } = parseAssistantContent(normalized);
  const { main: bodyMain, followUp } = splitFollowUp(body);
  const hasBody = Boolean(bodyMain.trim());
  const showTakeaway = Boolean(takeaway?.trim());

  const leadText =
    showTakeaway && isBoldSummaryLine(takeaway!)
      ? stripOuterBold(takeaway!)
      : showTakeaway
        ? takeaway!
        : null;

  if (!showTakeaway && !hasBody && !normalized.trim()) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {leadText && (
        <p className="text-[15px] font-normal leading-[1.65] text-foreground sm:text-base">
          {highlightPriceText(leadText)}
          {isStreaming && !hasBody && (
            <span
              className="ml-0.5 inline-block h-4 w-0.5 animate-pulse align-middle"
              style={{ backgroundColor: theme.primaryColor }}
              aria-hidden
            />
          )}
        </p>
      )}

      {showTakeaway && !leadText && (
        <AssistantMarkdown content={takeaway!} variant="lead" />
      )}

      {hasBody && (
        <AssistantMarkdown content={bodyMain} variant="body" />
      )}

      {!showTakeaway && !hasBody && normalized.trim() && (
        <AssistantMarkdown content={normalized} variant="body" />
      )}

      {followUp && (
        <p className="text-sm italic text-muted-foreground">
          {highlightPriceText(followUp.replace(/\*\*/g, ""))}
        </p>
      )}

      {isStreaming && (hasBody || (!showTakeaway && normalized.trim())) && (
        <span
          className="inline-block h-4 w-0.5 animate-pulse"
          style={{ backgroundColor: theme.primaryColor }}
          aria-hidden
        />
      )}
    </div>
  );
}
