"use client";

import { Loader2, RotateCcw, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ChatDesignPreview } from "@/components/admin/chat-design-preview";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_CHAT_DESIGN, resolveChatDesign } from "@/lib/chat-design/theme";
import type { ChatDesignTheme } from "@/types/chat-design";

const PRESETS: Array<{ name: string; colors: Partial<ChatDesignTheme> }> = [
  {
    name: "Professional Blue",
    colors: {
      primaryColor: "#2563eb",
      accentColor: "#0ea5e9",
      pageBg: "#f0f7ff",
      headerBg: "#1e40af",
      headerText: "#ffffff",
      composerBg: "#ffffff",
      composerInputBg: "#eff6ff",
    },
  },
  {
    name: "Clinical Teal",
    colors: {
      primaryColor: "#0d9488",
      accentColor: "#14b8a6",
      pageBg: "#f0fdfa",
      headerBg: "#0f766e",
      headerText: "#ffffff",
      composerBg: "#ffffff",
      composerInputBg: "#ccfbf1",
    },
  },
  {
    name: "Warm Neutral",
    colors: {
      primaryColor: "#b45309",
      accentColor: "#f59e0b",
      pageBg: "#fffbeb",
      headerBg: "#78350f",
      headerText: "#ffffff",
      composerBg: "#ffffff",
      composerInputBg: "#fef3c7",
    },
  },
];

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-border"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
      </div>
    </div>
  );
}

export function ChatDesignEditor() {
  const [theme, setTheme] = useState<ChatDesignTheme>(DEFAULT_CHAT_DESIGN);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/chat-design")
      .then((r) => r.json())
      .then((data: { theme?: Partial<ChatDesignTheme>; error?: string }) => {
        if (data.theme) setTheme(resolveChatDesign(data.theme));
        if (data.error) setError(data.error);
      })
      .catch(() => setError("Could not load chat design"))
      .finally(() => setLoading(false));
  }, []);

  const patch = useCallback((partial: Partial<ChatDesignTheme>) => {
    setTheme((prev) => ({ ...prev, ...partial }));
    setSaved(false);
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/chat-design", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (data.theme) setTheme(resolveChatDesign(data.theme));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setTheme({ ...DEFAULT_CHAT_DESIGN });
    setSaved(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" />
        Loading chat design…
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <AdminPageHeader
          title="Chat Design"
          description="Customize the chat page shell — header, background, colors, and empty state. Message bubbles and product cards are unchanged."
        />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="size-4" />
            Reset defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {saved ? "Saved" : "Save changes"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          {/* Quick presets */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick themes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  onClick={() => patch(preset.colors)}
                >
                  <span
                    className="mr-2 inline-block size-3 rounded-full"
                    style={{ backgroundColor: preset.colors.primaryColor }}
                  />
                  {preset.name}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Brand */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Brand & header</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Brand name">
                <Input value={theme.brandName} onChange={(e) => patch({ brandName: e.target.value })} />
              </Field>
              <Field label="Header subtitle">
                <Input value={theme.headerSubtitle} onChange={(e) => patch({ headerSubtitle: e.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <ImageUploadField
                  label="Logo"
                  kind="logo"
                  value={theme.logoUrl}
                  onChange={(logoUrl) => patch({ logoUrl })}
                />
              </div>
              <div className="sm:col-span-2">
                <ImageUploadField
                  label="Header banner"
                  kind="header-banner"
                  value={theme.headerBannerImageUrl}
                  onChange={(headerBannerImageUrl) => patch({ headerBannerImageUrl })}
                  hint="Wide image at the top of the chat. Enables hero header layout."
                />
              </div>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Colors</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <ColorField label="Primary" value={theme.primaryColor} onChange={(v) => patch({ primaryColor: v })} />
              <ColorField label="Accent" value={theme.accentColor} onChange={(v) => patch({ accentColor: v })} />
              <ColorField label="Page background" value={theme.pageBg} onChange={(v) => patch({ pageBg: v })} />
              <ColorField label="Header background" value={theme.headerBg} onChange={(v) => patch({ headerBg: v })} />
              <ColorField label="Header text" value={theme.headerText} onChange={(v) => patch({ headerText: v })} />
              <ColorField label="Composer background" value={theme.composerBg} onChange={(v) => patch({ composerBg: v })} />
              <ColorField label="Input background" value={theme.composerInputBg} onChange={(v) => patch({ composerInputBg: v })} />
              <ColorField label="Send button" value={theme.sendButtonBg || theme.primaryColor} onChange={(v) => patch({ sendButtonBg: v })} />
            </CardContent>
          </Card>

          {/* Background image */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Background image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageUploadField
                label="Chat background"
                kind="background"
                value={theme.backgroundImageUrl}
                onChange={(backgroundImageUrl) => patch({ backgroundImageUrl })}
                hint="Shown behind the messages area. Use sharpness slider to blur."
              />
              <Field label={`Background sharpness (${theme.backgroundSharpness}%)`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={theme.backgroundSharpness}
                  onChange={(e) => patch({ backgroundSharpness: Number(e.target.value) })}
                  className="w-full"
                />
              </Field>
            </CardContent>
          </Card>

          {/* Empty state */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Empty state</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Title">
                <Input value={theme.emptyStateTitle} onChange={(e) => patch({ emptyStateTitle: e.target.value })} />
              </Field>
              <Field label="Subtitle">
                <Textarea
                  value={theme.emptyStateSubtitle}
                  onChange={(e) => patch({ emptyStateSubtitle: e.target.value })}
                  rows={2}
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        <div className="xl:sticky xl:top-6">
          <ChatDesignPreview theme={theme} />
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
