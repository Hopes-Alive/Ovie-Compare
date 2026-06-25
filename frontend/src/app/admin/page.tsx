import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { OverviewActions } from "@/components/admin/overview-actions";
import { OverviewCards } from "@/components/admin/overview-cards";

export const metadata: Metadata = {
  title: "Overview | Ovie Admin",
};

export default function AdminOverviewPage() {
  return (
    <>
      <AdminPageHeader
        title="Overview"
        description="Summary of connected suppliers and system health."
      />
      <OverviewCards />
      <OverviewActions />
    </>
  );
}
