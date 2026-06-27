"use client";

import Link from "next/link";
import { useState } from "react";

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
import { AdminTableCard } from "@/components/admin/shell/admin-table-card";
import { SupplierDetailSheet } from "@/components/admin/supplier-detail-sheet";
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
  const suppliers = mockSuppliers;
  const [selected, setSelected] = useState<SupplierSummary | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function openDetail(supplier: SupplierSummary) {
    setSelected(supplier);
    setSheetOpen(true);
  }

  return (
    <>
      <AdminTableCard
        footer={
          <>
            To add a new supplier, a scraper adapter must be deployed in the
            codebase. Contact the dev team.
          </>
        }
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[var(--admin-muted)]">Supplier</TableHead>
              <TableHead className="text-[var(--admin-muted)]">Status</TableHead>
              <TableHead className="text-right text-[var(--admin-muted)]">
                Products
              </TableHead>
              <TableHead className="text-[var(--admin-muted)]">Last check</TableHead>
              <TableHead className="text-right text-[var(--admin-muted)]">
                Errors (24h)
              </TableHead>
              <TableHead className="text-right text-[var(--admin-muted)]">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow
                key={supplier.slug}
                className="hover:bg-[var(--admin-bg)]/70"
              >
                <TableCell>
                  <button
                    type="button"
                    onClick={() => openDetail(supplier)}
                    className="text-left hover:underline"
                  >
                    <p className="font-medium text-[var(--admin-foreground)]">
                      {supplier.name}
                    </p>
                    <span className="text-xs text-[var(--admin-muted)]">
                      {supplier.websiteUrl.replace(/^https?:\/\//, "")}
                    </span>
                  </button>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(supplier.status)}>
                    {statusLabel(supplier.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {supplier.productCount > 0 ? supplier.productCount : "—"}
                </TableCell>
                <TableCell>{supplier.lastCheckAgo}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {supplier.errors24h}
                </TableCell>
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
      </AdminTableCard>
      <SupplierDetailSheet
        supplier={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
