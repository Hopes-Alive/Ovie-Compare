import { supabase } from "../../lib/supabase.js";

export type ScrapeLogLevel = "info" | "success" | "warn" | "error";

export type ScrapeLogEntry = {
  id: string;
  scrape_job_id: string;
  level: ScrapeLogLevel;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function appendScrapeLog(
  jobId: string,
  level: ScrapeLogLevel,
  message: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabase.from("scrape_job_logs").insert({
    scrape_job_id: jobId,
    level,
    message,
    metadata,
  });
  if (error) {
    console.error("[scrape-log] insert failed:", error.message);
  }
}

export async function getScrapeLogs(params: {
  jobIds: string[];
  after?: string;
  limit?: number;
}): Promise<ScrapeLogEntry[]> {
  if (params.jobIds.length === 0) return [];

  let query = supabase
    .from("scrape_job_logs")
    .select("id, scrape_job_id, level, message, metadata, created_at")
    .in("scrape_job_id", params.jobIds)
    .order("created_at", { ascending: true })
    .limit(params.limit ?? 500);

  if (params.after) {
    query = query.gt("created_at", params.after);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load scrape logs: ${error.message}`);
  return (data ?? []) as ScrapeLogEntry[];
}
