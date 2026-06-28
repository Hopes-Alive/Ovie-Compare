"use client";

import { Clock, Loader2, Play, Square, Timer } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ScrapeActivityFeed } from "@/components/admin/scrape-activity-feed";
import { AdminPanel } from "@/components/admin/shell/admin-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/config/routes";
import type { ScrapeLogLine } from "@/lib/scrape-log-parser";
import { cn } from "@/lib/utils";
import type { SupplierSummary } from "@/types/admin";

const INTERVAL_PRESETS = [
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
  { label: "6h", minutes: 360 },
  { label: "12h", minutes: 720 },
  { label: "24h", minutes: 1440 },
] as const;

type ScrapeControlPanelProps = {
  suppliers: SupplierSummary[];
  scrapeRunning: boolean;
  onSuppliersChange: (suppliers: SupplierSummary[]) => void;
  onRunningChange: (running: boolean) => void;
};

function formatLastScrape(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 2) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function supplierInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function ScrapeStatusStrip({ running }: { running: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5",
        running
          ? "border-amber-200 bg-amber-50/80"
          : "border-[var(--admin-border)] bg-[var(--admin-bg)]",
      )}
    >
      {running ? (
        <>
          <span className="relative flex size-2.5 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900">Scrape in progress</p>
            <p className="text-xs text-amber-800/80">
              Suppliers run in parallel. Live panels update below.
            </p>
          </div>
          <Loader2 className="size-4 shrink-0 animate-spin text-amber-600" />
        </>
      ) : (
        <>
          <Clock className="size-4 shrink-0 text-[var(--admin-muted)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--admin-foreground)]">Ready to scrape</p>
            <p className="text-xs text-[var(--admin-muted)]">
              Manual run now, or wait for the next scheduled refresh per supplier.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function SupplierScheduleCard({
  supplier,
  scrapeRunning,
  customMinutes,
  onCustomChange,
  onSaveInterval,
}: {
  supplier: SupplierSummary;
  scrapeRunning: boolean;
  customMinutes: number;
  onCustomChange: (minutes: number) => void;
  onSaveInterval: (minutes: number) => void;
}) {
  return (
    <article className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-bg)]/40 p-3.5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-surface)] text-sm font-semibold text-[var(--admin-foreground)] ring-1 ring-[var(--admin-border)]">
          {supplierInitial(supplier.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--admin-foreground)]">{supplier.name}</p>
          <p className="mt-0.5 text-xs text-[var(--admin-muted)]">
            {supplier.productCount.toLocaleString()} products in catalog
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-[var(--admin-surface)] px-2.5 py-2 ring-1 ring-[var(--admin-border)]/70">
          <dt className="text-[var(--admin-muted)]">Last refresh</dt>
          <dd className="mt-0.5 font-medium text-[var(--admin-foreground)]">
            {formatLastScrape(supplier.lastScheduledRefreshAt)}
          </dd>
        </div>
        <div className="rounded-md bg-[var(--admin-surface)] px-2.5 py-2 ring-1 ring-[var(--admin-border)]/70">
          <dt className="text-[var(--admin-muted)]">Next scheduled</dt>
          <dd className="mt-0.5 font-medium text-[var(--admin-foreground)]">
            {scrapeRunning ? "After current run" : (supplier.nextRefreshIn ?? "—")}
          </dd>
        </div>
      </dl>

      <div className="mt-3">
        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-[var(--admin-muted)]">
          <Timer className="size-3" />
          Refresh every
        </p>
        <div className="flex flex-wrap gap-1">
          {INTERVAL_PRESETS.map((preset) => {
            const selected = supplier.refreshIntervalMinutes === preset.minutes;
            return (
              <Button
                key={preset.minutes}
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                disabled={scrapeRunning}
                className={cn("h-7 min-w-[2.25rem] px-2 text-xs", selected && "shadow-sm")}
                onClick={() => onSaveInterval(preset.minutes)}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="mt-2.5 flex items-end gap-2">
        <div className="flex-1">
          <Label htmlFor={`interval-${supplier.id}`} className="sr-only">
            Custom interval minutes
          </Label>
          <Input
            id={`interval-${supplier.id}`}
            type="number"
            min={15}
            max={10080}
            value={customMinutes}
            disabled={scrapeRunning}
            className="h-8 text-xs"
            onChange={(e) => onCustomChange(Number(e.target.value))}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 shrink-0"
          disabled={scrapeRunning || customMinutes < 15 || customMinutes > 10080}
          onClick={() => onSaveInterval(customMinutes)}
        >
          Set minutes
        </Button>
      </div>
    </article>
  );
}

export function ScrapeControlPanel({
  suppliers,
  scrapeRunning,
  onSuppliersChange,
  onRunningChange,
}: ScrapeControlPanelProps) {
  const [logs, setLogs] = useState<ScrapeLogLine[]>([]);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customIntervals, setCustomIntervals] = useState<Record<string, number>>({});
  const lastLogAtRef = useRef<string | undefined>(undefined);
  const jobIdsRef = useRef<string[]>([]);

  useEffect(() => {
    jobIdsRef.current = jobIds;
  }, [jobIds]);

  const poll = useCallback(async () => {
    try {
      const overviewRes = await fetch("/api/admin/overview");
      const overview = (await overviewRes.json()) as {
        scrape?: { running: boolean; jobIds?: string[] };
        suppliers?: SupplierSummary[];
      };

      if (overview.suppliers) onSuppliersChange(overview.suppliers);
      const running = overview.scrape?.running ?? false;
      onRunningChange(running);

      const activeJobIds = overview.scrape?.jobIds ?? [];
      if (activeJobIds.length > 0) {
        setJobIds((prev) => {
          const merged = [...new Set([...prev, ...activeJobIds])];
          jobIdsRef.current = merged;
          return merged;
        });
      }

      const ids =
        activeJobIds.length > 0
          ? activeJobIds
          : jobIdsRef.current.length > 0
            ? jobIdsRef.current
            : [];

      if (ids.length === 0) return;

      const qs = new URLSearchParams({ jobIds: ids.join(",") });
      if (lastLogAtRef.current) qs.set("after", lastLogAtRef.current);

      const logsRes = await fetch(`/api/admin/scrape/logs?${qs}`);
      const logsData = (await logsRes.json()) as { logs?: ScrapeLogLine[] };

      if (logsData.logs && logsData.logs.length > 0) {
        setLogs((prev) => {
          const seen = new Set(prev.map((l) => l.id));
          const next = [...prev];
          for (const line of logsData.logs!) {
            if (!seen.has(line.id)) next.push(line);
          }
          return next;
        });
        lastLogAtRef.current = logsData.logs[logsData.logs.length - 1]!.created_at;
      }
    } catch {
      /* ignore poll errors */
    }
  }, [onRunningChange, onSuppliersChange]);

  useEffect(() => {
    void poll();
    const id = setInterval(() => void poll(), scrapeRunning ? 2000 : 8000);
    return () => clearInterval(id);
  }, [poll, scrapeRunning]);

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/scrape", { method: "POST" });
      const data = (await res.json()) as {
        started?: boolean;
        message?: string;
        status?: { jobIds?: string[] };
      };
      if (!res.ok || !data.started) {
        setError(data.message ?? "Could not start scrape");
        return;
      }
      setLogs([]);
      lastLogAtRef.current = undefined;
      setJobIds(data.status?.jobIds ?? []);
      onRunningChange(true);
      void poll();
    } catch {
      setError("Failed to start scrape");
    } finally {
      setStarting(false);
    }
  }

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      await fetch("/api/admin/scrape", { method: "DELETE" });
      void poll();
    } catch {
      setError("Failed to cancel scrape");
    } finally {
      setCancelling(false);
    }
  }

  async function saveInterval(supplier: SupplierSummary, minutes: number) {
    if (scrapeRunning) return;
    try {
      const res = await fetch(`/api/admin/suppliers/${supplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_interval_minutes: minutes }),
      });
      const data = (await res.json()) as { supplier?: SupplierSummary };
      if (data.supplier) {
        onSuppliersChange(
          suppliers.map((s) => (s.id === data.supplier!.id ? data.supplier! : s)),
        );
        setCustomIntervals((prev) => ({ ...prev, [supplier.id]: minutes }));
      }
    } catch {
      setError(`Failed to update interval for ${supplier.name}`);
    }
  }

  const activeSuppliers = suppliers.filter((s) => s.scrapeEnabled && s.status === "active");

  return (
    <div className="space-y-5">
      <AdminPanel
        title="Scheduled scraping"
        description="Start a manual refresh or set how often each supplier auto-updates."
        action={
          <Link
            href={ROUTES.admin.jobs}
            className="text-xs font-medium text-[var(--admin-secondary)] hover:text-[var(--admin-foreground)]"
          >
            View job history →
          </Link>
        }
        contentClassName="p-4"
      >
        <div className="space-y-4">
          <ScrapeStatusStrip running={scrapeRunning} />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={scrapeRunning || starting}
              onClick={() => void handleStart()}
              className="min-w-[8.5rem]"
            >
              {starting ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Play data-icon="inline-start" className="size-3.5" />
              )}
              Run scrape now
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!scrapeRunning || cancelling}
              onClick={() => void handleCancel()}
            >
              {cancelling ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Square data-icon="inline-start" className="size-3.5" />
              )}
              Stop scrape
            </Button>
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-medium text-[var(--admin-muted)]">
              Auto-refresh schedule
              {scrapeRunning && (
                <span className="ml-1 font-normal">(locked while scraping)</span>
              )}
            </Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {activeSuppliers.map((supplier) => (
                <SupplierScheduleCard
                  key={supplier.id}
                  supplier={supplier}
                  scrapeRunning={scrapeRunning}
                  customMinutes={customIntervals[supplier.id] ?? supplier.refreshIntervalMinutes}
                  onCustomChange={(minutes) =>
                    setCustomIntervals((prev) => ({ ...prev, [supplier.id]: minutes }))
                  }
                  onSaveInterval={(minutes) => void saveInterval(supplier, minutes)}
                />
              ))}
            </div>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel
        title="Live scraping"
        description="Human-readable progress — new, updated, and unchanged counts per supplier."
        contentClassName="p-4"
      >
        <ScrapeActivityFeed logs={logs} running={scrapeRunning} suppliers={suppliers} />
      </AdminPanel>
    </div>
  );
}
