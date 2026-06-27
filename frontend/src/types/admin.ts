export type SupplierStatus = "active" | "disabled" | "planned";

export type OverviewStats = {
  activeSuppliers: number;
  totalProducts: number;
  lastScrapeAgo: string;
  failedJobs24h: number;
  searchesToday: number;
};

export type SupplierSummary = {
  slug: string;
  name: string;
  websiteUrl: string;
  adapterKey: string;
  status: SupplierStatus;
  productCount: number;
  lastCheckAgo: string;
  errors24h: number;
  scrapeEnabled: boolean;
  liveCheckEnabled: boolean;
};

export type ScrapeJobSummary = {
  id: string;
  startedAt: string;
  supplier: string;
  type: "seed" | "refresh";
  status: "completed" | "running" | "failed";
  found: number;
  updated: number;
  failed: number;
  duration: string;
};

export type LiveCheckJobSummary = {
  id: string;
  startedAt: string;
  productCount: number;
  status: "completed" | "running" | "failed";
  changedCount: number;
  duration: string;
};

export type AnalyticsMetric = {
  label: string;
  value: string;
  description?: string;
};

export type DailyCount = {
  date: string;
  count: number;
};

export type AnalyticsDashboardData = {
  chatSessions7d: number;
  chatSessions30d: number;
  liveChecksTriggered: number;
  priceChanges7d: number;
  scrapeSuccessRate: number;
  searchesByDay: DailyCount[];
  topQueries: TopQuery[];
};

export type TopQuery = {
  rank: number;
  query: string;
  count: number;
};

export type ScrapeJobItem = {
  id: string;
  url: string;
  status: "success" | "failed";
  error?: string;
};
