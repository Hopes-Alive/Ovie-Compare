import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SupplierTable } from "@/components/admin/supplier-table";

export const metadata: Metadata = {
  title: "Suppliers | Ovie Admin",
};

export default function AdminSuppliersPage() {
  return (
    <>
      <AdminPageHeader
        title="Data sources"
        description="Connected suppliers and scrape health."
      />
      <SupplierTable />
    </>
  );
}
