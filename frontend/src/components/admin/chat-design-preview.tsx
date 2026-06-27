"use client";

import { ExternalLink, Maximize2, Monitor, Smartphone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ChatDesignPaletteOverview } from "@/components/admin/chat-design-palette-overview";
import {
  ChatDesignPreviewContent,
  type PreviewMode,
} from "@/components/admin/chat-design-preview-content";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROUTES } from "@/config/routes";
import { cn } from "@/lib/utils";
import type { ChatDesignTheme } from "@/types/chat-design";

type ChatDesignPreviewProps = {
  theme: ChatDesignTheme;
};

export function ChatDesignPreview({ theme }: ChatDesignPreviewProps) {
  const [mode, setMode] = useState<PreviewMode>("mobile");
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  return (
    <>
      <div className="w-full xl:w-[400px] xl:shrink-0">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm ring-1 ring-black/[0.02]">
          <PreviewToolbar
            mode={mode}
            onModeChange={setMode}
            onFullscreen={() => setFullscreenOpen(true)}
          />

          <div className="p-4">
            <ChatDesignPreviewContent theme={theme} mode={mode} />

            <div className="mt-4 flex items-center justify-center gap-2">
              <Badge variant="secondary" className="font-normal">
                Shell only
              </Badge>
              <span className="text-xs text-muted-foreground">Header, empty state, composer</span>
            </div>
          </div>

          <div className="border-t border-border/60 p-4">
            <ChatDesignPaletteOverview theme={theme} compact />
          </div>
        </div>
      </div>

      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="max-w-5xl p-0 sm:max-w-5xl" showCloseButton>
          <DialogHeader className="border-b border-border/60 px-6 py-4">
            <DialogTitle>Chat design preview</DialogTitle>
            <DialogDescription>
              Full-size preview of your current theme — mobile and desktop layouts side by side.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 px-6 py-5 lg:grid-cols-2">
            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Smartphone className="size-4 text-muted-foreground" />
                Mobile
              </p>
              <ChatDesignPreviewContent theme={theme} mode="mobile" mobileHeight={560} />
            </div>
            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Monitor className="size-4 text-muted-foreground" />
                Desktop expanded
              </p>
              <ChatDesignPreviewContent theme={theme} mode="desktop" desktopHeight={420} />
            </div>
          </div>
          <div className="border-t border-border/60 px-6 py-4">
            <ChatDesignPaletteOverview theme={theme} compact />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PreviewToolbar({
  mode,
  onModeChange,
  onFullscreen,
}: {
  mode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
  onFullscreen: () => void;
}) {
  return (
    <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-medium text-foreground">Live preview</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onFullscreen}
            aria-label="Fullscreen preview"
            title="Fullscreen preview"
          >
            <Maximize2 className="size-3.5" />
          </Button>
          <Link
            href={ROUTES.chat}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "h-7 gap-1.5 px-2 text-xs",
            })}
          >
            <ExternalLink className="size-3.5" />
            Open chat
          </Link>
        </div>
      </div>
      <div className="mt-3 flex rounded-lg border border-border/70 bg-background/80 p-0.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-8 flex-1 gap-1.5 text-xs", mode === "mobile" && "bg-muted shadow-sm")}
          onClick={() => onModeChange("mobile")}
        >
          <Smartphone className="size-3.5" />
          Mobile
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("h-8 flex-1 gap-1.5 text-xs", mode === "desktop" && "bg-muted shadow-sm")}
          onClick={() => onModeChange("desktop")}
        >
          <Monitor className="size-3.5" />
          Desktop
        </Button>
      </div>
    </div>
  );
}
