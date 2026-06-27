"use client";

import { useChatTheme } from "@/components/chat/theme/chat-theme-provider";
import { resolveAssetUrl } from "@/lib/chat-design/asset-url";

type ChatMessagesBackdropProps = {
  children: React.ReactNode;
};

/** Optional full-bleed background image behind the messages area */
export function ChatMessagesBackdrop({ children }: ChatMessagesBackdropProps) {
  const theme = useChatTheme();
  const bgUrl = resolveAssetUrl(theme.backgroundImageUrl);
  const hasBg = Boolean(bgUrl);
  const sharpness = Math.max(0, Math.min(100, theme.backgroundSharpness ?? 100));
  const blurPx = ((100 - sharpness) / 100) * 8;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {hasBg && (
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            backgroundImage: `url(${bgUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
            transform: blurPx > 0 ? "scale(1.05)" : undefined,
          }}
        />
      )}
      {hasBg && (
        <div
          className="pointer-events-none absolute inset-0 bg-white/75 dark:bg-slate-950/70"
          aria-hidden
        />
      )}
      <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
