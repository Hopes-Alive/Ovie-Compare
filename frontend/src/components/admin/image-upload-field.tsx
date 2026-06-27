"use client";

import { Loader2, Upload, X, ZoomIn } from "lucide-react";
import { useRef, useState } from "react";

import { ClickableImage } from "@/components/ui/image-lightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveAssetUrl } from "@/lib/chat-design/asset-url";
import { cn } from "@/lib/utils";

type UploadKind =
  | "logo"
  | "header-banner"
  | "background"
  | "background-expanded"
  | "supplier-logo";

type ImageUploadFieldProps = {
  label: string;
  kind: UploadKind;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
  supplierSlug?: string;
  preview?: "logo" | "banner";
};

export function ImageUploadField({
  label,
  kind,
  value,
  onChange,
  hint,
  supplierSlug,
  preview,
}: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayUrl = resolveAssetUrl(value);
  const useLogoPreview = preview === "logo" || kind === "logo";

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      if (kind === "supplier-logo" && supplierSlug) {
        form.append("slug", supplierSlug);
      }

      const res = await fetch("/api/admin/uploads", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {hint && <p className="text-xs text-muted-foreground/80">{hint}</p>}

      {displayUrl ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-muted/30">
          {useLogoPreview ? (
            <div className="flex items-center justify-center p-4">
              <ClickableImage
                src={displayUrl}
                alt={label}
                className="size-20 rounded-xl object-contain"
              />
            </div>
          ) : (
            <ClickableImage
              src={displayUrl}
              alt={label}
              className="aspect-[21/9] w-full bg-muted"
            />
          )}
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-2 size-8"
            onClick={() => onChange("")}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          disabled={uploading}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-sm text-muted-foreground transition-all",
            dragging
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
          )}
        >
          {uploading ? (
            <Loader2 className="size-8 animate-spin" />
          ) : (
            <>
              <Upload className={cn("size-8", dragging ? "text-primary" : "opacity-50")} />
              <span>{dragging ? "Drop image here" : "Drag & drop or click to upload"}</span>
              <span className="text-xs opacity-70">PNG, JPG, WebP · max 5 MB</span>
            </>
          )}
        </button>
      )}

      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Or paste image URL…"
          className="font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        </Button>
        {displayUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open(displayUrl, "_blank")}
          >
            <ZoomIn className="size-4" />
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
