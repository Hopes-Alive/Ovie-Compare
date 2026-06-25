import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ArchitectureDiagram } from "@/components/admin/architecture-diagram";

export const metadata: Metadata = {
  title: "Architecture | Ovie Admin",
};

export default function AdminArchitecturePage() {
  return (
    <>
      <AdminPageHeader
        title="Architecture"
        description="System diagram and stack reference for stakeholders."
      />
      <ArchitectureDiagram />
    </>
  );
}
