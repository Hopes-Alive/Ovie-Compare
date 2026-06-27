"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";

import { ImageLightbox } from "@/components/ui/image-lightbox";
import { resolveAssetUrl } from "@/lib/chat-design/asset-url";
import { cn } from "@/lib/utils";

type ProductImageCarouselProps = {
  imageUrls?: string[];
  name: string;
};

export function ProductImageCarousel({ imageUrls, name }: ProductImageCarouselProps) {
  const images = (imageUrls ?? []).map(resolveAssetUrl).filter(Boolean);
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [errored, setErrored] = useState<Set<number>>(new Set());

  const validImages = images.filter((_, i) => !errored.has(i));
  const hasMultiple = validImages.length > 1;

  if (validImages.length === 0) {
    return (
      <div className="flex size-full items-center justify-center rounded-l-xl bg-muted">
        <Package className="size-8 text-muted-foreground/50" />
      </div>
    );
  }

  const safeIndex = Math.min(index, validImages.length - 1);
  const currentSrc = validImages[safeIndex];

  function prev(e: React.MouseEvent) {
    e.stopPropagation();
    setIndex((i) => (i - 1 + validImages.length) % validImages.length);
  }

  function next(e: React.MouseEvent) {
    e.stopPropagation();
    setIndex((i) => (i + 1) % validImages.length);
  }

  return (
    <>
      <div className="group relative size-full overflow-hidden rounded-l-xl bg-muted">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`View ${name} full size`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentSrc}
            alt={name}
            className="size-full object-contain p-2"
            onError={() => {
              const originalIdx = images.indexOf(currentSrc);
              setErrored((prev) => new Set([...prev, originalIdx]));
            }}
          />
        </button>

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={prev}
              className={cn(
                "absolute left-1 top-1/2 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-all",
                "opacity-0 group-hover:opacity-100 hover:scale-110 hover:bg-background"
              )}
              aria-label="Previous image"
            >
              <ChevronLeft className="size-3.5" />
            </button>

            <button
              type="button"
              onClick={next}
              className={cn(
                "absolute right-1 top-1/2 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur-sm transition-all",
                "opacity-0 group-hover:opacity-100 hover:scale-110 hover:bg-background"
              )}
              aria-label="Next image"
            >
              <ChevronRight className="size-3.5" />
            </button>

            <div className="pointer-events-none absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1">
              {validImages.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "size-1.5 rounded-full",
                    i === safeIndex ? "w-3 bg-foreground" : "bg-foreground/30"
                  )}
                />
              ))}
            </div>

            <div className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-background/70 px-1.5 py-0.5 text-[10px] font-medium text-foreground backdrop-blur-sm">
              {safeIndex + 1}/{validImages.length}
            </div>
          </>
        )}
      </div>

      <ImageLightbox
        images={validImages}
        alt={name}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        initialIndex={safeIndex}
      />
    </>
  );
}
