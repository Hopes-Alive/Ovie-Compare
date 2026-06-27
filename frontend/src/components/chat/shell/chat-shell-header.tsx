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

  const bannerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const lockedContainHeightRef = useRef<number | null>(null);
  const [coverHeight, setCoverHeight] = useState<number | null>(null);

  const isPortraitPhone = layout === "portrait-phone";
  const useContain = banner && !preview && !isPortraitPhone && !isWide;
  const useCover = banner && !preview && !isPortraitPhone && isWide;

  const syncBannerHeight = useCallback(() => {
    const img = imgRef.current;
    const bannerEl = bannerRef.current;
    if (!img || !bannerEl || !banner || preview || isPortraitPhone) return;

    if (useContain) {
      const measured = Math.round(img.getBoundingClientRect().height);
      const computed = computeBannerHeight(img, bannerEl.clientWidth);
      const next = measured > 0 ? measured : computed;
      if (!next || next <= 0) return;
      lockedContainHeightRef.current = clampContainBannerHeight(next);
      setCoverHeight(null);
      return;
    }

    if (!useCover) return;

    const computed = computeBannerHeight(img, bannerEl.clientWidth);
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

  const toolbar = (
    <div
      className="relative z-20 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5 backdrop-blur-sm"
      style={{
        backgroundColor: `${theme.pageBg}f2`,
        borderColor: `${theme.primaryColor}18`,
      }}
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
    </div>
  );

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
      <header className="chat-hero-banner-stack relative z-20 shrink-0">
        <div
          ref={bannerRef}
          className={cn("chat-hero chat-hero-banner", layoutClass)}
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
        </div>
        {toolbar}
      </header>
    );
  }

  return (
    <header
      className="chat-shell-header-classic relative z-20 shrink-0 border-b border-white/10"
      style={{ backgroundColor: theme.headerBg, color: theme.headerText }}
    >
      {toolbar}
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

  const chipClass =
    "chat-action-chip flex items-center justify-center rounded-full border transition-opacity hover:opacity-90";

  const chipStyle = {
    backgroundColor: `${theme.primaryColor}14`,
    color: theme.headerText,
    borderColor: `${theme.primaryColor}28`,
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
        aria-label="New chat"
      >
        <PenSquare className="size-3.5" />
        <span>New chat</span>
      </button>
    </div>
  );
}
