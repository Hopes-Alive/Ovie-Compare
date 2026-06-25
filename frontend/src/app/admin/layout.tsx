import type { Metadata } from "next";

import { AdminLayout } from "@/components/admin/admin-layout";

export const metadata: Metadata = {
  title: "Admin | Ovie",
};

export default function AdminRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
