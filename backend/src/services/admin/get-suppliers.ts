import { supabase } from "../../lib/supabase.js";
import { formatLastCheckedAgo } from "../brain/freshness.js";

export type AdminSupplierRow = {
  id: string;
  slug: string;
  name: string;
  base_url: string;
  adapter_key: string;
  is_active: boolean;
  scrape_enabled: boolean;
  live_check_enabled: boolean;
  refresh_interval_minutes: number;
  last_scheduled_refresh_at: string | null;
};

export type AdminSupplierSummary = {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string;
  adapterKey: string;
  status: "active" | "disabled" | "planned";
  productCount: number;
  lastCheckAgo: string;
  errors24h: number;
  scrapeEnabled: boolean;
  liveCheckEnabled: boolean;
  refreshIntervalMinutes: number;
  lastScheduledRefreshAt: string | null;
  lastRefreshAgo: string;
  nextRefreshIn: string | null;
};

function formatNextRefresh(
  lastAt: string | null,
  intervalMinutes: number,
): string | null {
  if (!lastAt) return "due now";
  const nextMs =
    new Date(lastAt).getTime() + intervalMinutes * 60_000 - Date.now();
  if (nextMs <= 0) return "due now";
  const minutes = Math.ceil(nextMs / 60_000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `in ${hours} hr`;
  const days = Math.ceil(hours / 24);
  return `in ${days} day${days > 1 ? "s" : ""}`;
}

export async function getAdminSuppliers(): Promise<AdminSupplierSummary[]> {
  const { data: suppliers, error } = await supabase
    .from("suppliers")
    .select(
      "id, slug, name, base_url, adapter_key, is_active, scrape_enabled, live_check_enabled, refresh_interval_minutes, last_scheduled_refresh_at",
    )
    .order("name");

  if (error) throw new Error(`Failed to load suppliers: ${error.message}`);

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const summaries: AdminSupplierSummary[] = [];

  for (const s of (suppliers ?? []) as AdminSupplierRow[]) {
    const { count: productCount } = await supabase
      .from("supplier_products")
      .select("*", { count: "exact", head: true })
      .eq("supplier_id", s.id)
      .eq("is_active", true);

    const { data: recentJobs } = await supabase
      .from("scrape_jobs")
      .select("finished_at, stats")
      .eq("supplier_id", s.id)
      .gte("created_at", since24h);

    const errors24h = (recentJobs ?? []).filter((j) => {
      const stats = j.stats as { failed?: number } | null;
      return (stats?.failed ?? 0) > 0;
    }).length;

    const { data: lastProduct } = await supabase
      .from("supplier_products")
      .select("last_checked_at")
      .eq("supplier_id", s.id)
      .order("last_checked_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    const lastCheckAt = (lastProduct as { last_checked_at: string | null } | null)
      ?.last_checked_at;

    summaries.push({
      id: s.id,
      slug: s.slug,
      name: s.name,
      websiteUrl: s.base_url,
      adapterKey: s.adapter_key,
      status: s.is_active ? "active" : "disabled",
      productCount: productCount ?? 0,
      lastCheckAgo: formatLastCheckedAgo(lastCheckAt ?? null),
      errors24h,
      scrapeEnabled: s.scrape_enabled,
      liveCheckEnabled: s.live_check_enabled,
      refreshIntervalMinutes: s.refresh_interval_minutes ?? 360,
      lastScheduledRefreshAt: s.last_scheduled_refresh_at,
      lastRefreshAgo: formatLastCheckedAgo(s.last_scheduled_refresh_at),
      nextRefreshIn: formatNextRefresh(
        s.last_scheduled_refresh_at,
        s.refresh_interval_minutes ?? 360,
      ),
    });
  }

  return summaries;
}

export async function patchAdminSupplier(
  id: string,
  patch: {
    refresh_interval_minutes?: number;
    scrape_enabled?: boolean;
    live_check_enabled?: boolean;
  },
): Promise<AdminSupplierSummary> {
  if (patch.refresh_interval_minutes != null) {
    const m = patch.refresh_interval_minutes;
    if (m < 15 || m > 10080) {
      throw new Error("refresh_interval_minutes must be between 15 and 10080");
    }
  }

  const { error } = await supabase.from("suppliers").update(patch).eq("id", id);
  if (error) throw new Error(`Failed to update supplier: ${error.message}`);

  const all = await getAdminSuppliers();
  const updated = all.find((s) => s.id === id);
  if (!updated) throw new Error("Supplier not found after update");
  return updated;
}
