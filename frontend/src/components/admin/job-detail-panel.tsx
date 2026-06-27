"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminTableCard } from "@/components/admin/shell/admin-table-card";
import { mockScrapeJobItems } from "@/data/mock/admin";
import type { ScrapeJobItem } from "@/types/admin";

type JobDetailPanelProps = {
  jobId: string | null;
  jobLabel?: string;
};

export function JobDetailPanel({ jobId, jobLabel }: JobDetailPanelProps) {
  if (!jobId) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--admin-border)] px-4 py-8 text-center text-sm text-[var(--admin-muted)]">
        Select a scrape job with failures to view per-URL details.
      </div>
    );
  }

  const items: ScrapeJobItem[] = mockScrapeJobItems[jobId] ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--admin-border)] px-4 py-6 text-sm text-[var(--admin-muted)]">
        No item-level detail available for this job yet.
      </div>
    );
  }

  return (
    <AdminTableCard>
      {jobLabel && (
        <div className="border-b border-[var(--admin-border)] px-4 py-3">
          <p className="text-[14px] font-medium text-[var(--admin-foreground)]">
            {jobLabel}
          </p>
          <p className="text-[12px] text-[var(--admin-muted)]">
            Per-URL scrape results
          </p>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-[var(--admin-muted)]">URL</TableHead>
            <TableHead className="text-[var(--admin-muted)]">Status</TableHead>
            <TableHead className="text-[var(--admin-muted)]">Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} className="hover:bg-[var(--admin-bg)]/70">
              <TableCell className="max-w-xs truncate font-mono text-xs">
                {item.url}
              </TableCell>
              <TableCell>
                <Badge
                  variant={item.status === "success" ? "default" : "destructive"}
                >
                  {item.status}
                </Badge>
              </TableCell>
              <TableCell className="max-w-xs truncate text-xs text-[var(--admin-muted)]">
                {item.error ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminTableCard>
  );
}
