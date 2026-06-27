"use client";

import { useChatTheme } from "@/components/chat/theme/chat-theme-provider";

export function ChatBackground() {
  const theme = useChatTheme();

  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${theme.pageBg} 0%, ${theme.pageBg}ee 100%)`,
        }}
      />
      <div className="absolute inset-0">
        <div
          className="absolute top-0 right-0 h-[480px] w-[480px] rounded-full blur-[120px] md:blur-[140px]"
          style={{ backgroundColor: `${theme.primaryColor}1a` }}
        />
        <div
          className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full blur-[100px] md:blur-[120px]"
          style={{ backgroundColor: `${theme.primaryColor}14` }}
        />
        <div
          className="absolute top-1/2 left-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px] md:blur-[100px]"
          style={{ backgroundColor: `${theme.accentColor}0d` }}
        />
      </div>
    </div>
  );
}
