import type { Context } from "hono";

import { getAdminAnalytics } from "../services/analytics/get-analytics.js";

export async function getAdminAnalyticsHandler(c: Context) {
  try {
    const from = c.req.query("from") ?? undefined;
    const to = c.req.query("to") ?? undefined;
    const data = await getAdminAnalytics({ from, to });
    return c.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load analytics";
    return c.json({ error: message }, 500);
  }
}
