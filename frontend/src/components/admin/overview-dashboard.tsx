"use client";

import {
  AlertCircle,
  ExternalLink,
  LayoutDashboard,
  MessageSquare,
  Package,
  Search,
  Store,
  Timer,
} from "lucide-react";

import { AnalyticsKpi } from "@/components/admin/analytics/kpi";
import { OverviewChatAccess } from "@/components/admin/overview-chat-access";
import {
  OverviewSuppliersSheet,
  type OverviewSupplier,
} from "@/components/admin/overview-suppliers-sheet";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { mockOverviewStats } from "@/data/mock/admin";

type OverviewDashboardProps = {
  chatUrl: string;
  suppliers: OverviewSupplier[];
};

export function OverviewDashboard({
  chatUrl,
  suppliers,
}: OverviewDashboardProps) {
  const stats = mockOverviewStats;
  const activeCount = suppliers.filter((s) => s.is_active).length;

  const kpis = [
    {
      title: "Active suppliers",
      value: String(activeCount || stats.activeSuppliers),
      description: "Available in chat now",
      icon: Store,
    },
    {
      title: "Products indexed",
      value: stats.totalProducts.toLocaleString(),
      description: "Across all suppliers",
      icon: Package,
    },
    {
      title: "Last scrape",
      value: stats.lastScrapeAgo,
      description: "Most recent refresh",
      icon: Timer,
    },
    {
      title: "Failed jobs (24h)",
      value: String(stats.failedJobs24h),
      description: stats.failedJobs24h === 0 ? "All clear" : "Needs attention",
      icon: AlertCircle,
    },
    {
      title: "Searches today",
      value: String(stats.searchesToday),
      description: "Product lookups in chat",
      icon: Search,
    },
  ];

  return (
    <div className="-mx-4 -mb-4 md:-mx-8 md:-mb-8">
      <div className="border-b border-[#E5E3DF] bg-white">
        <div className="px-4 py-5 sm:px-6 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-[-0.01em] text-[#1A1A1A]">
                <LayoutDashboard className="size-5 text-[#10B981]" />
                Overview
              </h1>
              <p className="mt-2 text-[14px] text-[#A8A39B]">
                System health, clinic chat access, and live supplier status.
              </p>
            </div>

            <Button
              size="lg"
              className="h-11 rounded-xl bg-[#1A1A1A] px-5 text-white shadow-sm transition-colors duration-300 hover:bg-[#333]"
              render={
                <a href={ROUTES.chat} target="_blank" rel="noopener noreferrer" />
              }
            >
              <ExternalLink data-icon="inline-start" />
              Open chat
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6 bg-[#FAF9F7] px-4 py-6 sm:px-6 md:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.title} className="relative">
                <AnalyticsKpi
                  title={kpi.title}
                  value={kpi.value}
                  description={kpi.description}
                />
                <Icon className="pointer-events-none absolute right-4 top-4 size-4 text-[#E5E3DF]" />
              </div>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <OverviewChatAccess chatUrl={chatUrl} />

          <div className="flex flex-col gap-4">
            <div className="rounded-3xl border border-[#E5E3DF] bg-gradient-to-br from-[#1A1A1A] to-[#2D2D2D] p-6 text-white shadow-sm">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10">
                <MessageSquare className="size-5 text-[#6EE7B7]" />
              </div>
              <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.01em]">
                Launch the chatbot
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-white/70">
                Preview the clinic experience — search products, compare prices,
                and run live checks.
              </p>
              <Button
                size="lg"
                className="mt-5 h-11 w-full rounded-xl bg-[#10B981] text-white hover:bg-[#059669]"
                render={
                  <a
                    href={ROUTES.chat}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLink data-icon="inline-start" />
                Open chat
              </Button>
            </div>

            <OverviewSuppliersSheet
              suppliers={suppliers}
              activeCount={activeCount}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
