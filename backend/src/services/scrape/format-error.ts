/** Serialize scrape errors for logs (Playwright, Supabase, plain objects). */
export function formatScrapeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string" && o.message) return o.message;
    if (typeof o.details === "string" && o.details) return o.details;
    if (typeof o.hint === "string" && o.hint) return o.hint;
    if (typeof o.code === "string") return o.code;
  }
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
