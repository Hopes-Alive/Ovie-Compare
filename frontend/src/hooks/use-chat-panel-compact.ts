"use client";

import { useChatViewModeContext } from "@/components/chat/chat-view-mode-context";

/** True when the chat panel is narrow (phone portrait, phone landscape, or desktop narrow mode). */
export function useChatPanelCompact(): boolean {
  const { layout, isWide } = useChatViewModeContext();
  if (layout === "portrait-phone" || layout === "phone-landscape") return true;
  return !isWide;
}
