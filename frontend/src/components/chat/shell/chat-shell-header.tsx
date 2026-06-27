"use client";

import { Maximize2, Minimize2, PenSquare } from "lucide-react";

import { useChatViewModeContext } from "@/components/chat/chat-view-mode-context";
import { useChatTheme } from "@/components/chat/theme/chat-theme-provider";
import { resolveAssetUrl } from "@/lib/chat-design/asset-url";
import { hasHeaderBanner } from "@/lib/chat-design/theme";

type ChatShellHeaderProps = {
  onNewChat?: () => void;
};

export function ChatShellHeader({ onNewChat }: ChatShellHeaderProps) {
  const theme = useChatTheme();
  const { canToggle, isWide, toggleViewMode } = useChatViewModeContext();
  const banner = hasHeaderBanner(theme);
  const bannerUrl = resolveAssetUrl(theme.headerBannerImageUrl);

  if (banner && bannerUrl) {
    return (
      <header className="chat-hero chat-hero-banner chat-hero-mobile shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bannerUrl} alt="" className="chat-hero-img" />
        <div
          className="chat-hero-profile-overlay absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-4 pb-3 pt-8"
          style={{
            background: `linear-gradient(to top, ${theme.pageBg} 0%, transparent 100%)`,
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <BrandAvatar />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: theme.headerText }}>
                {theme.brandName}
              </p>
              <p className="truncate text-xs opacity-80" style={{ color: theme.headerText }}>
                {theme.headerSubtitle}
              </p>
            </div>
          </div>
          <HeaderActions
            onNewChat={onNewChat}
            canToggle={canToggle}
            isWide={isWide}
            onToggleView={toggleViewMode}
          />
        </div>
      </header>
    );
  }

  return (
    <header
      className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3"
      style={{ backgroundColor: theme.headerBg, color: theme.headerText }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <BrandAvatar />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{theme.brandName}</p>
          <p className="truncate text-xs opacity-70">{theme.headerSubtitle}</p>
        </div>
      </div>
      <HeaderActions
        onNewChat={onNewChat}
        canToggle={canToggle}
        isWide={isWide}
        onToggleView={toggleViewMode}
      />
    </header>
  );
}

function BrandAvatar() {
  const theme = useChatTheme();
  const initial = (theme.brandName || "O").slice(0, 1).toUpperCase();
  const logoUrl = resolveAssetUrl(theme.logoUrl);

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className="size-9 shrink-0 rounded-xl object-cover ring-2 ring-white/20"
      />
    );
  }

  return (
    <div
      className="flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
      style={{ backgroundColor: theme.primaryColor }}
    >
      {initial}
    </div>
  );
}

function HeaderActions({
  onNewChat,
  canToggle,
  isWide,
  onToggleView,
}: {
  onNewChat?: () => void;
  canToggle: boolean;
  isWide: boolean;
  onToggleView: () => void;
}) {
  const theme = useChatTheme();

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {canToggle && (
        <button
          type="button"
          onClick={onToggleView}
          className="chat-action-chip flex size-8 items-center justify-center rounded-full transition-opacity hover:opacity-90"
          style={{
            backgroundColor: `${theme.primaryColor}18`,
            color: theme.headerText,
            border: `1px solid ${theme.primaryColor}30`,
          }}
          aria-label={isWide ? "Contract chat" : "Expand chat"}
          title={isWide ? "Contract" : "Expand"}
        >
          {isWide ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>
      )}
      <button
        type="button"
        onClick={onNewChat}
        className="chat-action-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-90"
        style={{
          backgroundColor: `${theme.primaryColor}18`,
          color: theme.headerText,
          border: `1px solid ${theme.primaryColor}30`,
        }}
      >
        <PenSquare className="size-3.5" />
        <span className="hidden sm:inline">New chat</span>
      </button>
    </div>
  );
}
