import type { Metadata } from "next";

import { AdminJobsContent } from "@/components/admin/admin-jobs-content";

export const metadata: Metadata = {
  title: "Jobs | Ovie Admin",
};

export default function AdminJobsPage() {
  return <AdminJobsContent />;
}
