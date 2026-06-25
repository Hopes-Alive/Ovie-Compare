import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEMO_FLOW_ORDER, DEMO_SECTIONS } from "@/config/demo";
import { ROUTES } from "@/config/routes";

export function DemoPageContent() {
  return (
    <>
      <AdminPageHeader
        title="Demo hub"
        description="Organise stakeholder demos — follow the suggested flow or jump to any screen."
      />

      <Card className="mb-8 border-emerald-200 bg-emerald-50/50">
        <CardHeader>
          <CardTitle className="text-base">Suggested demo flow</CardTitle>
          <CardDescription>
            Walk through in order: clinic entry → chat → admin ops →
            architecture.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {DEMO_FLOW_ORDER.map((item) => (
              <li key={item.step} className="flex items-center gap-3">
                <Badge variant="outline" className="shrink-0">
                  {item.step}
                </Badge>
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link href={item.href} target="_blank" />}
                >
                  Open
                  <ExternalLink />
                </Button>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {DEMO_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className="size-5 text-muted-foreground" />
                  <CardTitle className="text-base">{section.title}</CardTitle>
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {section.steps.map((step) => (
                  <Link
                    key={step.href}
                    href={step.href}
                    target="_blank"
                    className="group flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium group-hover:underline">
                        {step.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-base">Route map</CardTitle>
          <CardDescription>
            All frontend routes defined in page-structure.md
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 font-mono text-xs sm:grid-cols-2">
            <div>{ROUTES.home} — Landing</div>
            <div>{ROUTES.chat} — Chat</div>
            <div>{ROUTES.demo} — Demo hub</div>
            <div>{ROUTES.admin.overview} — Admin overview</div>
            <div>{ROUTES.admin.suppliers} — Suppliers</div>
            <div>{ROUTES.admin.analytics} — Analytics</div>
            <div>{ROUTES.admin.jobs} — Jobs</div>
            <div>{ROUTES.admin.architecture} — Architecture</div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
