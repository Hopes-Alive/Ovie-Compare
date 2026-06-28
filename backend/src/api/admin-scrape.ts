import type { Context } from "hono";
import { supabase } from "../lib/supabase.js";
import { getScrapeStatus, startManualScrapeRun, cancelScrapeRun } from "../services/scrape/run-manager.js";
import { getScrapeLogs } from "../services/scrape/scrape-log.js";
import { getRunningRefreshJobs } from "../services/scrape/scrape-job.js";
import { getAdminSuppliers } from "../services/admin/get-suppliers.js";

export async function getAdminScrapeStatusHandler(c: Context) {
  try {
    const status = await getScrapeStatus();
    return c.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get scrape status";
    return c.json({ error: message }, 500);
  }
}

export async function postAdminScrapeStartHandler(c: Context) {
  try {
    const body = await c.req.json<{ categoryLimit?: number; categoryPageLimit?: number; urlLimit?: number; skipPassB?: boolean }>().catch(
      () => ({}),
    );
    const result = await startManualScrapeRun({
      categoryLimit: body.categoryLimit,
      categoryPageLimit: body.categoryPageLimit,
      urlLimit: body.urlLimit,
      skipPassB: body.skipPassB,
    });
    const status = await getScrapeStatus();
    return c.json({ ...result, status }, result.started ? 202 : 409);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start scrape";
    return c.json({ error: message }, 500);
  }
}

export async function postAdminScrapeCancelHandler(c: Context) {
  try {
    const result = await cancelScrapeRun();
    const status = await getScrapeStatus();
    return c.json({ ...result, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel scrape";
    return c.json({ error: message }, 500);
  }
}

export async function getAdminScrapeLogsHandler(c: Context) {
  try {
    const after = c.req.query("after") ?? undefined;
    let jobIds = c.req.query("jobIds")?.split(",").filter(Boolean) ?? [];

    if (jobIds.length === 0) {
      const running = await getRunningRefreshJobs();
      if (running.length > 0) {
        jobIds = running.map((j) => j.id);
      } else {
        const { data: recent } = await supabase
          .from("scrape_jobs")
          .select("id")
          .eq("job_type", "refresh")
          .order("created_at", { ascending: false })
          .limit(3);
        jobIds = (recent ?? []).map((r) => r.id as string);
      }
    }

    const logs = await getScrapeLogs({ jobIds, after, limit: 300 });
    return c.json({ logs, jobIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load logs";
    return c.json({ error: message }, 500);
  }
}

export async function getAdminOverviewHandler(c: Context) {
  try {
    const [suppliers, status] = await Promise.all([
      getAdminSuppliers(),
      getScrapeStatus(),
    ]);

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [productCount, failedJobs, searchesToday] = await Promise.all([
      supabase
        .from("supplier_products")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("scrape_jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", since24h),
      supabase
        .from("search_events")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date().toISOString().slice(0, 10)),
    ]);

    const lastRefresh = suppliers
      .map((s) => s.lastScheduledRefreshAt)
      .filter(Boolean)
      .sort()
      .reverse()[0];

    return c.json({
      stats: {
        activeSuppliers: suppliers.filter((s) => s.status === "active").length,
        totalProducts: productCount.count ?? 0,
        lastScrapeAt: lastRefresh ?? null,
        failedJobs24h: failedJobs.count ?? 0,
        searchesToday: searchesToday.count ?? 0,
      },
      suppliers,
      scrape: status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load overview";
    return c.json({ error: message }, 500);
  }
}
