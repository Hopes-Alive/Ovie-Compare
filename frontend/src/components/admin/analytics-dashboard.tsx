"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, RefreshCw } from "lucide-react";

import { AnalyticsKpi } from "@/components/admin/analytics/kpi";
import { AnalyticsPanel } from "@/components/admin/analytics/panel";
import { TopQueriesPanel } from "@/components/admin/analytics/top-queries-panel";
import {
  aggregateByWeekday,
  filterByDateRange,
  fmtNum,
  fmtPercent,
  topDaysByCount,
} from "@/components/admin/analytics/utils";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { AnalyticsDashboardData } from "@/types/admin";

function defaultFromDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 29);
  return date.toISOString().slice(0, 10);
}

function defaultToDate(): string {
  return new Date().toISOString().slice(0, 10);
}

const emptyAnalytics: AnalyticsDashboardData = {
  chatSessions7d: 0,
  chatSessions30d: 0,
  liveChecksTriggered: 0,
  priceChanges7d: 0,
  scrapeSuccessRate: 0,
  searchesByDay: [],
  topQueries: [],
};

export function AnalyticsDashboard() {
  const [source, setSource] = useState<AnalyticsDashboardData>(emptyAnalytics);
  const [fromInput, setFromInput] = useState(defaultFromDate);
  const [toInput, setToInput] = useState(defaultToDate);
  const [from, setFrom] = useState(defaultFromDate);
  const [to, setTo] = useState(defaultToDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async (rangeFrom: string, rangeTo: string) => {
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    if (rangeFrom) qs.set("from", rangeFrom);
    if (rangeTo) qs.set("to", rangeTo);

    try {
      const response = await fetch(`/api/admin/analytics?${qs.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as AnalyticsDashboardData & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load analytics");
      }

      setSource(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
      setSource(emptyAnalytics);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics(from, to);
  }, [from, to, loadAnalytics]);

  const filteredSearches = useMemo(
    () => filterByDateRange(source.searchesByDay, from, to),
    [source.searchesByDay, from, to]
  );

  const searchesByDayOfWeek = useMemo(
    () => aggregateByWeekday(filteredSearches),
    [filteredSearches]
  );

  const topDays = useMemo(
    () => topDaysByCount(filteredSearches),
    [filteredSearches]
  );

  const totalSearchesInRange = useMemo(
    () => filteredSearches.reduce((sum, row) => sum + row.count, 0),
    [filteredSearches]
  );

  function applyRange() {
    setFrom(fromInput);
    setTo(toInput);
  }

  const kpisRow1 = [
    {
      title: "Chat sessions (7d)",
      value: loading ? "…" : fmtNum(source.chatSessions7d),
      description: "Unique sessions this week",
    },
    {
      title: "Chat sessions (30d)",
      value: loading ? "…" : fmtNum(source.chatSessions30d),
      description: "Rolling 30-day total",
    },
    {
      title: "Searches (range)",
      value: loading ? "…" : fmtNum(totalSearchesInRange),
      description: "Product searches in selected dates",
    },
  ];

  const kpisRow2 = [
    {
      title: "Live checks (7d)",
      value: loading ? "…" : fmtNum(source.liveChecksTriggered),
      description: "Triggered from chat UI",
    },
    {
      title: "Price changes (7d)",
      value: loading ? "…" : fmtNum(source.priceChanges7d),
      description: "Detected across suppliers",
    },
    {
      title: "Scrape success rate",
      value: loading ? "…" : fmtPercent(source.scrapeSuccessRate),
      description: "Last 30 days",
    },
  ];

  return (
    <div className="-mx-4 -mb-4 md:-mx-8 md:-mb-8">
      <div className="border-b border-[#E5E3DF] bg-white">
        <div className="px-4 py-5 sm:px-6 md:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-[-0.01em] text-[#1A1A1A]">
              <BarChart3 className="h-5 w-5 text-[#10B981]" />
              Analytics
            </h1>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={fromInput}
                onChange={(event) => setFromInput(event.target.value)}
                className="h-10 rounded-lg border border-[#E5E3DF] bg-white px-3 text-[14px] text-[#1A1A1A] focus:border-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-[#1A1A1A]"
              />
              <span className="text-[14px] text-[#A8A39B]">to</span>
              <input
                type="date"
                value={toInput}
                onChange={(event) => setToInput(event.target.value)}
                className="h-10 rounded-lg border border-[#E5E3DF] bg-white px-3 text-[14px] text-[#1A1A1A] focus:border-[#1A1A1A] focus:outline-none focus:ring-1 focus:ring-[#1A1A1A]"
              />
              <Button
                onClick={applyRange}
                disabled={loading}
                className="h-10 rounded-lg bg-[#1A1A1A] px-4 text-white transition-colors duration-300 hover:bg-[#333]"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                Apply
              </Button>
            </div>
          </div>
          <p className="mt-2 text-[14px] text-[#A8A39B]">
            Usage metrics for chat and scraping.
          </p>
          {error && <p className="mt-2 text-[14px] text-red-600">{error}</p>}
        </div>
      </div>

      <div className="space-y-6 bg-[#FAF9F7] px-4 py-6 text-[#1A1A1A] sm:px-6 md:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {kpisRow1.map((kpi) => (
            <AnalyticsKpi
              key={kpi.title}
              title={kpi.title}
              value={kpi.value}
              description={kpi.description}
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {kpisRow2.map((kpi) => (
            <AnalyticsKpi
              key={kpi.title}
              title={kpi.title}
              value={kpi.value}
              description={kpi.description}
            />
          ))}
        </div>

        <AnalyticsPanel title="Searches per Day">
          <div className="h-72">
            {loading ? (
              <div className="h-full w-full animate-pulse rounded-xl bg-[#F7F5F0]" />
            ) : filteredSearches.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[#E5E3DF] bg-[#FAF9F7] text-[14px] text-[#A8A39B]">
                No searches in this range.
              </div>
            ) : (
              <ChartContainer
                config={{
                  count: {
                    label: "Searches",
                    theme: { light: "#10B981", dark: "#10B981" },
                  },
                }}
                className="h-full w-full"
              >
                <LineChart
                  data={filteredSearches}
                  margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  accessibilityLayer
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E5E3DF"
                  />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tick={{ fill: "#A8A39B", fontSize: 12 }}
                    tickFormatter={(value) =>
                      new Date(`${value}T12:00:00Z`).toLocaleDateString(
                        "en-AU",
                        { month: "short", day: "numeric" }
                      )
                    }
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tick={{ fill: "#A8A39B", fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    cursor={{ stroke: "#E5E3DF", strokeWidth: 1 }}
                    content={
                      <ChartTooltipContent labelKey="date" nameKey="count" />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#10B981"
                    strokeWidth={2}
                    strokeLinecap="round"
                    dot={{
                      r: 3,
                      fill: "#10B981",
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    activeDot={{
                      r: 5,
                      fill: "#10B981",
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                    connectNulls
                  >
                    <LabelList
                      position="top"
                      offset={8}
                      fontSize={11}
                      fontWeight="600"
                      fill="#1A1A1A"
                    />
                  </Line>
                </LineChart>
              </ChartContainer>
            )}
          </div>
        </AnalyticsPanel>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <AnalyticsPanel title="Activity by Day of Week">
            <p className="mb-3 text-[13px] text-[#A8A39B]">
              Total searches per weekday in the selected range.
            </p>
            <div className="h-64">
              {loading ? (
                <div className="h-full w-full animate-pulse rounded-xl bg-[#F7F5F0]" />
              ) : (
                <ChartContainer
                  config={{
                    count: {
                      label: "Searches",
                      theme: { light: "#1A1A1A", dark: "#1A1A1A" },
                    },
                  }}
                  className="h-full w-full"
                >
                  <BarChart
                    data={searchesByDayOfWeek}
                    margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    accessibilityLayer
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#E5E3DF"
                    />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tick={{ fill: "#A8A39B", fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tick={{ fill: "#A8A39B", fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <ChartTooltip
                      cursor={{ fill: "#F7F5F0" }}
                      content={
                        <ChartTooltipContent labelKey="day" nameKey="count" />
                      }
                    />
                    <Bar dataKey="count" fill="#1A1A1A" radius={[6, 6, 0, 0]}>
                      <LabelList
                        position="top"
                        offset={6}
                        fontSize={11}
                        fontWeight="600"
                        fill="#1A1A1A"
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              )}
            </div>
          </AnalyticsPanel>

          <AnalyticsPanel title="Top 7 Days by Search Volume">
            <p className="mb-3 text-[13px] text-[#A8A39B]">
              Busiest days in the selected range.
            </p>
            <div className="h-64">
              {loading ? (
                <div className="h-full w-full animate-pulse rounded-xl bg-[#F7F5F0]" />
              ) : topDays.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-[#E5E3DF] bg-[#FAF9F7] text-[14px] text-[#A8A39B]">
                  No data in range.
                </div>
              ) : (
                <ChartContainer
                  config={{
                    count: {
                      label: "Searches",
                      theme: { light: "#10B981", dark: "#10B981" },
                    },
                  }}
                  className="h-full w-full"
                >
                  <BarChart
                    data={topDays}
                    layout="vertical"
                    margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
                    accessibilityLayer
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="#E5E3DF"
                    />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tick={{ fill: "#A8A39B", fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="date"
                      width={88}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "#66625E" }}
                    />
                    <ChartTooltip
                      cursor={{ fill: "#F7F5F0" }}
                      content={
                        <ChartTooltipContent labelKey="date" nameKey="count" />
                      }
                    />
                    <Bar
                      dataKey="count"
                      fill="#10B981"
                      radius={[0, 6, 6, 0]}
                      barSize={20}
                    />
                  </BarChart>
                </ChartContainer>
              )}
            </div>
          </AnalyticsPanel>
        </div>

        <TopQueriesPanel queries={source.topQueries} />
      </div>
    </div>
  );
}
