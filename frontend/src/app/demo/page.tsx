import type { Metadata } from "next";

import { AdminLayout } from "@/components/admin/admin-layout";
import { DemoPageContent } from "@/components/demo/demo-page-content";

export const metadata: Metadata = {
  title: "Demo hub | Ovie",
  description: "Organise stakeholder demos across all Ovie pages",
};

export default function DemoPage() {
  return (
    <AdminLayout>
      <DemoPageContent />
    </AdminLayout>
  );
}
