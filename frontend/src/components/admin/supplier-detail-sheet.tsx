"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SupplierSummary } from "@/types/admin";

const INTERVAL_PRESETS = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "3 hours", minutes: 180 },
  { label: "6 hours", minutes: 360 },
  { label: "12 hours", minutes: 720 },
  { label: "24 hours", minutes: 1440 },
] as const;

type SupplierDetailSheetProps = {
  supplier: SupplierSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (supplier: SupplierSummary) => void;
};

export function SupplierDetailSheet({
  supplier,
  open,
  onOpenChange,
  onUpdated,
}: SupplierDetailSheetProps) {
  const [intervalMinutes, setIntervalMinutes] = useState(supplier?.refreshIntervalMinutes ?? 360);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supplier) setIntervalMinutes(supplier.refreshIntervalMinutes);
  }, [supplier]);

  if (!supplier) return null;

  async function saveInterval(minutes: number) {
    if (!supplier) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_interval_minutes: minutes }),
      });
      const data = (await res.json()) as { supplier?: SupplierSummary; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      if (data.supplier) {
        setIntervalMinutes(data.supplier.refreshIntervalMinutes);
        onUpdated?.(data.supplier);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{supplier.name}</SheetTitle>
          <SheetDescription>Supplier configuration and scrape schedule</SheetDescription>
        </SheetHeader>
        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Website</dt>
            <dd className="mt-0.5">
              <a
                href={supplier.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline"
              >
                {supplier.websiteUrl}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Adapter key</dt>
            <dd className="mt-0.5 font-mono text-xs">{supplier.adapterKey}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="mt-1">
              <Badge>{supplier.status}</Badge>
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-muted-foreground">Products</dt>
              <dd className="mt-0.5 font-medium">{supplier.productCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Errors (24h)</dt>
              <dd className="mt-0.5 font-medium">{supplier.errors24h}</dd>
            </div>
          </div>
          <div className="space-y-2">
            <dt className="text-muted-foreground">Features</dt>
            <dd className="flex flex-wrap gap-2">
              <Badge variant={supplier.scrapeEnabled ? "default" : "secondary"}>
                Scrape {supplier.scrapeEnabled ? "enabled" : "disabled"}
              </Badge>
              <Badge
                variant={supplier.liveCheckEnabled ? "default" : "secondary"}
              >
                Live check {supplier.liveCheckEnabled ? "enabled" : "disabled"}
              </Badge>
            </dd>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-4">
            <div>
              <Label className="text-muted-foreground">Scheduled refresh interval</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Re-crawls all discovered categories and re-checks every product URL.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {INTERVAL_PRESETS.map((preset) => (
                <Button
                  key={preset.minutes}
                  type="button"
                  size="sm"
                  variant={
                    supplier.refreshIntervalMinutes === preset.minutes
                      ? "default"
                      : "outline"
                  }
                  disabled={saving}
                  onClick={() => {
                    setIntervalMinutes(preset.minutes);
                    void saveInterval(preset.minutes);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="custom-interval">Custom (minutes)</Label>
                <Input
                  id="custom-interval"
                  type="number"
                  min={15}
                  max={10080}
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={saving || intervalMinutes < 15 || intervalMinutes > 10080}
                onClick={() => void saveInterval(intervalMinutes)}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Last refresh</dt>
                <dd className="font-medium">{supplier.lastRefreshAgo}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Next refresh</dt>
                <dd className="font-medium">{supplier.nextRefreshIn ?? "—"}</dd>
              </div>
            </dl>
          </div>
        </dl>
      </SheetContent>
    </Sheet>
  );
}
