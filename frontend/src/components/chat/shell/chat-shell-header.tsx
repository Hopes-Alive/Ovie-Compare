"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, PenSquare } from "lucide-react";

import { useChatViewModeContext } from "@/components/chat/chat-view-mode-context";
import { useChatTheme } from "@/components/chat/theme/chat-theme-provider";
import { resolveAssetUrl } from "@/lib/chat-design/asset-url";
import {
  clampContainBannerHeight,
  computeBannerHeight,
  resolveCoverBannerHeight,
} from "@/lib/chat-design/banner-height";
import { hasHeaderBanner } from "@/lib/chat-design/theme";
import { getChatTextColors } from "@/lib/chat-design/text-colors";
import { cn } from "@/lib/utils";

type ChatShellHeaderProps = {
  onNewChat?: () => void;
  /** Admin phone mockup — uses capped cover crop */
  preview?: boolean;
};

export function ChatShellHeader({ onNewChat, preview = false }: ChatShellHeaderProps) {
  const theme = useChatTheme();
  const textColors = getChatTextColors(theme);
  const { canToggle, isWide, layout, toggleViewMode } = useChatViewModeContext();
  const banner = hasHeaderBanner(theme);
  const bannerUrl = resolveAssetUrl(theme.headerBannerImageUrl);

  const headerRef = useRef<HTMLElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const lockedContainHeightRef = useRef<number | null>(null);
  const [coverHeight, setCoverHeight] = useState<number | null>(null);

  const isPortraitPhone = layout === "portrait-phone";
  const useContain = banner && !preview && !isPortraitPhone && !isWide;
  const useCover = banner && !preview && !isPortraitPhone && isWide;

  const syncBannerHeight = useCallback(() => {
    const img = imgRef.current;
    const header = headerRef.current;
    if (!img || !header || !banner || preview || isPortraitPhone) return;

    if (useContain) {
      const measured = Math.round(img.getBoundingClientRect().height);
      const computed = computeBannerHeight(img, header.clientWidth);
      const next = measured > 0 ? measured : computed;
      if (!next || next <= 0) return;
      lockedContainHeightRef.current = clampContainBannerHeight(next);
      setCoverHeight(null);
      return;
    }

    if (!useCover) return;

    const computed = computeBannerHeight(img, header.clientWidth);
    setCoverHeight(
      resolveCoverBannerHeight(lockedContainHeightRef.current, computed)
    );
  }, [banner, preview, isPortraitPhone, useContain, useCover]);

  useLayoutEffect(() => {
    lockedContainHeightRef.current = null;
    setCoverHeight(null);
  }, [bannerUrl]);

  useLayoutEffect(() => {
    syncBannerHeight();
    const img = imgRef.current;
    if (!img) return;

    const onLoad = () => syncBannerHeight();
    if (!img.complete) img.addEventListener("load", onLoad);
    window.addEventListener("resize", syncBannerHeight);
    return () => {
      img.removeEventListener("load", onLoad);
      window.removeEventListener("resize", syncBannerHeight);
    };
  }, [syncBannerHeight, bannerUrl, isWide]);

  if (banner && bannerUrl) {
    const layoutClass = preview
      ? "chat-hero-preview"
      : isPortraitPhone
        ? "chat-hero-mobile"
        : useContain
          ? "chat-hero-contain"
          : "chat-hero-cover";

    const resolvedCoverHeight = resolveCoverBannerHeight(
      lockedContainHeightRef.current,
      coverHeight
    );

    return (
      <header
        ref={headerRef}
        className={cn("chat-hero chat-hero-banner shrink-0", layoutClass)}
        style={
          {
            "--chat-hero-fade-to": theme.pageBg,
            ...(useCover
              ? {
                  height: resolvedCoverHeight,
                  "--chat-hero-banner-max-height": `${resolvedCoverHeight}px`,
                }
              : {}),
          } as React.CSSProperties
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={bannerUrl} alt="" className="chat-hero-img" />
        <div
          className={cn(
            "chat-hero-profile-overlay flex items-end justify-between gap-2 px-4 pb-3",
            useCover || preview ? "pt-4" : "pt-10"
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <BrandAvatar onBanner />
            <div className="min-w-0">
              <p
                className="truncate text-sm font-semibold"
                style={{
                  color: textColors.bannerHeaderTitle,
                  textShadow: "0 1px 3px rgba(0,0,0,0.45)",
                }}
              >
                {theme.brandName}
              </p>
              <p
                className="line-clamp-2 text-xs leading-snug"
                style={{
                  color: textColors.bannerHeaderSubtitle,
                  textShadow: "0 1px 3px rgba(0,0,0,0.45)",
                }}
              >
                {theme.headerSubtitle}
              </p>
            </div>
          </div>
          <HeaderActions
            onNewChat={onNewChat}
            canToggle={canToggle}
            isWide={isWide}
            onToggleView={toggleViewMode}
            onBanner
          />
        </div>
      </header>
    );
  }

  return (
    <header
      className="chat-shell-header-classic flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3"
      style={{ backgroundColor: theme.headerBg, color: theme.headerText }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <BrandAvatar />
        <div className="min-w-0">
          <p
            className="truncate text-sm font-semibold"
            style={{ color: textColors.classicHeaderTitle }}
          >
            {theme.brandName}
          </p>
          <p
            className="truncate text-xs"
            style={{ color: textColors.classicHeaderSubtitle }}
          >
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
    </header>
  );
}

function BrandAvatar({ onBanner = false }: { onBanner?: boolean }) {
  const theme = useChatTheme();
  const initial = (theme.brandName || "O").slice(0, 1).toUpperCase();
  const logoUrl = resolveAssetUrl(theme.logoUrl);

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className={cn(
          "size-9 shrink-0 rounded-xl object-cover",
          onBanner ? "ring-2 ring-white/90 shadow-md" : "ring-2 ring-white/20"
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white",
        onBanner && "shadow-md ring-2 ring-white/90"
      )}
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
  onBanner = false,
}: {
  onNewChat?: () => void;
  canToggle: boolean;
  isWide: boolean;
  onToggleView: () => void;
  onBanner?: boolean;
}) {
  const theme = useChatTheme();

  const chipClass = cn(
    "chat-action-chip flex items-center justify-center rounded-full transition-opacity hover:opacity-90",
    onBanner && "chat-hero-action-chip"
  );

  const chipStyle = onBanner
    ? undefined
    : {
        backgroundColor: `${theme.primaryColor}18`,
        color: theme.headerText,
        border: `1px solid ${theme.primaryColor}30`,
      };

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {canToggle && (
        <button
          type="button"
          onClick={onToggleView}
          className={cn(chipClass, "size-8")}
          style={chipStyle}
          aria-label={isWide ? "Contract chat" : "Expand chat"}
          title={isWide ? "Contract" : "Expand"}
        >
          {isWide ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>
      )}
      <button
        type="button"
        onClick={onNewChat}
        className={cn(chipClass, "gap-1.5 px-3 py-1.5 text-xs font-medium")}
        style={chipStyle}
      >
        <PenSquare className="size-3.5" />
        <span className="hidden sm:inline">New chat</span>
      </button>
    </div>
  );
}
