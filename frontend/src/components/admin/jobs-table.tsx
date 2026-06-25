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
  // TODO: replace with useAdminJobs()

  if (props.variant === "scrape") {
    const { jobs, selectedJobId, onSelectJob } = props;
    return (
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Found</TableHead>
              <TableHead className="text-right">Updated</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow
                key={job.id}
                className={cn(
                  onSelectJob && "cursor-pointer",
                  selectedJobId === job.id && "bg-muted/50"
                )}
                onClick={() => onSelectJob?.(job.id)}
              >
                <TableCell>{job.startedAt}</TableCell>
                <TableCell className="font-medium">{job.supplier}</TableCell>
                <TableCell className="capitalize">{job.type}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                </TableCell>
                <TableCell className="text-right">{job.found}</TableCell>
                <TableCell className="text-right">{job.updated}</TableCell>
                <TableCell className="text-right">{job.failed}</TableCell>
                <TableCell>{job.duration}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Started</TableHead>
            <TableHead className="text-right">Products</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Changed</TableHead>
            <TableHead>Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell>{job.startedAt}</TableCell>
              <TableCell className="text-right">{job.productCount}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
              </TableCell>
              <TableCell className="text-right">{job.changedCount}</TableCell>
              <TableCell>{job.duration}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
