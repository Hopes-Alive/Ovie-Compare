"use client";

import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ImageLightboxProps = {
  images: string[];
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIndex?: number;
};

export function ImageLightbox({
  images,
  alt = "Image",
  open,
  onOpenChange,
  initialIndex = 0,
}: ImageLightboxProps) {
  const valid = images.filter(Boolean);
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  const hasMultiple = valid.length > 1;
  const safeIndex = Math.min(index, Math.max(valid.length - 1, 0));

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + valid.length) % valid.length);
  }, [valid.length]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % valid.length);
  }, [valid.length]);

  useEffect(() => {
    if (!open || !hasMultiple) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hasMultiple, prev, next]);

  if (valid.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[95vh] max-w-[95vw] border-none bg-black/95 p-0 sm:max-w-4xl"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <div className="relative flex min-h-[50vh] items-center justify-center p-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 z-10 text-white hover:bg-white/10"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-5" />
          </Button>

          {hasMultiple && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 text-white hover:bg-white/10"
                onClick={prev}
              >
                <ChevronLeft className="size-6" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 text-white hover:bg-white/10"
                onClick={next}
              >
                <ChevronRight className="size-6" />
              </Button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={valid[safeIndex]}
            alt={alt}
            className="max-h-[85vh] max-w-full object-contain"
          />

          {hasMultiple && (
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/70">
              {safeIndex + 1} / {valid.length}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Thumbnail that opens lightbox on click */
export function ClickableImage({
  src,
  alt,
  className,
  images,
  imageIndex = 0,
}: {
  src: string;
  alt: string;
  className?: string;
  images?: string[];
  imageIndex?: number;
}) {
  const [open, setOpen] = useState(false);
  const gallery = images?.length ? images : [src];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative cursor-zoom-in overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          className
        )}
        aria-label={`View ${alt} full size`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="size-full object-contain" />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
          <ZoomIn className="size-5 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
        </span>
      </button>
      <ImageLightbox
        images={gallery}
        alt={alt}
        open={open}
        onOpenChange={setOpen}
        initialIndex={imageIndex}
      />
    </>
  );
}
