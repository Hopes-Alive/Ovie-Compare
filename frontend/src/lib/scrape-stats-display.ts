import type { ScrapeActivitySummary } from "@/lib/scrape-log-parser";
import type { ScrapeJobSummary } from "@/types/admin";

export type ScrapeStatKey = "checked" | "new" | "updated" | "unchanged" | "failed";

export function productsChecked(summary: Pick<ScrapeActivitySummary, "added" | "updated" | "unchanged">): number {
  return summary.added + summary.updated + summary.unchanged;
}

export function aggregateScrapeSummaries(summaries: ScrapeActivitySummary[]): ScrapeActivitySummary {
  return summaries.reduce(
    (acc, s) => ({
      added: acc.added + s.added,
      updated: acc.updated + s.updated,
      unchanged: acc.unchanged + s.unchanged,
      issues: acc.issues + s.issues,
      categoriesChecked: acc.categoriesChecked + s.categoriesChecked,
    }),
    { added: 0, updated: 0, unchanged: 0, issues: 0, categoriesChecked: 0 },
  );
}

export function formatScrapeJobStatus(status: ScrapeJobSummary["status"]): string {
  switch (status) {
    case "completed":
      return "Complete";
    case "running":
      return "Running";
    case "partial":
      return "Stopped early";
    case "failed":
      return "Failed";
  }
}

export function scrapeJobStatusVariant(
  status: ScrapeJobSummary["status"],
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "completed":
      return "default";
    case "running":
      return "secondary";
    case "partial":
      return "outline";
    case "failed":
      return "destructive";
  }
}

export function statCellClass(key: ScrapeStatKey, value: number): string {
  if (value <= 0) return "text-[var(--admin-muted)]";
  switch (key) {
    case "new":
      return "font-medium text-emerald-700";
    case "updated":
      return "font-medium text-sky-700";
    case "unchanged":
      return "text-[var(--admin-foreground)]";
    case "failed":
      return "font-medium text-red-600";
    default:
      return "text-[var(--admin-foreground)]";
  }
}

export function statMiniClass(key: Exclude<ScrapeStatKey, "checked">, value: number): string {
  if (value <= 0) return "text-[var(--admin-muted)]";
  switch (key) {
    case "new":
      return "text-emerald-700";
    case "updated":
      return "text-sky-700";
    case "unchanged":
      return "text-[var(--admin-foreground)]";
    case "failed":
      return "text-red-600";
  }
}

export function formatRunSummary(summary: ScrapeActivitySummary): string {
  const parts: string[] = [];
  const checked = productsChecked(summary);
  if (checked > 0) parts.push(`${checked} checked`);
  if (summary.added > 0) parts.push(`${summary.added} new`);
  if (summary.updated > 0) parts.push(`${summary.updated} updated`);
  if (summary.unchanged > 0 && summary.added === 0 && summary.updated === 0) {
    parts.push(`${summary.unchanged} unchanged`);
  }
  if (summary.issues > 0) parts.push(`${summary.issues} issues`);
  return parts.length > 0 ? parts.join(" · ") : "No products checked yet";
}
