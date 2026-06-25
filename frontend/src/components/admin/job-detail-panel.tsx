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
import { mockScrapeJobItems } from "@/data/mock/admin";
import type { ScrapeJobItem } from "@/types/admin";

type JobDetailPanelProps = {
  jobId: string | null;
  jobLabel?: string;
};

export function JobDetailPanel({ jobId, jobLabel }: JobDetailPanelProps) {
  // TODO: replace with GET /api/admin/jobs/:id/items
  if (!jobId) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        Select a scrape job with failures to view per-URL details.
      </div>
    );
  }

  const items: ScrapeJobItem[] = mockScrapeJobItems[jobId] ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        No item-level detail available for this job yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {jobLabel && (
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-medium">{jobLabel}</p>
          <p className="text-xs text-muted-foreground">
            Per-URL scrape results
          </p>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>URL</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
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
              <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                {item.error ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
