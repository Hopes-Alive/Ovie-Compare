"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { AdminPanel } from "@/components/admin/shell/admin-panel";
import { AdminStatGrid } from "@/components/admin/shell/admin-stat-grid";
import { AdminPageShell } from "@/components/admin/shell/admin-page-shell";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { mockOverviewStats } from "@/data/mock/admin";

export type OverviewSupplier = {
  slug: string;
  name: string;
  base_url: string;
  is_active: boolean | null;
};

type OverviewDashboardProps = {
  chatUrl: string;
  suppliers: OverviewSupplier[];
};

export function OverviewDashboard({
  chatUrl,
  suppliers,
}: OverviewDashboardProps) {
  const stats = mockOverviewStats;
  const activeSuppliers = suppliers.filter((s) => s.is_active);
  const activeCount = activeSuppliers.length;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(chatUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const headerActions = (
    <>
      <Button variant="outline" size="sm" onClick={handleCopy}>
        {copied ? (
          <Check data-icon="inline-start" className="size-3.5" />
        ) : (
          <Copy data-icon="inline-start" className="size-3.5" />
        )}
        {copied ? "Copied" : "Copy link"}
      </Button>
      <Button
        size="sm"
        render={
          <a href={ROUTES.chat} target="_blank" rel="noopener noreferrer" />
        }
      >
        <ExternalLink data-icon="inline-start" className="size-3.5" />
        Open chat
      </Button>
    </>
  );

  return (
    <AdminPageShell
      title="Overview"
      description="Summary of system health and clinic access."
      actions={headerActions}
    >
      <div className="space-y-5">
        <AdminStatGrid
          columns={5}
          stats={[
            {
              title: "Active suppliers",
              value: activeCount || stats.activeSuppliers,
            },
            {
              title: "Products indexed",
              value: stats.totalProducts.toLocaleString(),
            },
            {
              title: "Last scrape",
              value: stats.lastScrapeAgo,
            },
            {
              title: "Failed jobs (24h)",
              value: stats.failedJobs24h,
              alert: stats.failedJobs24h > 0,
            },
            {
              title: "Searches today",
              value: stats.searchesToday,
            },
          ]}
        />

        <div className="grid gap-5 lg:grid-cols-2">
          <AdminPanel
            title="Suppliers"
            description="Active data sources in chat."
            action={
              <Link
                href={ROUTES.admin.suppliers}
                className="text-xs text-[var(--admin-secondary)] hover:text-[var(--admin-foreground)]"
              >
                View all
              </Link>
            }
            contentClassName="p-0"
          >
            {activeSuppliers.length > 0 ? (
              <ul className="divide-y divide-[var(--admin-border)]">
                {activeSuppliers.map((supplier) => (
                  <li
                    key={supplier.slug}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--admin-foreground)]">
                        {supplier.name}
                      </p>
                      <p className="truncate text-xs text-[var(--admin-muted)]">
                        {supplier.base_url.replace(/^https?:\/\//, "")}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-[var(--admin-muted)]">
                      Live
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-[var(--admin-muted)]">
                No active suppliers.
              </p>
            )}
          </AdminPanel>

          <AdminPanel
            title="Clinic access"
            description="Share the chat link or QR code with staff."
            contentClassName="p-4"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="shrink-0 rounded-md border border-[var(--admin-border)] p-2">
                <QRCodeSVG
                  value={chatUrl}
                  size={96}
                  level="M"
                  includeMargin={false}
                  fgColor="#18181b"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="break-all rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-2.5 py-2 font-mono text-xs text-[var(--admin-foreground)]">
                  {chatUrl}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="w-full sm:w-auto"
                >
                  {copied ? "Copied" : "Copy URL"}
                </Button>
              </div>
            </div>
          </AdminPanel>
        </div>
      </div>
    </AdminPageShell>
  );
}
