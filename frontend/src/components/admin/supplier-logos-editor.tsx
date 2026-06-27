"use client";

import { CONNECTED_SUPPLIERS } from "@/config/nav";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChatDesignTheme } from "@/types/chat-design";

type SupplierLogosEditorProps = {
  theme: ChatDesignTheme;
  onLogoChange: (slug: string, logoUrl: string) => void;
};

export function SupplierLogosEditor({ theme, onLogoChange }: SupplierLogosEditorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Supplier logos</CardTitle>
        <CardDescription>
          Logos appear on supplier sections and comparison cards in chat responses.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {CONNECTED_SUPPLIERS.map((supplier) => {
          const hasLogo = Boolean(theme.supplierLogos?.[supplier.slug]);

          return (
            <div
              key={supplier.slug}
              className="rounded-xl border border-border/60 bg-muted/10 p-4 transition-colors hover:border-border"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{supplier.name}</p>
                {hasLogo ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                    Set
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Default
                  </span>
                )}
              </div>
              <ImageUploadField
                label="Logo"
                kind="supplier-logo"
                supplierSlug={supplier.slug}
                value={theme.supplierLogos?.[supplier.slug] ?? ""}
                onChange={(logoUrl) => onLogoChange(supplier.slug, logoUrl)}
                hint={`Used wherever ${supplier.name} appears in product results.`}
                preview="logo"
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
