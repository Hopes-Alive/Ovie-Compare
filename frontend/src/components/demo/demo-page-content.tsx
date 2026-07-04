import Link from "next/link";
import { PenLine } from "lucide-react";

import { AdminPageShell } from "@/components/admin/shell/admin-page-shell";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";

export function DemoPageContent() {
  return (
    <AdminPageShell
      title="Demo hub"
      description="Kick off a fresh, blank demo canvas."
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
        <Button size="lg" render={<Link href={ROUTES.demoStart} />}>
          <PenLine className="size-4" />
          Start demo
        </Button>
      </div>
    </AdminPageShell>
  );
}
