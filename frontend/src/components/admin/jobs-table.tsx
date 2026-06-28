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
import {
  formatScrapeJobStatus,
  scrapeJobStatusVariant,
  statCellClass,
} from "@/lib/scrape-stats-display";
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

function StatCell({ value, stat }: { value: number; stat: "checked" | "new" | "updated" | "unchanged" | "failed" }) {
  return (
    <TableCell
      className={cn("text-right tabular-nums", statCellClass(stat, value))}
      title={
        stat === "checked"
          ? "Products processed"
          : stat === "new"
            ? "New catalog rows"
            : stat === "updated"
              ? "Products with changes"
              : stat === "unchanged"
                ? "No change since last check"
                : "Failed pages or writes"
      }
    >
      {value}
    </TableCell>
  );
}

export function JobsTable(props: JobsTableProps) {
  if (props.variant === "scrape") {
    const { jobs, selectedJobId, onSelectJob } = props;

    if (jobs.length === 0) {
      return (
        <AdminTableCard>
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-[var(--admin-foreground)]">No scrape jobs yet</p>
            <p className="mt-1 text-xs text-[var(--admin-muted)]">
              Jobs appear here after manual or scheduled refreshes run.
            </p>
          </div>
        </AdminTableCard>
      );
    }

    return (
      <AdminTableCard>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[var(--admin-muted)]">Started</TableHead>
              <TableHead className="text-[var(--admin-muted)]">Supplier</TableHead>
              <TableHead className="text-[var(--admin-muted)]">Type</TableHead>
              <TableHead className="text-[var(--admin-muted)]">Status</TableHead>
              <TableHead className="text-right text-[var(--admin-muted)]" title="Products processed this run">
                Checked
              </TableHead>
              <TableHead className="text-right text-[var(--admin-muted)]" title="New rows added">
                New
              </TableHead>
              <TableHead className="text-right text-[var(--admin-muted)]" title="Existing products updated">
                Updated
              </TableHead>
              <TableHead className="text-right text-[var(--admin-muted)]" title="No change detected">
                Same
              </TableHead>
              <TableHead className="text-right text-[var(--admin-muted)]" title="Errors">
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
                  "hover:bg-[var(--admin-bg)]/70",
                )}
                onClick={() => onSelectJob?.(job.id)}
              >
                <TableCell className="whitespace-nowrap text-xs">{job.startedAt}</TableCell>
                <TableCell className="font-medium">{job.supplier}</TableCell>
                <TableCell className="capitalize text-xs text-[var(--admin-muted)]">{job.type}</TableCell>
                <TableCell>
                  <Badge variant={scrapeJobStatusVariant(job.status)}>
                    {formatScrapeJobStatus(job.status)}
                  </Badge>
                </TableCell>
                <StatCell value={job.found} stat="checked" />
                <StatCell value={job.created} stat="new" />
                <StatCell value={job.updated} stat="updated" />
                <StatCell value={job.unchanged} stat="unchanged" />
                <StatCell value={job.failed} stat="failed" />
                <TableCell className="whitespace-nowrap text-xs text-[var(--admin-muted)]">
                  {job.duration}
                </TableCell>
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
            <TableHead className="text-right text-[var(--admin-muted)]">Products</TableHead>
            <TableHead className="text-[var(--admin-muted)]">Status</TableHead>
            <TableHead className="text-right text-[var(--admin-muted)]">Changed</TableHead>
            <TableHead className="text-[var(--admin-muted)]">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.jobs.map((job) => (
            <TableRow key={job.id} className="hover:bg-[var(--admin-bg)]/70">
              <TableCell>{job.startedAt}</TableCell>
              <TableCell className="text-right tabular-nums">{job.productCount}</TableCell>
              <TableCell>
                <Badge variant={job.status === "failed" ? "destructive" : "secondary"}>
                  {job.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{job.changedCount}</TableCell>
              <TableCell>{job.duration}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AdminTableCard>
  );
}
