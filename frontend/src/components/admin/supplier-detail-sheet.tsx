"use client";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SupplierSummary } from "@/types/admin";

type SupplierDetailSheetProps = {
  supplier: SupplierSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SupplierDetailSheet({
  supplier,
  open,
  onOpenChange,
}: SupplierDetailSheetProps) {
  if (!supplier) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{supplier.name}</SheetTitle>
          <SheetDescription>Supplier configuration and health</SheetDescription>
        </SheetHeader>
        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Website</dt>
            <dd className="mt-0.5">
              <a
                href={supplier.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline"
              >
                {supplier.websiteUrl}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Adapter key</dt>
            <dd className="mt-0.5 font-mono text-xs">{supplier.adapterKey}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="mt-1">
              <Badge>{supplier.status}</Badge>
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-muted-foreground">Products</dt>
              <dd className="mt-0.5 font-medium">{supplier.productCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Errors (24h)</dt>
              <dd className="mt-0.5 font-medium">{supplier.errors24h}</dd>
            </div>
          </div>
          <div className="space-y-2">
            <dt className="text-muted-foreground">Features</dt>
            <dd className="flex flex-wrap gap-2">
              <Badge variant={supplier.scrapeEnabled ? "default" : "secondary"}>
                Scrape {supplier.scrapeEnabled ? "enabled" : "disabled"}
              </Badge>
              <Badge
                variant={supplier.liveCheckEnabled ? "default" : "secondary"}
              >
                Live check {supplier.liveCheckEnabled ? "enabled" : "disabled"}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Config (read-only)</dt>
            <dd className="mt-1">
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
                {JSON.stringify(
                  {
                    slug: supplier.slug,
                    adapterKey: supplier.adapterKey,
                    scrapeEnabled: supplier.scrapeEnabled,
                    liveCheckEnabled: supplier.liveCheckEnabled,
                  },
                  null,
                  2
                )}
              </pre>
            </dd>
          </div>
        </dl>
        <p className="mt-6 text-xs text-muted-foreground">
          New suppliers require a scraper adapter in the codebase. Contact the
          dev team to add one.
        </p>
      </SheetContent>
    </Sheet>
  );
}
