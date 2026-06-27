"use client";

import { useChatTheme } from "@/components/chat/theme/chat-theme-provider";
import { resolveAssetUrl } from "@/lib/chat-design/asset-url";
import { cn } from "@/lib/utils";

type AssistantAvatarProps = {
  className?: string;
  size?: "sm" | "md";
};

export function AssistantAvatar({ className, size = "md" }: AssistantAvatarProps) {
  const theme = useChatTheme();
  const initial = (theme.brandName || "O").slice(0, 1).toUpperCase();
  const logoUrl = resolveAssetUrl(theme.logoUrl);
  const dim = size === "sm" ? "size-7" : "size-9";

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className={cn(dim, "shrink-0 rounded-xl object-cover ring-2 ring-background shadow-sm", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        dim,
        "flex shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm ring-2 ring-background",
        className
      )}
      style={{ backgroundColor: theme.primaryColor }}
    >
      {initial}
    </div>
  );
}
