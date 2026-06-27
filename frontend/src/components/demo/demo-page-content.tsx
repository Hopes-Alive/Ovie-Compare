import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import { AdminPageShell } from "@/components/admin/shell/admin-page-shell";
import { AdminPanel } from "@/components/admin/shell/admin-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DEMO_FLOW_ORDER, DEMO_SECTIONS } from "@/config/demo";
import { ROUTES } from "@/config/routes";

export function DemoPageContent() {
  return (
    <AdminPageShell
      title="Demo hub"
      description="Suggested walkthrough for stakeholder demos."
    >
      <div className="space-y-5">
        <AdminPanel title="Suggested flow">
          <ol className="space-y-2">
            {DEMO_FLOW_ORDER.map((item) => (
              <li key={item.step} className="flex items-center gap-3">
                <Badge variant="outline" className="shrink-0 tabular-nums">
                  {item.step}
                </Badge>
                <span className="flex-1 text-sm">{item.label}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link href={item.href} target="_blank" />}
                >
                  Open
                  <ExternalLink className="size-3.5" />
                </Button>
              </li>
            ))}
          </ol>
        </AdminPanel>

        <div className="grid gap-5 lg:grid-cols-2">
          {DEMO_SECTIONS.map((section) => (
            <AdminPanel
              key={section.id}
              title={section.title}
              description={section.description}
            >
              <div className="space-y-2">
                {section.steps.map((step) => (
                  <Link
                    key={step.href}
                    href={step.href}
                    target="_blank"
                    className="group flex items-start gap-3 rounded-md border border-[var(--admin-border)] px-3 py-2.5 transition-colors hover:bg-[var(--admin-bg)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium group-hover:underline">
                        {step.label}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--admin-muted)]">
                        {step.description}
                      </p>
                    </div>
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-[var(--admin-muted)]" />
                  </Link>
                ))}
              </div>
            </AdminPanel>
          ))}
        </div>

        <AdminPanel title="Routes" contentClassName="p-4">
          <div className="grid gap-1.5 font-mono text-xs text-[var(--admin-secondary)] sm:grid-cols-2">
            <div>{ROUTES.home}</div>
            <div>{ROUTES.chat}</div>
            <div>{ROUTES.demo}</div>
            <div>{ROUTES.admin.overview}</div>
            <div>{ROUTES.admin.suppliers}</div>
            <div>{ROUTES.admin.analytics}</div>
            <div>{ROUTES.admin.jobs}</div>
            <div>{ROUTES.admin.architecture}</div>
          </div>
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}
