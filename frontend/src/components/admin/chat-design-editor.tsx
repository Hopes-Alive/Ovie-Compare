"use client";

import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ExternalLink,
  ImageIcon,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  Sparkles,
  Store,
  Type,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ChatDesignColorField } from "@/components/admin/chat-design-color-field";
import { ChatDesignPaletteOverview } from "@/components/admin/chat-design-palette-overview";
import { ChatDesignPresetCards } from "@/components/admin/chat-design-preset-cards";
import { ChatDesignPreview } from "@/components/admin/chat-design-preview";
import {
  ChatDesignSectionNav,
  type ChatDesignSection,
} from "@/components/admin/chat-design-section-nav";
import { ChatDesignSuggestedPromptsEditor } from "@/components/admin/chat-design-suggested-prompts-editor";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { SupplierLogosEditor } from "@/components/admin/supplier-logos-editor";
import { AdminPageShell } from "@/components/admin/shell/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/config/routes";
import {
  getChatDesignSetupItems,
  getSetupProgress,
} from "@/lib/chat-design/setup-progress";
import { DEFAULT_CHAT_DESIGN, resolveChatDesign } from "@/lib/chat-design/theme";
import { cn } from "@/lib/utils";
import type { ChatDesignTheme } from "@/types/chat-design";

type SectionId = "themes" | "brand" | "colors" | "media" | "content";

const SECTION_DEFS: Array<Omit<ChatDesignSection, "complete"> & { id: SectionId }> = [
  {
    id: "themes",
    label: "Themes",
    icon: Sparkles,
    description: "Pick a starting palette, then customize every color.",
  },
  {
    id: "brand",
    label: "Brand",
    icon: Store,
    description: "Logo, name, banner, and supplier logos for product cards.",
  },
  {
    id: "colors",
    label: "Colors",
    icon: Palette,
    description: "Fine-tune surfaces and typography across the chat shell.",
  },
  {
    id: "media",
    label: "Media",
    icon: ImageIcon,
    description: "Background images for mobile card and desktop expanded views.",
  },
  {
    id: "content",
    label: "Content",
    icon: Type,
    description: "Welcome copy and suggested prompt cards on the empty state.",
  },
];

function getSectionCompletion(theme: ChatDesignTheme): Record<SectionId, boolean> {
  const supplierLogoCount = Object.values(theme.supplierLogos ?? {}).filter(Boolean).length;

  return {
    themes: theme.primaryColor !== DEFAULT_CHAT_DESIGN.primaryColor,
    brand: Boolean(theme.logoUrl || theme.headerBannerImageUrl || supplierLogoCount > 0),
    colors: theme.primaryColor !== DEFAULT_CHAT_DESIGN.primaryColor,
    media: Boolean(theme.backgroundImageUrl || theme.expandedBackgroundImageUrl),
    content:
      theme.emptyStateTitle !== DEFAULT_CHAT_DESIGN.emptyStateTitle ||
      theme.suggestedPrompts.some(
        (prompt, index) =>
          prompt.prompt !== DEFAULT_CHAT_DESIGN.suggestedPrompts[index]?.prompt
      ),
  };
}

export function ChatDesignEditor() {
  const [theme, setTheme] = useState<ChatDesignTheme>(DEFAULT_CHAT_DESIGN);
  const [savedTheme, setSavedTheme] = useState<ChatDesignTheme>(DEFAULT_CHAT_DESIGN);
  const [activeSection, setActiveSection] = useState<SectionId>("themes");
  const [showAdvancedTextColors, setShowAdvancedTextColors] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sectionCompletion = useMemo(() => getSectionCompletion(theme), [theme]);
  const sections: ChatDesignSection[] = SECTION_DEFS.map((section) => ({
    ...section,
    complete: sectionCompletion[section.id],
  }));
  const setupItems = useMemo(() => getChatDesignSetupItems(theme), [theme]);
  const setupProgress = useMemo(() => getSetupProgress(setupItems), [setupItems]);

  const activeMeta = SECTION_DEFS.find((s) => s.id === activeSection)!;
  const activeIndex = SECTION_DEFS.findIndex((s) => s.id === activeSection);
  const prevSection = activeIndex > 0 ? SECTION_DEFS[activeIndex - 1] : null;
  const nextSection =
    activeIndex < SECTION_DEFS.length - 1 ? SECTION_DEFS[activeIndex + 1] : null;

  useEffect(() => {
    fetch("/api/admin/chat-design")
      .then((r) => r.json())
      .then((data: { theme?: Partial<ChatDesignTheme>; error?: string }) => {
        if (data.theme) {
          const resolved = resolveChatDesign(data.theme);
          setTheme(resolved);
          setSavedTheme(resolved);
        }
        if (data.error) setError(data.error);
      })
      .catch(() => setError("Could not load chat design"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const patch = useCallback((partial: Partial<ChatDesignTheme>) => {
    setTheme((prev) => ({ ...prev, ...partial }));
    setIsDirty(true);
    setShowSaveSuccess(false);
  }, []);

  const handleSave = useCallback(async () => {
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
      const resolved = data.theme ? resolveChatDesign(data.theme) : theme;
      setTheme(resolved);
      setSavedTheme(resolved);
      setIsDirty(false);
      setShowSaveSuccess(true);
      window.setTimeout(() => setShowSaveSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [theme]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (isDirty && !saving) void handleSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, isDirty, saving]);

  function handleResetConfirm() {
    setTheme({ ...DEFAULT_CHAT_DESIGN });
    setIsDirty(true);
    setShowSaveSuccess(false);
    setResetDialogOpen(false);
  }

  function handleDiscardChanges() {
    setTheme(savedTheme);
    setIsDirty(false);
    setShowSaveSuccess(false);
  }

  if (loading) {
    return <ChatDesignEditorSkeleton />;
  }

  const statusBadge = showSaveSuccess ? (
    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
      Saved successfully
    </Badge>
  ) : isDirty ? (
    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
      Unsaved changes
    </Badge>
  ) : (
    <Badge variant="secondary">Up to date</Badge>
  );

  const headerActions = (
    <>
      <Link
        href={ROUTES.chat}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "hidden sm:inline-flex",
        })}
      >
        <ExternalLink className="size-4" />
        View live chat
      </Link>
      {isDirty && (
        <Button variant="ghost" size="sm" onClick={handleDiscardChanges}>
          Discard
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => setResetDialogOpen(true)}>
        <RotateCcw className="size-4" />
        Reset defaults
      </Button>
      <Button size="sm" onClick={() => void handleSave()} disabled={saving || !isDirty}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Save
        <kbd className="ml-1.5 hidden rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 py-0.5 text-[10px] font-medium lg:inline">
          ⌘S
        </kbd>
      </Button>
    </>
  );

  const headerExtra = (
    <>
      <div className="mt-3">{statusBadge}</div>
      <div className="mt-4 max-w-md">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-[var(--admin-muted)]">Setup progress</span>
          <span className="tabular-nums text-[var(--admin-muted)]">
            {setupProgress.completed}/{setupProgress.total} complete
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--admin-border)]">
          <div
            className="h-full rounded-full bg-[var(--admin-foreground)] transition-all duration-500 ease-out"
            style={{ width: `${setupProgress.percent}%` }}
          />
        </div>
      </div>
    </>
  );

  return (
    <>
      <AdminPageShell
        title="Chat Design"
        description="Customize the chat page shell — header, backgrounds, supplier logos, and empty state."
        stickyHeader
        actions={headerActions}
        headerExtra={headerExtra}
        className="pb-24 xl:pb-0"
      >
        {error && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-6 lg:flex-row">
            <ChatDesignSectionNav
              sections={sections}
              activeSection={activeSection}
              onSectionChange={(id) => setActiveSection(id as SectionId)}
            />

            <div className="min-w-0 flex-1">
              <div className="mb-6 rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-3">
                <p className="text-sm font-medium text-foreground">{activeMeta.label}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{activeMeta.description}</p>
              </div>

              <div
                key={activeSection}
                className="space-y-6 animate-in fade-in slide-in-from-bottom-1 duration-300"
              >
                {activeSection === "themes" && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Quick themes</CardTitle>
                        <CardDescription>
                          One-click palettes — switch anytime without losing your other settings.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ChatDesignPresetCards
                          activePrimary={theme.primaryColor}
                          onSelect={(colors) => patch(colors)}
                        />
                      </CardContent>
                    </Card>
                    <ChatDesignPaletteOverview theme={theme} />
                  </>
                )}

                {activeSection === "brand" && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Brand & header</CardTitle>
                        <CardDescription>
                          Name, logo, and optional hero banner shown at the top of chat.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-5 sm:grid-cols-2">
                        <Field label="Brand name">
                          <Input
                            value={theme.brandName}
                            onChange={(e) => patch({ brandName: e.target.value })}
                          />
                        </Field>
                        <Field label="Header subtitle">
                          <Input
                            value={theme.headerSubtitle}
                            onChange={(e) => patch({ headerSubtitle: e.target.value })}
                          />
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

                    <SupplierLogosEditor
                      theme={theme}
                      onLogoChange={(slug, logoUrl) =>
                        patch({
                          supplierLogos: {
                            ...theme.supplierLogos,
                            [slug]: logoUrl,
                          },
                        })
                      }
                    />
                  </>
                )}

                {activeSection === "colors" && (
                  <>
                    <ChatDesignPaletteOverview theme={theme} />

                    <Card>
                      <CardHeader>
                        <CardTitle>Surface colors</CardTitle>
                        <CardDescription>Backgrounds, accents, and interactive elements.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-4 sm:grid-cols-2">
                        <ChatDesignColorField
                          label="Primary"
                          value={theme.primaryColor}
                          onChange={(v) => patch({ primaryColor: v })}
                        />
                        <ChatDesignColorField
                          label="Accent"
                          value={theme.accentColor}
                          onChange={(v) => patch({ accentColor: v })}
                        />
                        <ChatDesignColorField
                          label="Page background"
                          value={theme.pageBg}
                          onChange={(v) => patch({ pageBg: v })}
                        />
                        <ChatDesignColorField
                          label="Header background"
                          value={theme.headerBg}
                          onChange={(v) => patch({ headerBg: v })}
                        />
                        <ChatDesignColorField
                          label="Composer background"
                          value={theme.composerBg}
                          onChange={(v) => patch({ composerBg: v })}
                        />
                        <ChatDesignColorField
                          label="Input background"
                          value={theme.composerInputBg}
                          onChange={(v) => patch({ composerInputBg: v })}
                        />
                        <ChatDesignColorField
                          label="Send button background"
                          value={theme.sendButtonBg || theme.primaryColor}
                          onChange={(v) => patch({ sendButtonBg: v })}
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Text colors</CardTitle>
                        <CardDescription>
                          Contrast ratios shown where text sits on a background. Aim for 4.5:1 or higher.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <ColorGroup title="Header">
                          <ChatDesignColorField
                            label="Header name (classic)"
                            value={theme.headerText}
                            onChange={(v) => patch({ headerText: v })}
                            contrastAgainst={theme.headerBg}
                          />
                          <ChatDesignColorField
                            label="Header subtitle (classic)"
                            value={theme.headerSubtitleText}
                            onChange={(v) => patch({ headerSubtitleText: v })}
                            contrastAgainst={theme.headerBg}
                          />
                          <ChatDesignColorField
                            label="Banner header name"
                            value={theme.bannerHeaderTitleText}
                            onChange={(v) => patch({ bannerHeaderTitleText: v })}
                            contrastAgainst={theme.headerBg}
                          />
                          <ChatDesignColorField
                            label="Banner header subtitle"
                            value={theme.bannerHeaderSubtitleText}
                            onChange={(v) => patch({ bannerHeaderSubtitleText: v })}
                            contrastAgainst={theme.headerBg}
                          />
                        </ColorGroup>

                        <Separator />

                        <ColorGroup title="Empty state & prompts">
                          <ChatDesignColorField
                            label="Empty state title"
                            value={theme.emptyStateTitleText}
                            onChange={(v) => patch({ emptyStateTitleText: v })}
                            contrastAgainst={theme.pageBg}
                          />
                          <ChatDesignColorField
                            label="Empty state subtitle"
                            value={theme.emptyStateSubtitleText}
                            onChange={(v) => patch({ emptyStateSubtitleText: v })}
                            contrastAgainst={theme.pageBg}
                          />
                          <ChatDesignColorField
                            label="Prompt card label"
                            value={theme.promptLabelText}
                            onChange={(v) => patch({ promptLabelText: v })}
                            contrastAgainst={theme.pageBg}
                          />
                          <ChatDesignColorField
                            label="Prompt card text"
                            value={theme.promptText}
                            onChange={(v) => patch({ promptText: v })}
                            contrastAgainst={theme.pageBg}
                          />
                        </ColorGroup>

                        <Separator />

                        <button
                          type="button"
                          onClick={() => setShowAdvancedTextColors((v) => !v)}
                          className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/40"
                        >
                          <span>Composer & send button text</span>
                          <ChevronDown
                            className={cn(
                              "size-4 text-muted-foreground transition-transform",
                              showAdvancedTextColors && "rotate-180"
                            )}
                          />
                        </button>

                        {showAdvancedTextColors && (
                          <ColorGroup title="">
                            <ChatDesignColorField
                              label="Composer input text"
                              value={theme.composerInputText}
                              onChange={(v) => patch({ composerInputText: v })}
                              contrastAgainst={theme.composerInputBg}
                            />
                            <ChatDesignColorField
                              label="Composer disclaimer"
                              value={theme.composerDisclaimerText}
                              onChange={(v) => patch({ composerDisclaimerText: v })}
                              contrastAgainst={theme.composerBg}
                            />
                            <ChatDesignColorField
                              label="Send button text"
                              value={theme.sendButtonText}
                              onChange={(v) => patch({ sendButtonText: v })}
                              contrastAgainst={theme.sendButtonBg || theme.primaryColor}
                            />
                          </ColorGroup>
                        )}
                      </CardContent>
                    </Card>
                  </>
                )}

                {activeSection === "media" && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Background images</CardTitle>
                      <CardDescription>
                        Separate images for mobile card view and desktop expanded layout.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid gap-6 lg:grid-cols-2">
                        <ImageUploadField
                          label="Portrait / card view"
                          kind="background"
                          value={theme.backgroundImageUrl}
                          onChange={(backgroundImageUrl) => patch({ backgroundImageUrl })}
                          hint="Shown behind messages in narrow card and mobile portrait view."
                        />
                        <ImageUploadField
                          label="Expanded view"
                          kind="background-expanded"
                          value={theme.expandedBackgroundImageUrl}
                          onChange={(expandedBackgroundImageUrl) =>
                            patch({ expandedBackgroundImageUrl })
                          }
                          hint="Shown when chat is expanded on desktop. Falls back to portrait image if empty."
                        />
                      </div>
                      <Field label={`Background sharpness — ${theme.backgroundSharpness}%`}>
                        <div className="max-w-md space-y-2">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={theme.backgroundSharpness}
                            onChange={(e) => patch({ backgroundSharpness: Number(e.target.value) })}
                            className="h-2 w-full cursor-pointer accent-primary"
                          />
                          <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Soft blur</span>
                            <span>Sharp</span>
                          </div>
                        </div>
                      </Field>
                    </CardContent>
                  </Card>
                )}

                {activeSection === "content" && (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle>Empty state copy</CardTitle>
                        <CardDescription>
                          Welcome message shown before the user sends their first message.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <Field
                          label="Title"
                          hint={`${theme.emptyStateTitle.length} characters`}
                        >
                          <Input
                            value={theme.emptyStateTitle}
                            onChange={(e) => patch({ emptyStateTitle: e.target.value })}
                          />
                        </Field>
                        <Field
                          label="Subtitle"
                          hint={`${theme.emptyStateSubtitle.length} characters`}
                        >
                          <Textarea
                            value={theme.emptyStateSubtitle}
                            onChange={(e) => patch({ emptyStateSubtitle: e.target.value })}
                            rows={3}
                            className="resize-y"
                          />
                        </Field>
                      </CardContent>
                    </Card>

                    <ChatDesignSuggestedPromptsEditor
                      prompts={theme.suggestedPrompts}
                      accentColor={theme.accentColor}
                      onChange={(suggestedPrompts) => patch({ suggestedPrompts })}
                    />
                  </>
                )}

                <SectionFooterNav
                  prevSection={prevSection}
                  nextSection={nextSection}
                  onSectionChange={(id) => setActiveSection(id)}
                />
              </div>
            </div>
          </div>

          <div className="xl:sticky xl:top-32 xl:self-start">
            <ChatDesignPreview theme={theme} />
          </div>
        </div>
      </AdminPageShell>

      {isDirty && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 p-4 backdrop-blur-md xl:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">You have unsaved changes</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDiscardChanges}>
                Discard
              </Button>
              <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to defaults?</DialogTitle>
            <DialogDescription>
              This replaces all theme settings with Ovie defaults. You still need to save for changes
              to apply on the live chat page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleResetConfirm}>
              Reset defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SectionFooterNav({
  prevSection,
  nextSection,
  onSectionChange,
}: {
  prevSection: (typeof SECTION_DEFS)[number] | null;
  nextSection: (typeof SECTION_DEFS)[number] | null;
  onSectionChange: (id: SectionId) => void;
}) {
  if (!prevSection && !nextSection) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-5">
      {prevSection ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSectionChange(prevSection.id)}
        >
          <ArrowLeft className="size-4" />
          {prevSection.label}
        </Button>
      ) : (
        <span />
      )}
      {nextSection ? (
        <Button type="button" size="sm" onClick={() => onSectionChange(nextSection.id)}>
          {nextSection.label}
          <ArrowRight className="size-4" />
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}

function ColorGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {title ? (
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ChatDesignEditorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="mt-4 h-2 w-full max-w-md rounded-full" />
      </div>
      <div className="flex flex-col gap-8 xl:flex-row">
        <div className="hidden lg:block">
          <Skeleton className="h-72 w-56 rounded-xl" />
        </div>
        <div className="flex-1 space-y-4">
          <Skeleton className="h-11 w-full rounded-xl lg:hidden" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <Skeleton className="h-[580px] w-full max-w-[360px] rounded-2xl xl:shrink-0" />
      </div>
    </div>
  );
}
