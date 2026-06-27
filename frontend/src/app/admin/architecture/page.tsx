import type { Metadata } from "next";

import { ArchitectureDiagram } from "@/components/admin/architecture-diagram";
import { AdminPageShell } from "@/components/admin/shell/admin-page-shell";

export const metadata: Metadata = {
  title: "Architecture | Ovie Admin",
};

export default function AdminArchitecturePage() {
  return (
    <AdminPageShell
      title="Architecture"
      description="System diagram and stack reference."
    >
      <ArchitectureDiagram />
    </AdminPageShell>
  );
}
