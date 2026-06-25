import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AnalyticsMetrics } from "@/components/admin/analytics-metrics";
import { TopQueriesTable } from "@/components/admin/top-queries-table";

export const metadata: Metadata = {
  title: "Analytics | Ovie Admin",
};

export default function AdminAnalyticsPage() {
  return (
    <>
      <AdminPageHeader
        title="Analytics"
        description="Usage metrics for chat and scraping."
      />
      <AnalyticsMetrics />
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-medium">Top search queries</h2>
        <TopQueriesTable />
      </div>
    </>
  );
}
