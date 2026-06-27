"use client";

import { ArrowUpRight, Building2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
export type OverviewSupplier = {
  slug: string;
  name: string;
  base_url: string;
  is_active: boolean | null;
};

type OverviewSuppliersSheetProps = {
  suppliers: OverviewSupplier[];
  activeCount: number;
};

function statusLabel(isActive: boolean | null) {
  return isActive ? "Available" : "Unavailable";
}

export function OverviewSuppliersSheet({
  suppliers,
  activeCount,
}: OverviewSuppliersSheetProps) {
  const availableSuppliers = suppliers.filter((s) => s.is_active);

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            className="h-12 w-full justify-between rounded-xl border-[#E5E3DF] bg-white px-4 text-[15px] font-medium text-[#1A1A1A] shadow-sm transition-all duration-300 hover:border-[#10B981]/40 hover:bg-[#FAF9F7] hover:shadow-md"
          />
        }
      >
        <span className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#ECFDF5]">
            <Building2 className="size-4 text-[#10B981]" />
          </span>
          Available suppliers
        </span>
        <Badge className="rounded-full bg-[#1A1A1A] px-2.5 text-white hover:bg-[#1A1A1A]">
          {activeCount} live
        </Badge>
      </SheetTrigger>

      <SheetContent className="w-full border-[#E5E3DF] bg-[#FAF9F7] sm:max-w-md">
        <SheetHeader className="border-b border-[#E5E3DF] pb-4">
          <SheetTitle className="text-[18px] font-semibold text-[#1A1A1A]">
            Suppliers available now
          </SheetTitle>
          <SheetDescription className="text-[14px] text-[#A8A39B]">
            Active data sources clinics can compare in chat today.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {availableSuppliers.length > 0 ? (
            availableSuppliers.map((supplier) => (
              <div
                key={supplier.slug}
                className="rounded-2xl border border-[#E5E3DF] bg-white p-4 shadow-sm transition-colors duration-300 hover:border-[#D9D6D2]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#1A1A1A]">
                      {supplier.name}
                    </p>
                    <a
                      href={supplier.base_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[13px] text-[#10B981] hover:underline"
                    >
                      {supplier.base_url.replace(/^https?:\/\//, "")}
                      <ArrowUpRight className="size-3.5 shrink-0" />
                    </a>
                  </div>
                  <Badge className="shrink-0 rounded-full bg-[#ECFDF5] text-[#047857] hover:bg-[#ECFDF5]">
                    {statusLabel(supplier.is_active)}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[#E5E3DF] bg-white px-4 py-8 text-center">
              <p className="text-[14px] font-medium text-[#1A1A1A]">
                No active suppliers
              </p>
              <p className="mt-1 text-[13px] text-[#A8A39B]">
                No suppliers are currently enabled for chat.
              </p>
            </div>
          )}

          {suppliers.some((s) => !s.is_active) && (
            <div className="rounded-2xl border border-[#E5E3DF] bg-white/70 p-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-[#A8A39B]">
                Inactive
              </p>
              <ul className="mt-2 space-y-2">
                {suppliers
                  .filter((s) => !s.is_active)
                  .map((supplier) => (
                    <li
                      key={supplier.slug}
                      className="flex items-center justify-between text-[14px] text-[#66625E]"
                    >
                      <span>{supplier.name}</span>
                      <Badge variant="secondary">Off</Badge>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
