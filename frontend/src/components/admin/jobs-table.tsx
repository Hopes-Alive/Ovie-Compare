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
import { cn } from "@/lib/utils";
import type { LiveCheckJobSummary, ScrapeJobSummary } from "@/types/admin";

type JobsTableProps =
  | {
      variant: "scrape";
      jobs: ScrapeJobSummary[];
      selectedJobId?: string | null;
      onSelectJob?: (jobId: string) => void;
    }
  | {
      variant: "live-check";
      jobs: LiveCheckJobSummary[];
      selectedJobId?: never;
      onSelectJob?: never;
    };

function statusVariant(status: "completed" | "running" | "failed") {
  switch (status) {
    case "completed":
      return "default" as const;
    case "running":
      return "secondary" as const;
    case "failed":
      return "destructive" as const;
  }
}

export function JobsTable(props: JobsTableProps) {
  if (props.variant === "scrape") {
    const { jobs, selectedJobId, onSelectJob } = props;
    return (
      <AdminTableCard>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[var(--admin-muted)]">Started</TableHead>
              <TableHead className="text-[var(--admin-muted)]">Supplier</TableHead>
              <TableHead className="text-[var(--admin-muted)]">Type</TableHead>
              <TableHead className="text-[var(--admin-muted)]">Status</TableHead>
              <TableHead className="text-right text-[var(--admin-muted)]">
                Found
              </TableHead>
              <TableHead className="text-right text-[var(--admin-muted)]">
                Updated
              </TableHead>
              <TableHead className="text-right text-[var(--admin-muted)]">
                Failed
              </TableHead>
              <TableHead className="text-[var(--admin-muted)]">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow
                key={job.id}
                className={cn(
                  onSelectJob && "cursor-pointer",
                  selectedJobId === job.id && "bg-[var(--admin-sidebar-muted)]",
                  "hover:bg-[var(--admin-bg)]/70"
                )}
                onClick={() => onSelectJob?.(job.id)}
              >
                <TableCell>{job.startedAt}</TableCell>
                <TableCell className="font-medium">{job.supplier}</TableCell>
                <TableCell className="capitalize">{job.type}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{job.found}</TableCell>
                <TableCell className="text-right tabular-nums">{job.updated}</TableCell>
                <TableCell className="text-right tabular-nums">{job.failed}</TableCell>
                <TableCell>{job.duration}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AdminTableCard>
    );
  }

  return (
    <AdminTableCard>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-[var(--admin-muted)]">Started</TableHead>
            <TableHead className="text-right text-[var(--admin-muted)]">
              Products
            </TableHead>
            <TableHead className="text-[var(--admin-muted)]">Status</TableHead>
            <TableHead className="text-right text-[var(--admin-muted)]">
              Changed
            </TableHead>
            <TableHead className="text-[var(--admin-muted)]">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.jobs.map((job) => (
            <TableRow key={job.id} className="hover:bg-[var(--admin-bg)]/70">
              <TableCell>{job.startedAt}</TableCell>
              <TableCell className="text-right tabular-nums">
                {job.productCount}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {job.changedCount}
              </TableCell>
              <TableCell>{job.duration}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminTableCard>
  );
}
