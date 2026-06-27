export type SuggestedPromptIcon = "search" | "compare" | "cart" | "trending";

export interface SuggestedPromptConfig {
  label: string;
  prompt: string;
  icon: SuggestedPromptIcon;
}

/** Chat page shell theme — header, background, composer, empty state */
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
  backgroundImageUrl: string;
  expandedBackgroundImageUrl: string;
  backgroundSharpness: number;

  emptyStateTitle: string;
  emptyStateSubtitle: string;
  suggestedPrompts: SuggestedPromptConfig[];

  /** Per-supplier logo URLs keyed by supplier slug (e.g. henry-schein) */
  supplierLogos: Record<string, string>;
}

export type ChatDesignPatch = Partial<ChatDesignTheme>;
