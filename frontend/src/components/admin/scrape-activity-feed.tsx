"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  ExternalLink,
  FolderOpen,
  ListFilter,
  Loader2,
  PackagePlus,
  Pencil,
  RefreshCw,
  Square,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildScrapeActivityState,
  createWaitingSupplierGroup,
  type ActivityEvent,
  type ActivityFieldChange,
  type ScrapeActivitySummary,
  type ScrapeLogLine,
  type SupplierActivityGroup,
} from "@/lib/scrape-log-parser";
import {
  aggregateScrapeSummaries,
  formatRunSummary,
  productsChecked,
  statMiniClass,
} from "@/lib/scrape-stats-display";
import { cn } from "@/lib/utils";
import type { SupplierSummary } from "@/types/admin";

type ScrapeActivityFeedProps = {
  logs: ScrapeLogLine[];
  running: boolean;
  suppliers: SupplierSummary[];
};

function isHighlightEvent(event: ActivityEvent): boolean {
  if (event.icon === "category" || event.icon === "phase" || event.icon === "start") return false;
  if (event.icon === "summary" && event.title === "Section up to date") return false;
  return true;
}

function EventIcon({ event }: { event: ActivityEvent }) {
  const className = "size-3.5 shrink-0";
  switch (event.icon) {
    case "added":
      return <PackagePlus className={cn(className, "text-emerald-600")} />;
    case "updated":
      return <Pencil className={cn(className, "text-sky-600")} />;
    case "category":
      return <FolderOpen className={cn(className, "text-[var(--admin-muted)]")} />;
    case "warning":
    case "cancel":
      return <AlertTriangle className={cn(className, "text-amber-600")} />;
    case "error":
      return <XCircle className={cn(className, "text-red-600")} />;
    case "done":
      return <CheckCircle2 className={cn(className, "text-emerald-600")} />;
    case "summary":
      return <CheckCircle2 className={cn(className, "text-emerald-500/80")} />;
    default:
      return <CircleDot className={cn(className, "text-[var(--admin-muted)]")} />;
  }
}

function levelBorder(level: ActivityEvent["level"]): string {
  switch (level) {
    case "success":
      return "border-l-emerald-500";
    case "warning":
      return "border-l-amber-500";
    case "error":
      return "border-l-red-500";
    default:
      return "border-l-[var(--admin-border)]";
  }
}

function MiniStat({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: number;
  tone: "checked" | "new" | "updated" | "unchanged" | "failed";
  title?: string;
}) {
  const displayTone = tone === "checked" ? "unchanged" : tone;
  return (
    <div className="text-center" title={title}>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums leading-none",
          tone === "checked"
            ? value > 0
              ? "text-[var(--admin-foreground)]"
              : "text-[var(--admin-muted)]"
            : statMiniClass(displayTone, value),
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-[var(--admin-muted)]">{label}</p>
    </div>
  );
}

function SupplierStatusBadge({
  status,
  isLive,
}: {
  status: SupplierActivityGroup["status"];
  isLive: boolean;
}) {
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200/80">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
        </span>
        Live
      </span>
    );
  }
  switch (status) {
    case "done":
      return (
        <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 hover:bg-emerald-50">
          Complete
        </Badge>
      );
    case "cancelled":
      return <Badge variant="outline">Stopped</Badge>;
    case "failed":
      return <Badge variant="destructive">Issues</Badge>;
    case "waiting":
      return <Badge variant="outline">Waiting</Badge>;
    default:
      return null;
  }
}

function FieldChanges({ changes }: { changes: ActivityFieldChange[] }) {
  if (changes.length === 0) return null;

  return (
    <ul className="mt-1 space-y-0.5">
      {changes.map((change) => (
        <li
          key={`${change.field}-${change.from}-${change.to}`}
          className="flex flex-wrap items-baseline gap-x-1 text-[10px] leading-relaxed"
        >
          <span className="font-medium text-[var(--admin-foreground)]">{change.label}:</span>
          <span className="text-[var(--admin-muted)] line-through decoration-[var(--admin-muted)]/50">
            {change.from}
          </span>
          <span className="text-[var(--admin-muted)]">→</span>
          <span className="font-medium text-emerald-700">{change.to}</span>
        </li>
      ))}
    </ul>
  );
}

function ActivityEventRow({ event }: { event: ActivityEvent }) {
  return (
    <li
      className={cn(
        "flex gap-2.5 rounded-md border border-[var(--admin-border)] border-l-[3px] bg-[var(--admin-bg)] px-2.5 py-2 transition-colors",
        levelBorder(event.level),
      )}
    >
      <div className="mt-0.5">
        <EventIcon event={event} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5">
          <p className="text-xs font-medium text-[var(--admin-foreground)]">{event.title}</p>
          <time className="shrink-0 text-[10px] tabular-nums text-[var(--admin-muted)]">
            {event.time}
          </time>
        </div>
        {event.detail && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--admin-muted)]">{event.detail}</p>
        )}
        {event.changes && event.changes.length > 0 && <FieldChanges changes={event.changes} />}
        {event.pageUrl && (
          <Button asChild variant="outline" size="sm" className="mt-1.5 h-6 gap-1 px-2 text-[10px]">
            <a href={event.pageUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-2.5" />
              {event.pageLinkLabel ?? "Open page"}
            </a>
          </Button>
        )}
      </div>
    </li>
  );
}

function GlobalSummaryBar({
  summary,
  running,
  wasCancelled,
  supplierCount,
}: {
  summary: ScrapeActivitySummary;
  running: boolean;
  wasCancelled: boolean;
  supplierCount: number;
}) {
  const checked = productsChecked(summary);
  const hasActivity = checked > 0 || summary.issues > 0 || summary.categoriesChecked > 0;

  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        running
          ? "border-amber-200 bg-gradient-to-r from-amber-50/90 to-[var(--admin-surface)]"
          : wasCancelled
            ? "border-amber-200/80 bg-amber-50/40"
            : "border-[var(--admin-border)] bg-[var(--admin-bg)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {running ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-amber-600" />
          ) : wasCancelled ? (
            <AlertTriangle className="size-4 shrink-0 text-amber-600" />
          ) : (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          )}
          <div>
            <p className="text-sm font-medium text-[var(--admin-foreground)]">
              {running
                ? `Scraping ${supplierCount} supplier${supplierCount === 1 ? "" : "s"} in parallel`
                : wasCancelled
                  ? "Scrape stopped — saved work kept"
                  : "Last scrape summary"}
            </p>
            <p className="text-xs text-[var(--admin-muted)]">
              {hasActivity ? formatRunSummary(summary) : "Waiting for first results…"}
              {summary.categoriesChecked > 0 && (
                <> · {summary.categoriesChecked} section{summary.categoriesChecked === 1 ? "" : "s"} scanned</>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-4 sm:gap-5">
          <MiniStat label="Checked" value={checked} tone="checked" title="Products processed this run" />
          <MiniStat label="New" value={summary.added} tone="new" title="New rows added to the catalog" />
          <MiniStat label="Updated" value={summary.updated} tone="updated" title="Existing products with changes" />
          <MiniStat label="Same" value={summary.unchanged} tone="unchanged" title="No change since last check" />
          <MiniStat label="Issues" value={summary.issues} tone="failed" title="Failed pages or write errors" />
        </div>
      </div>
    </div>
  );
}

function SupplierLiveBox({
  group,
  isLive,
  compact,
}: {
  group: SupplierActivityGroup;
  isLive: boolean;
  compact: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { summary } = group;
  const checked = productsChecked(summary);

  const visibleEvents = useMemo(
    () => (compact ? group.events.filter(isHighlightEvent) : group.events),
    [compact, group.events],
  );

  const hiddenCount = group.events.length - visibleEvents.length;

  useEffect(() => {
    if (isLive && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleEvents.length, isLive]);

  return (
    <article
      className={cn(
        "flex h-[26rem] flex-col overflow-hidden rounded-xl border bg-[var(--admin-surface)] shadow-sm",
        isLive
          ? "border-amber-200/80 ring-2 ring-amber-400/20"
          : "border-[var(--admin-border)]",
      )}
    >
      <header
        className={cn(
          "shrink-0 border-b px-3 py-3",
          isLive
            ? "border-amber-200/60 bg-gradient-to-r from-amber-50/80 to-[var(--admin-surface)]"
            : "border-[var(--admin-border)] bg-[var(--admin-surface)]",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h5 className="truncate text-sm font-semibold text-[var(--admin-foreground)]">{group.name}</h5>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--admin-muted)]">
              {group.headline}
            </p>
          </div>
          <SupplierStatusBadge status={group.status} isLive={isLive} />
        </div>
        <div className="mt-2.5 grid grid-cols-5 gap-0.5 rounded-lg bg-[var(--admin-bg)]/80 px-1.5 py-2 ring-1 ring-[var(--admin-border)]/60">
          <MiniStat label="Checked" value={checked} tone="checked" />
          <MiniStat label="New" value={summary.added} tone="new" />
          <MiniStat label="Updated" value={summary.updated} tone="updated" />
          <MiniStat label="Same" value={summary.unchanged} tone="unchanged" />
          <MiniStat label="Issues" value={summary.issues} tone="failed" />
        </div>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth p-2"
      >
        {visibleEvents.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-3 text-center">
            {isLive ? (
              <>
                <Loader2 className="size-5 animate-spin text-amber-600" />
                <p className="mt-2 text-xs font-medium text-[var(--admin-foreground)]">Starting scrape…</p>
                <p className="mt-1 text-[11px] text-[var(--admin-muted)]">Catalog sections appear here as they run</p>
              </>
            ) : compact && group.events.length > 0 ? (
              <p className="text-xs text-[var(--admin-muted)]">
                {hiddenCount} step{hiddenCount === 1 ? "" : "s"} hidden — switch to All activity
              </p>
            ) : (
              <p className="text-xs text-[var(--admin-muted)]">No activity for this supplier yet.</p>
            )}
          </div>
        ) : (
          <>
            {compact && hiddenCount > 0 && (
              <p className="mb-2 px-1 text-[10px] text-[var(--admin-muted)]">
                {hiddenCount} catalog step{hiddenCount === 1 ? "" : "s"} hidden
              </p>
            )}
            <ol className="space-y-1.5">
              {visibleEvents.map((event) => (
                <ActivityEventRow key={event.id} event={event} />
              ))}
            </ol>
          </>
        )}
      </div>
    </article>
  );
}

export function ScrapeActivityFeed({ logs, running, suppliers }: ScrapeActivityFeedProps) {
  const [compact, setCompact] = useState(true);

  const nameBySlug = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [s.slug, s.name])),
    [suppliers],
  );

  const websiteBySlug = useMemo(
    () => Object.fromEntries(suppliers.map((s) => [s.slug, s.websiteUrl])),
    [suppliers],
  );

  const state = useMemo(
    () => buildScrapeActivityState(logs, nameBySlug, websiteBySlug),
    [logs, nameBySlug, websiteBySlug],
  );

  const scrapeSuppliers = useMemo(
    () => suppliers.filter((s) => s.scrapeEnabled && s.status === "active"),
    [suppliers],
  );

  const supplierGroups = useMemo(() => {
    const bySlug = new Map(state.groups.map((g) => [g.slug, g]));
    return scrapeSuppliers.map((supplier) => {
      const existing = bySlug.get(supplier.slug);
      if (existing) return existing;
      if (running) {
        return {
          ...createWaitingSupplierGroup(supplier.slug, supplier.name),
          status: "running" as const,
          headline: "Queued — starting soon…",
        };
      }
      return createWaitingSupplierGroup(supplier.slug, supplier.name);
    });
  }, [scrapeSuppliers, state.groups, running]);

  const totalSummary = useMemo(
    () => aggregateScrapeSummaries(supplierGroups.map((g) => g.summary)),
    [supplierGroups],
  );

  const empty = logs.length === 0 && !running;
  const anyLive = running && supplierGroups.some((g) => g.status === "running");

  return (
    <div className="space-y-4">
      {!empty && (
        <GlobalSummaryBar
          summary={totalSummary}
          running={running}
          wasCancelled={state.wasCancelled}
          supplierCount={supplierGroups.length}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--admin-muted)]">
          {empty
            ? "Run a scrape to watch each supplier update in its own panel."
            : running
              ? "Updates stream in every few seconds while suppliers run in parallel."
              : state.wasCancelled
                ? "Partial results were saved to the catalog."
                : "Per-supplier breakdown from the last run."}
        </p>
        {!empty && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setCompact((v) => !v)}
          >
            <ListFilter className="size-3" />
            {compact ? "Changes only" : "All activity"}
          </Button>
        )}
      </div>

      {state.globalEvents.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <ol className="space-y-1.5">
            {state.globalEvents.map((event) => (
              <ActivityEventRow key={event.id} event={event} />
            ))}
          </ol>
        </div>
      )}

      {empty ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-bg)]/50 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-[var(--admin-surface)] ring-1 ring-[var(--admin-border)]">
            <RefreshCw className="size-5 text-[var(--admin-muted)]" strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--admin-foreground)]">No scrape activity yet</p>
            <p className="max-w-sm text-xs leading-relaxed text-[var(--admin-muted)]">
              Press <strong>Run scrape now</strong> above. Each supplier gets a live panel showing new products,
              price updates, and any issues — in plain language, not raw logs.
            </p>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            supplierGroups.length > 1 ? "md:grid-cols-2" : "grid-cols-1",
          )}
        >
          {supplierGroups.map((group) => {
            const isLive =
              running &&
              group.status !== "done" &&
              group.status !== "cancelled" &&
              group.status !== "failed";
            return (
              <SupplierLiveBox key={group.slug} group={group} isLive={isLive} compact={compact} />
            );
          })}
        </div>
      )}

      {anyLive && (
        <p className="rounded-md bg-[var(--admin-bg)] px-3 py-2 text-[11px] leading-relaxed text-[var(--admin-muted)]">
          <Square className="mr-1 inline size-3 align-text-bottom" />
          Cancel stops both suppliers after the current page finishes — progress already saved stays in the
          catalog.
        </p>
      )}
    </div>
  );
}
