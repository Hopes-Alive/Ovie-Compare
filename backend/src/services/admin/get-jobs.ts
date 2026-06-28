import { supabase } from "../../lib/supabase.js";
import { formatLastCheckedAgo } from "../brain/freshness.js";

export type AdminScrapeJobSummary = {
  id: string;
  startedAt: string;
  supplier: string;
  supplierSlug: string;
  type: "seed" | "refresh";
  status: "completed" | "running" | "failed" | "partial";
  found: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  duration: string;
};

export type AdminScrapeJobItem = {
  id: string;
  url: string;
  status: "success" | "failed" | "skipped";
  action?: "created" | "updated" | "unchanged" | "deactivated";
  error?: string;
};

function mapJobStatus(
  dbStatus: string,
): AdminScrapeJobSummary["status"] {
  switch (dbStatus) {
    case "success":
      return "completed";
    case "running":
      return "running";
    case "partial":
      return "partial";
    default:
      return "failed";
  }
}

function mapJobType(jobType: string): "seed" | "refresh" {
  if (jobType === "refresh") return "refresh";
  return "seed";
}

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const sec = Math.max(0, Math.floor((end - start) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

export async function getAdminScrapeJobs(limit = 50): Promise<AdminScrapeJobSummary[]> {
  const { data, error } = await supabase
    .from("scrape_jobs")
    .select(
      "id, job_type, status, stats, started_at, finished_at, created_at, suppliers!inner(slug, name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load scrape jobs: ${error.message}`);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const stats = (row.stats as Record<string, number>) ?? {};
    const supplier = row.suppliers as { slug: string; name: string };
    const startedAt = (row.started_at as string) ?? (row.created_at as string);
    return {
      id: row.id as string,
      startedAt: new Date(startedAt).toLocaleString("en-AU"),
      supplier: supplier.name,
      supplierSlug: supplier.slug,
      type: mapJobType(row.job_type as string),
      status: mapJobStatus(row.status as string),
      found: stats.found ?? 0,
      created: stats.created ?? 0,
      updated: stats.updated ?? 0,
      unchanged: stats.unchanged ?? 0,
      failed: stats.failed ?? 0,
      duration: formatDuration(startedAt, row.finished_at as string | null),
    };
  });
}

export async function getAdminScrapeJobItems(jobId: string): Promise<AdminScrapeJobItem[]> {
  const { data, error } = await supabase
    .from("scrape_job_items")
    .select("id, url, status, action, error_message")
    .eq("scrape_job_id", jobId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) throw new Error(`Failed to load job items: ${error.message}`);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    url: row.url as string,
    status: row.status as AdminScrapeJobItem["status"],
    action: row.action as AdminScrapeJobItem["action"],
    error: (row.error_message as string) ?? undefined,
  }));
}

export async function getAdminLiveCheckJobs(limit = 20) {
  const { data, error } = await supabase
    .from("live_check_jobs")
    .select("id, status, started_at, finished_at, created_at, result_summary")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load live check jobs: ${error.message}`);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const summary = (row.result_summary as Record<string, number>) ?? {};
    const startedAt = (row.started_at as string) ?? (row.created_at as string);
    return {
      id: row.id as string,
      startedAt: new Date(startedAt).toLocaleString("en-AU"),
      productCount: summary.total ?? summary.products ?? 0,
      status: mapJobStatus(row.status as string) as "completed" | "running" | "failed",
      changedCount: summary.changed ?? 0,
      duration: formatDuration(startedAt, row.finished_at as string | null),
    };
  });
}

// re-export for supplier last check formatting consistency
export { formatLastCheckedAgo };
