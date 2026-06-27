import type { Metadata } from "next";

import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";

export const metadata: Metadata = {
  title: "Analytics | Ovie Admin",
};

export default function AdminAnalyticsPage() {
  return <AnalyticsDashboard />;
}
