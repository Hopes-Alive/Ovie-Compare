"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminTableCard } from "@/components/admin/shell/admin-table-card";
import { cn } from "@/lib/utils";
import type { ScrapeJobItem } from "@/types/admin";

type JobDetailPanelProps = {
  jobId: string | null;
  jobLabel?: string;
};

type ActionFilter = "all" | "created" | "updated" | "unchanged" | "failed";

function actionBadge(action: ScrapeJobItem["action"], status: ScrapeJobItem["status"]) {
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        Failed
      </Badge>
    );
  }
  switch (action) {
    case "created":
      return (
        <Badge className="bg-emerald-100 text-[10px] text-emerald-800 hover:bg-emerald-100">
          New
        </Badge>
      );
    case "updated":
      return (
        <Badge className="bg-sky-100 text-[10px] text-sky-800 hover:bg-sky-100">
          Updated
        </Badge>
      );
    case "unchanged":
      return (
        <Badge variant="secondary" className="text-[10px]">
          Same
        </Badge>
      );
    default:
      return <Badge variant="outline">—</Badge>;
  }
}

function filterItems(items: ScrapeJobItem[], filter: ActionFilter): ScrapeJobItem[] {
  if (filter === "all") return items;
  if (filter === "failed") return items.filter((i) => i.status === "failed");
  return items.filter((i) => i.action === filter && i.status !== "failed");
}

export function JobDetailPanel({ jobId, jobLabel }: JobDetailPanelProps) {
  const [items, setItems] = useState<ScrapeJobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<ActionFilter>("all");

  useEffect(() => {
    if (!jobId) {
      setItems([]);
      return;
    }
    setLoading(true);
    fetch(`/api/admin/jobs/${jobId}/items`)
      .then((res) => res.json())
      .then((data: { items?: ScrapeJobItem[] }) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [jobId]);

  const counts = useMemo(
    () => ({
      all: items.length,
      created: items.filter((i) => i.action === "created").length,
      updated: items.filter((i) => i.action === "updated").length,
      unchanged: items.filter((i) => i.action === "unchanged").length,
      failed: items.filter((i) => i.status === "failed").length,
    }),
    [items],
  );

  const visible = useMemo(() => filterItems(items, filter), [items, filter]);

  if (!jobId) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--admin-border)] px-4 py-10 text-center">
        <p className="text-sm text-[var(--admin-muted)]">Select a scrape job to view per-URL results.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--admin-border)] px-4 py-6 text-sm text-[var(--admin-muted)]">
        Loading job details…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--admin-border)] px-4 py-6 text-sm text-[var(--admin-muted)]">
        No per-URL detail recorded for this job.
      </div>
    );
  }

  const filters: { key: ActionFilter; label: string }[] = [
    { key: "all", label: `All (${counts.all})` },
    { key: "created", label: `New (${counts.created})` },
    { key: "updated", label: `Updated (${counts.updated})` },
    { key: "unchanged", label: `Same (${counts.unchanged})` },
    { key: "failed", label: `Failed (${counts.failed})` },
  ];

  return (
    <AdminTableCard>
      {jobLabel && (
        <div className="border-b border-[var(--admin-border)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--admin-foreground)]">{jobLabel}</p>
          <p className="text-xs text-[var(--admin-muted)]">
            {items.length} URL{items.length === 1 ? "" : "s"} — filter by outcome
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {filters.map(({ key, label }) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={filter === key ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-[var(--admin-muted)]">Product URL</TableHead>
            <TableHead className="text-[var(--admin-muted)]">Outcome</TableHead>
            <TableHead className="text-[var(--admin-muted)]">Error</TableHead>
            <TableHead className="w-[4.5rem] text-[var(--admin-muted)]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-sm text-[var(--admin-muted)]">
                No items in this filter.
              </TableCell>
            </TableRow>
          ) : (
            visible.map((item) => (
              <TableRow key={item.id} className="hover:bg-[var(--admin-bg)]/70">
                <TableCell className="max-w-md truncate font-mono text-xs">{item.url}</TableCell>
                <TableCell>{actionBadge(item.action, item.status)}</TableCell>
                <TableCell
                  className={cn(
                    "max-w-xs truncate text-xs",
                    item.error ? "text-red-600" : "text-[var(--admin-muted)]",
                  )}
                >
                  {item.error ?? "—"}
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" title="Open product page">
                      <ExternalLink className="size-3.5" />
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </AdminTableCard>
  );
}
