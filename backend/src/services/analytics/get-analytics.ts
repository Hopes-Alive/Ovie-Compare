import { supabase } from "../../lib/supabase.js";

import {
  daysAgoUtc,
  eachDayInclusive,
  endOfDayUtc,
  resolveRange,
} from "./date-range.js";

export type DailyCount = {
  date: string;
  count: number;
};

export type TopQueryRow = {
  rank: number;
  query: string;
  count: number;
};

export type AdminAnalyticsResponse = {
  chatSessions7d: number;
  chatSessions30d: number;
  liveChecksTriggered: number;
  priceChanges7d: number;
  scrapeSuccessRate: number;
  searchesByDay: DailyCount[];
  topQueries: TopQueryRow[];
  range: { from: string; to: string };
};

type SearchEventRow = {
  query: string;
  created_at: string;
};

function aggregateDailyCounts(
  days: string[],
  events: SearchEventRow[]
): DailyCount[] {
  const counts = new Map<string, number>();

  for (const event of events) {
    const day = event.created_at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  return days.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

function buildTopQueries(events: SearchEventRow[], limit = 10): TopQueryRow[] {
  const counts = new Map<string, string>();
  const totals = new Map<string, number>();

  for (const event of events) {
    const trimmed = event.query.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (!counts.has(key)) counts.set(key, trimmed);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count], index) => ({
      rank: index + 1,
      query: counts.get(key) ?? key,
      count,
    }));
}

async function countSince(table: string, column: string, since: Date): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .gte(column, since.toISOString());

  if (error) {
    throw new Error(`Failed to count ${table}: ${error.message}`);
  }

  return count ?? 0;
}

export async function getAdminAnalytics(input: {
  from?: string;
  to?: string;
}): Promise<AdminAnalyticsResponse> {
  const { start, end } = resolveRange(input.from, input.to);
  const rangeStartIso = start.toISOString();
  const rangeEndIso = endOfDayUtc(end).toISOString();
  const days = eachDayInclusive(start, end);

  const [
    chatSessions7d,
    chatSessions30d,
    liveChecksTriggered,
    priceChanges7d,
    scrapeJobs,
    searchEventsResult,
  ] = await Promise.all([
    countSince("chat_sessions", "created_at", daysAgoUtc(7)),
    countSince("chat_sessions", "created_at", daysAgoUtc(30)),
    countSince("live_check_jobs", "created_at", daysAgoUtc(7)),
    countSince("price_history", "changed_at", daysAgoUtc(7)),
    supabase
      .from("scrape_jobs")
      .select("status")
      .gte("created_at", daysAgoUtc(30).toISOString())
      .in("status", ["success", "failed", "partial"]),
    supabase
      .from("search_events")
      .select("query, created_at")
      .gte("created_at", rangeStartIso)
      .lte("created_at", rangeEndIso)
      .order("created_at", { ascending: true }),
  ]);

  if (scrapeJobs.error) {
    throw new Error(`Failed to load scrape jobs: ${scrapeJobs.error.message}`);
  }
  if (searchEventsResult.error) {
    throw new Error(
      `Failed to load search events: ${searchEventsResult.error.message}`
    );
  }

  const finishedJobs = scrapeJobs.data ?? [];
  const successfulJobs = finishedJobs.filter((job) => job.status === "success").length;
  const scrapeSuccessRate =
    finishedJobs.length === 0
      ? 0
      : Math.round((successfulJobs / finishedJobs.length) * 100);

  const searchEvents = (searchEventsResult.data ?? []) as SearchEventRow[];

  return {
    chatSessions7d,
    chatSessions30d,
    liveChecksTriggered,
    priceChanges7d,
    scrapeSuccessRate,
    searchesByDay: aggregateDailyCounts(days, searchEvents),
    topQueries: buildTopQueries(searchEvents),
    range: { from: days[0] ?? input.from ?? "", to: days.at(-1) ?? input.to ?? "" },
  };
}
