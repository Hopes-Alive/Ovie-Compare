import type { Context } from "hono";
import {
  getAdminScrapeJobs,
  getAdminScrapeJobItems,
  getAdminLiveCheckJobs,
} from "../services/admin/get-jobs.js";

export async function getAdminJobsHandler(c: Context) {
  try {
    const [scrapeJobs, liveCheckJobs] = await Promise.all([
      getAdminScrapeJobs(),
      getAdminLiveCheckJobs(),
    ]);
    return c.json({ scrapeJobs, liveCheckJobs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load jobs";
    return c.json({ error: message }, 500);
  }
}

export async function getAdminJobItemsHandler(c: Context) {
  try {
    const jobId = c.req.param("id");
    if (!jobId) return c.json({ error: "Missing job id" }, 400);
    const items = await getAdminScrapeJobItems(jobId);
    return c.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load job items";
    return c.json({ error: message }, 500);
  }
}
