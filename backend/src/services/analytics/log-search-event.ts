import { supabase } from "../../lib/supabase.js";

export type LogSearchEventInput = {
  sessionId?: string;
  query: string;
  supplierIds?: string[];
  resultCount: number;
  latencyMs: number;
};

export async function logSearchEvent(input: LogSearchEventInput): Promise<void> {
  const query = input.query.trim();
  if (!query) return;

  const { error } = await supabase.from("search_events").insert({
    session_id: input.sessionId ?? null,
    query,
    supplier_ids: input.supplierIds?.length ? input.supplierIds : null,
    result_count: input.resultCount,
    latency_ms: input.latencyMs,
  });

  if (error) {
    console.error("[analytics] Failed to log search event:", error.message);
  }
}
