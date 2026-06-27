import type {
  LiveCheckJobSummary,
  OverviewStats,
  ScrapeJobItem,
  ScrapeJobSummary,
  SupplierSummary,
} from "@/types/admin";

// TODO: replace with GET /api/admin/overview
export const mockOverviewStats: OverviewStats = {
  activeSuppliers: 2,
  totalProducts: 801,
  lastScrapeAgo: "2h ago",
  failedJobs24h: 0,
  searchesToday: 12,
};

// TODO: replace with GET /api/admin/suppliers
export const mockSuppliers: SupplierSummary[] = [
  {
    slug: "henry-schein",
    name: "Henry Schein",
    websiteUrl: "https://www.henryschein.com.au",
    adapterKey: "henry_schein",
    status: "active",
    productCount: 412,
    lastCheckAgo: "2h ago",
    errors24h: 0,
    scrapeEnabled: true,
    liveCheckEnabled: true,
  },
  {
    slug: "adam-dental",
    name: "Adam Dental",
    websiteUrl: "https://www.adamdental.com.au",
    adapterKey: "adam_dental",
    status: "active",
    productCount: 389,
    lastCheckAgo: "2h ago",
    errors24h: 1,
    scrapeEnabled: true,
    liveCheckEnabled: true,
  },
  {
    slug: "orien-dental",
    name: "Orien Dental",
    websiteUrl: "https://www.orien.com.au",
    adapterKey: "orien_dental",
    status: "planned",
    productCount: 0,
    lastCheckAgo: "—",
    errors24h: 0,
    scrapeEnabled: false,
    liveCheckEnabled: false,
  },
];

// TODO: replace with GET /api/admin/jobs
export const mockScrapeJobs: ScrapeJobSummary[] = [
  {
    id: "scrape-1",
    startedAt: "Today, 6:00 AM",
    supplier: "Henry Schein",
    type: "refresh",
    status: "completed",
    found: 412,
    updated: 18,
    failed: 0,
    duration: "4m 12s",
  },
  {
    id: "scrape-2",
    startedAt: "Today, 6:05 AM",
    supplier: "Adam Dental",
    type: "refresh",
    status: "completed",
    found: 389,
    updated: 12,
    failed: 1,
    duration: "3m 48s",
  },
  {
    id: "scrape-3",
    startedAt: "Yesterday, 6:00 AM",
    supplier: "Henry Schein",
    type: "seed",
    status: "completed",
    found: 410,
    updated: 410,
    failed: 0,
    duration: "12m 30s",
  },
];

export const mockLiveCheckJobs: LiveCheckJobSummary[] = [
  {
    id: "live-1",
    startedAt: "Today, 9:14 AM",
    productCount: 3,
    status: "completed",
    changedCount: 1,
    duration: "42s",
  },
  {
    id: "live-2",
    startedAt: "Today, 8:02 AM",
    productCount: 1,
    status: "completed",
    changedCount: 0,
    duration: "28s",
  },
];

// TODO: replace with GET /api/admin/jobs/:id/items
export const mockScrapeJobItems: Record<string, ScrapeJobItem[]> = {
  "scrape-2": [
    {
      id: "item-1",
      url: "https://www.adamdental.com.au/gloves/nitrile-medium",
      status: "success",
    },
    {
      id: "item-2",
      url: "https://www.adamdental.com.au/composite/a2",
      status: "failed",
      error: "Timeout after 30s — page did not load",
    },
    {
      id: "item-3",
      url: "https://www.adamdental.com.au/pouches/sterilisation",
      status: "success",
    },
  ],
};
