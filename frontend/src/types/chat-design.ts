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
  composerBg: string;
  composerInputBg: string;
  composerInputText: string;
  sendButtonBg: string;
  sendButtonText: string;

  headerBannerImageUrl: string;
  backgroundImageUrl: string;
  backgroundSharpness: number;

  emptyStateTitle: string;
  emptyStateSubtitle: string;
  suggestedPrompts: SuggestedPromptConfig[];
}

export type ChatDesignPatch = Partial<ChatDesignTheme>;
