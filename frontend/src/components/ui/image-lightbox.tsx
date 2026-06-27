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
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
      if (hasMultiple && e.key === "ArrowLeft") prev();
      if (hasMultiple && e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, hasMultiple, prev, next, onOpenChange]);

  if (valid.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-black/80 backdrop-blur-sm"
        className={cn(
          "fixed inset-0 top-0 left-0 z-50 flex h-dvh w-dvw max-w-none translate-x-0 translate-y-0 flex-col",
          "rounded-none border-0 bg-transparent p-0 shadow-none ring-0",
          "data-open:zoom-in-95 data-closed:zoom-out-95"
        )}
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>

        {/* Top bar */}
        <div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
          <p className="truncate pr-4 text-sm font-medium text-white/90">{alt}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => onOpenChange(false)}
            aria-label="Close image viewer"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Image stage */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-8">
          <div className="relative flex max-h-full max-w-full items-center justify-center">
            {hasMultiple && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 z-10 size-11 -translate-y-1/2 rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 sm:-left-4 sm:-translate-x-full sm:translate-y-0 sm:top-1/2 sm:-translate-y-1/2"
                onClick={prev}
                aria-label="Previous image"
              >
                <ChevronLeft className="size-6" />
              </Button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={valid[safeIndex]}
              alt={alt}
              referrerPolicy="no-referrer"
              className="max-h-[calc(100dvh-8rem)] max-w-[min(92vw,56rem)] rounded-lg bg-white object-contain shadow-2xl"
            />

            {hasMultiple && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 z-10 size-11 -translate-y-1/2 rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 sm:-right-4 sm:translate-x-full sm:translate-y-0 sm:top-1/2 sm:-translate-y-1/2"
                onClick={next}
                aria-label="Next image"
              >
                <ChevronRight className="size-6" />
              </Button>
            )}
          </div>
        </div>

        {/* Bottom strip — counter + thumbnails */}
        {hasMultiple && (
          <div className="shrink-0 border-t border-white/10 bg-black/40 px-4 py-3 sm:px-6">
            <p className="mb-2 text-center text-xs font-medium text-white/70">
              {safeIndex + 1} of {valid.length}
            </p>
            <div className="flex justify-center gap-2 overflow-x-auto pb-1">
              {valid.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={cn(
                    "size-14 shrink-0 overflow-hidden rounded-md border-2 bg-white transition-all",
                    i === safeIndex
                      ? "border-white opacity-100 ring-2 ring-white/30"
                      : "border-transparent opacity-60 hover:opacity-90"
                  )}
                  aria-label={`View image ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-full object-contain"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
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
        <img src={src} alt={alt} className="size-full object-contain" referrerPolicy="no-referrer" />
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
