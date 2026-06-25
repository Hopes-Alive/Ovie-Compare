"use client";

import Link from "next/link";
import { useState } from "react";

import { SupplierDetailSheet } from "@/components/admin/supplier-detail-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/config/routes";
import { mockSuppliers } from "@/data/mock/admin";
import type { SupplierStatus, SupplierSummary } from "@/types/admin";

function statusVariant(status: SupplierStatus) {
  switch (status) {
    case "active":
      return "default" as const;
    case "disabled":
      return "secondary" as const;
    case "planned":
      return "outline" as const;
  }
}

function statusLabel(status: SupplierStatus) {
  switch (status) {
    case "active":
      return "Active";
    case "disabled":
      return "Disabled";
    case "planned":
      return "Planned";
  }
}

export function SupplierTable() {
  // TODO: replace with useAdminSuppliers()
  const suppliers = mockSuppliers;
  const [selected, setSelected] = useState<SupplierSummary | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function openDetail(supplier: SupplierSummary) {
    setSelected(supplier);
    setSheetOpen(true);
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead>Last check</TableHead>
              <TableHead className="text-right">Errors (24h)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow key={supplier.slug}>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => openDetail(supplier)}
                    className="text-left hover:underline"
                  >
                    <p className="font-medium">{supplier.name}</p>
                    <span className="text-xs text-muted-foreground">
                      {supplier.websiteUrl.replace(/^https?:\/\//, "")}
                    </span>
                  </button>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(supplier.status)}>
                    {statusLabel(supplier.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {supplier.productCount > 0 ? supplier.productCount : "—"}
                </TableCell>
                <TableCell>{supplier.lastCheckAgo}</TableCell>
                <TableCell className="text-right">{supplier.errors24h}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDetail(supplier)}
                    >
                      Details
                    </Button>
                    {supplier.status === "active" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={ROUTES.admin.jobs} />}
                      >
                        Jobs
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          To add a new supplier, a scraper adapter must be deployed in the
          codebase. Contact the dev team.
        </p>
      </div>
      <SupplierDetailSheet
        supplier={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
