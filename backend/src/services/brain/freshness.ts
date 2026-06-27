/**
 * Freshness helpers — compute labels and human-readable timestamps.
 */

export type Freshness = "fresh" | "moderate" | "stale";

/** Returns freshness label based on last_checked_at timestamp */
export function computeFreshness(lastCheckedAt: string | null): Freshness {
  if (!lastCheckedAt) return "stale";
  const ageMs = Date.now() - new Date(lastCheckedAt).getTime();
  const hours = ageMs / (1000 * 60 * 60);
  if (hours < 6) return "fresh";
  if (hours < 24) return "moderate";
  return "stale";
}

/** Returns a human-readable "X hours ago" string */
export function formatLastCheckedAgo(lastCheckedAt: string | null): string {
  if (!lastCheckedAt) return "unknown";
  const ageMs = Date.now() - new Date(lastCheckedAt).getTime();
  const minutes = Math.floor(ageMs / 60000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}
