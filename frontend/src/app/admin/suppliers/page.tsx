import type { Metadata } from "next";

import { AdminPageShell } from "@/components/admin/shell/admin-page-shell";
import { SupplierTable } from "@/components/admin/supplier-table";

export const metadata: Metadata = {
  title: "Suppliers | Ovie Admin",
};

export default function AdminSuppliersPage() {
  return (
    <AdminPageShell
      title="Suppliers"
      description="Connected data sources and scrape health."
    >
      <SupplierTable />
    </AdminPageShell>
  );
}
