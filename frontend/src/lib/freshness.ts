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
