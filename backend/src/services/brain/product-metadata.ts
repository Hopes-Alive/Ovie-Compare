/**
 * Product card metadata helpers — added-at, price change status.
 */
import { supabase } from "../../lib/supabase.js";
import { formatLastCheckedAgo } from "./freshness.js";

export type PriceChangeStatus = "unchanged" | "changed" | "unknown";

export type LatestPriceHistory = {
  old_price: number | null;
  new_price: number | null;
  changed_at: string;
};

const NEW_PRODUCT_DAYS = 7;

export function formatAddedAgo(createdAt: string | null): string {
  return formatLastCheckedAgo(createdAt);
}

export function isNewProduct(createdAt: string | null): boolean {
  if (!createdAt) return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs < NEW_PRODUCT_DAYS * 24 * 60 * 60 * 1000;
}

export function computePriceChangeStatus(
  createdAt: string | null,
  lastChangedAt: string | null,
  lastCheckedAt: string | null,
  latestHistory: LatestPriceHistory | null,
): PriceChangeStatus {
  if (latestHistory) {
    if (lastCheckedAt && latestHistory.changed_at >= lastCheckedAt) {
      return "changed";
    }
    if (
      lastChangedAt &&
      latestHistory.changed_at >= new Date(lastChangedAt).toISOString().slice(0, 19)
    ) {
      return "changed";
    }
  }

  if (!createdAt) return "unknown";

  const ageMs = Date.now() - new Date(createdAt).getTime();
  if (ageMs < 24 * 60 * 60 * 1000) return "unknown";

  if (lastChangedAt && lastCheckedAt) {
    const changedMs = new Date(lastChangedAt).getTime();
    const checkedMs = new Date(lastCheckedAt).getTime();
    if (Math.abs(changedMs - checkedMs) < 60_000) return "changed";
    if (checkedMs >= changedMs) return "unchanged";
  }

  return latestHistory ? "changed" : "unchanged";
}

export async function loadLatestPriceHistory(
  productIds: string[],
): Promise<Map<string, LatestPriceHistory>> {
  const map = new Map<string, LatestPriceHistory>();
  if (productIds.length === 0) return map;

  const { data, error } = await supabase
    .from("price_history")
    .select("supplier_product_id, old_price, new_price, changed_at")
    .in("supplier_product_id", productIds)
    .order("changed_at", { ascending: false });

  if (error || !data) return map;

  for (const row of data as Array<Record<string, unknown>>) {
    const pid = row.supplier_product_id as string;
    if (map.has(pid)) continue;
    map.set(pid, {
      old_price: row.old_price as number | null,
      new_price: row.new_price as number | null,
      changed_at: row.changed_at as string,
    });
  }

  return map;
}
