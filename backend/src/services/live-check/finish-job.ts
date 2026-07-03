import { supabase } from "../../lib/supabase.js";
import type { LiveCheckSummary } from "./types.js";

export async function finishLiveCheckJob(
  jobId: string,
  summary: LiveCheckSummary,
  total: number,
  method: "adapter" | "ai" = "adapter",
): Promise<void> {
  const status =
    summary.failed === total
      ? "failed"
      : summary.failed > 0
        ? "partial"
        : "success";

  await supabase
    .from("live_check_jobs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      result_summary: { ...summary, total, method },
    })
    .eq("id", jobId);
}
