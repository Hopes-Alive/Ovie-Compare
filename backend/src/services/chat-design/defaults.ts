import type { ChatDesignTheme } from "./types.js";

export const DEFAULT_CHAT_DESIGN: ChatDesignTheme = {
  brandName: "Ovie",
  brandTagline: "Dental supply comparison",
  headerSubtitle: "I'm an intelligent agent, not a chat bot",
  logoUrl: "",

  primaryColor: "#2563eb",
  accentColor: "#0ea5e9",
  pageBg: "#f8fafc",
  headerBg: "#ffffff",
  headerText: "#0f172a",
  headerSubtitleText: "#64748b",
  bannerHeaderTitleText: "#ffffff",
  bannerHeaderSubtitleText: "#e2e8f0",
  emptyStateTitleText: "#0f172a",
  emptyStateSubtitleText: "#64748b",
  promptLabelText: "#64748b",
  promptText: "#0f172a",
  composerBg: "#ffffff",
  composerInputBg: "#f1f5f9",
  composerInputText: "#0f172a",
  composerDisclaimerText: "#94a3b8",
  sendButtonBg: "",
  sendButtonText: "#ffffff",

  headerBannerImageUrl: "",
  backgroundImageUrl: "",
  expandedBackgroundImageUrl: "",
  backgroundSharpness: 100,

  emptyStateTitle: "How can I help today?",
  emptyStateSubtitle:
    "Search and compare dental supplies across Henry Schein and Adam Dental — prices, stock, and delivery in one place.",
  suggestedPrompts: [
    {
      label: "Find cheapest",
      prompt: "Who has the cheapest nitrile examination gloves?",
      icon: "trending",
    },
    {
      label: "Compare suppliers",
      prompt: "Compare composite resin prices between Henry Schein and Adam Dental",
      icon: "compare",
    },
    {
      label: "Check stock",
      prompt: "Find composite A2 shade in stock right now",
      icon: "search",
    },
    {
      label: "Restock clinic",
      prompt: "I need to restock — show me temporary crown materials from both suppliers",
      icon: "cart",
    },
  ],
};
