import { supabase } from "../../lib/supabase.js";
import type { ScrapeStats } from "../../types/scraper.js";
import { appendScrapeLog } from "./scrape-log.js";

const EMPTY_STATS: ScrapeStats = {
  found: 0,
  created: 0,
  updated: 0,
  unchanged: 0,
  failed: 0,
};

export type ScrapeJobType = "full_seed" | "category_seed" | "refresh" | "search_seed";
export type ScrapeJobTriggeredBy = "scheduler" | "admin" | "system" | "script";

export async function createScrapeJob(params: {
  supplierId: string;
  jobType: ScrapeJobType;
  triggeredBy: ScrapeJobTriggeredBy;
  category?: string;
  query?: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("scrape_jobs")
    .insert({
      supplier_id: params.supplierId,
      job_type: params.jobType,
      status: "running",
      triggered_by: params.triggeredBy,
      category: params.category ?? null,
      query: params.query ?? null,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Could not create scrape_job: ${error?.message ?? "unknown"}`);
  }

  return data.id as string;
}

export async function finishScrapeJob(
  jobId: string,
  stats: ScrapeStats,
  errorMessage?: string,
  statusOverride?: "success" | "failed" | "partial",
): Promise<void> {
  const status =
    statusOverride ??
    (errorMessage != null
      ? "failed"
      : stats.failed > 0 && stats.created + stats.updated + stats.unchanged === 0
        ? "failed"
        : stats.failed > 0
          ? "partial"
          : "success");

  await supabase
    .from("scrape_jobs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      stats,
      error_message: errorMessage ?? null,
      cancel_requested: false,
    })
    .eq("id", jobId);
}

export async function failScrapeJob(jobId: string, errorMessage: string): Promise<void> {
  await supabase
    .from("scrape_jobs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("id", jobId);
}

/**
 * True while ANY scrape job — admin/scheduled `refresh` or a one-off seed
 * script (`category_seed`/`full_seed`/`search_seed`, e.g. `npm run seed:*`)
 * — is running for this supplier. Seed scripts don't honour `cancel_requested`
 * and use their own Playwright browser, so starting an admin/scheduled
 * refresh at the same time doubles site traffic and interleaves writes to
 * `supplier_products` — this guard keeps admin refresh from racing them.
 */
export async function hasActiveScrapeJob(supplierId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("scrape_jobs")
    .select("id")
    .eq("supplier_id", supplierId)
    .in("job_type", ["refresh", "category_seed", "full_seed", "search_seed"])
    .eq("status", "running")
    .limit(1);

  if (error) throw new Error(`Failed to check active scrape jobs: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export type RunningRefreshJob = {
  id: string;
  supplier_id: string;
  supplier_slug: string;
  supplier_name: string;
  started_at: string | null;
  cancel_requested: boolean;
};

export async function getRunningRefreshJobs(): Promise<RunningRefreshJob[]> {
  const { data, error } = await supabase
    .from("scrape_jobs")
    .select("id, supplier_id, started_at, cancel_requested, suppliers!inner(slug, name)")
    .eq("job_type", "refresh")
    .eq("status", "running")
    .order("started_at", { ascending: true });

  if (error) throw new Error(`Failed to load running jobs: ${error.message}`);

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const sup = row.suppliers as { slug: string; name: string };
    return {
      id: row.id as string,
      supplier_id: row.supplier_id as string,
      supplier_slug: sup.slug,
      supplier_name: sup.name,
      started_at: row.started_at as string | null,
      cancel_requested: Boolean(row.cancel_requested),
    };
  });
}

export async function isJobCancelRequested(jobId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("scrape_jobs")
    .select("cancel_requested")
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw new Error(`Failed to check cancel flag: ${error.message}`);
  return Boolean((data as { cancel_requested?: boolean } | null)?.cancel_requested);
}

export async function requestCancelRunningRefreshJobs(): Promise<number> {
  const { data, error } = await supabase
    .from("scrape_jobs")
    .update({ cancel_requested: true })
    .eq("job_type", "refresh")
    .eq("status", "running")
    .select("id");

  if (error) throw new Error(`Failed to request cancel: ${error.message}`);
  return data?.length ?? 0;
}

/** Finish jobs stuck in `running` after a crash or when no worker picks up cancel. */
export async function reconcileOrphanedRunningJobs(inProcessRunning: boolean): Promise<void> {
  const jobs = await getRunningRefreshJobs();
  if (jobs.length === 0) return;

  const now = Date.now();
  const staleRunningMs = 12 * 60 * 60 * 1000;
  const staleCancelMs = 90_000;

  for (const job of jobs) {
    const startedAt = job.started_at ? new Date(job.started_at).getTime() : now;
    if (now - startedAt > staleRunningMs) {
      await finishScrapeJob(job.id, EMPTY_STATS, "Timed out (stale running job)", "partial");
      await appendScrapeLog(job.id, "warn", "Scrape marked stopped — job exceeded max runtime", {
        cancelled: true,
      });
      continue;
    }

    if (!job.cancel_requested || inProcessRunning) continue;

    const { data: lastLog } = await supabase
      .from("scrape_job_logs")
      .select("created_at")
      .eq("scrape_job_id", job.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastActivity = lastLog?.created_at
      ? new Date(lastLog.created_at as string).getTime()
      : startedAt;

    if (now - lastActivity < staleCancelMs) continue;

    await finishScrapeJob(job.id, EMPTY_STATS, "Cancelled — no active worker", "partial");
    await appendScrapeLog(job.id, "warn", "Scrape stopped — no worker responded to cancel", {
      cancelled: true,
    });
  }
}

export async function getSupplierIdBySlug(slug: string): Promise<string> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    throw new Error(`Supplier "${slug}" not found. Run the SQL migration first.`);
  }
  return data.id as string;
}
