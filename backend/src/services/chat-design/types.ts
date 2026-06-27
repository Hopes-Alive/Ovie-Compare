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
  headerSubtitleText: string;
  bannerHeaderTitleText: string;
  bannerHeaderSubtitleText: string;
  emptyStateTitleText: string;
  emptyStateSubtitleText: string;
  promptLabelText: string;
  promptText: string;
  composerBg: string;
  composerInputBg: string;
  composerInputText: string;
  composerDisclaimerText: string;
  sendButtonBg: string;
  sendButtonText: string;

  headerBannerImageUrl: string;
  /** Background behind messages in portrait / narrow card view */
  backgroundImageUrl: string;
  /** Background in expanded wide view; falls back to backgroundImageUrl when empty */
  expandedBackgroundImageUrl: string;
  /** 0 = max blur, 100 = sharp */
  backgroundSharpness: number;

  emptyStateTitle: string;
  emptyStateSubtitle: string;
  suggestedPrompts: SuggestedPromptConfig[];

  /** Per-supplier logo URLs keyed by supplier slug (e.g. henry-schein) */
  supplierLogos: Record<string, string>;
}

export type ChatDesignPatch = Partial<ChatDesignTheme>;
