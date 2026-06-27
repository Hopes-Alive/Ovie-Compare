/**
 * Chat page shell theme — controls header, background, colors, empty state.
 * Does NOT affect message bubble / product card content styling.
 */

export interface SuggestedPromptConfig {
  label: string;
  prompt: string;
  icon: "search" | "compare" | "cart" | "trending";
}

export interface ChatDesignTheme {
  brandName: string;
  brandTagline: string;
  headerSubtitle: string;
  logoUrl: string;

  primaryColor: string;
  accentColor: string;
  pageBg: string;
  headerBg: string;
  headerText: string;
  composerBg: string;
  composerInputBg: string;
  composerInputText: string;
  sendButtonBg: string;
  sendButtonText: string;

  headerBannerImageUrl: string;
  backgroundImageUrl: string;
  /** 0 = max blur, 100 = sharp */
  backgroundSharpness: number;

  emptyStateTitle: string;
  emptyStateSubtitle: string;
  suggestedPrompts: SuggestedPromptConfig[];
}

export type ChatDesignPatch = Partial<ChatDesignTheme>;
