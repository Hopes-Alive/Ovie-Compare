import type { ChatDesignTheme } from "@/types/chat-design";

function pick(value: string | undefined, fallback: string): string {
  return value?.trim() ? value : fallback;
}

/** Resolved text colors for each shell text position (with fallbacks). */
export function getChatTextColors(theme: ChatDesignTheme) {
  return {
    classicHeaderTitle: pick(theme.headerText, "#0f172a"),
    classicHeaderSubtitle: pick(theme.headerSubtitleText, "#64748b"),
    bannerHeaderTitle: pick(theme.bannerHeaderTitleText, "#ffffff"),
    bannerHeaderSubtitle: pick(theme.bannerHeaderSubtitleText, "#e2e8f0"),
    emptyStateTitle: pick(theme.emptyStateTitleText, theme.headerText || "#0f172a"),
    emptyStateSubtitle: pick(theme.emptyStateSubtitleText, "#64748b"),
    promptLabel: pick(theme.promptLabelText, "#64748b"),
    promptBody: pick(theme.promptText, "#0f172a"),
    composerInput: pick(theme.composerInputText, "#0f172a"),
    composerDisclaimer: pick(theme.composerDisclaimerText, "#94a3b8"),
    sendButton: pick(theme.sendButtonText, "#ffffff"),
  };
}

export type ChatTextColors = ReturnType<typeof getChatTextColors>;
