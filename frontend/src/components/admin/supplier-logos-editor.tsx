"use client";

import { CONNECTED_SUPPLIERS } from "@/config/nav";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChatDesignTheme } from "@/types/chat-design";

type SupplierLogosEditorProps = {
  theme: ChatDesignTheme;
  onLogoChange: (slug: string, logoUrl: string) => void;
};

export function SupplierLogosEditor({ theme, onLogoChange }: SupplierLogosEditorProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Supplier logos</CardTitle>
        <p className="text-sm text-muted-foreground">
          Logos appear on supplier sections and comparison cards in chat responses. Upload
          an image or paste a URL for each connected supplier.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {CONNECTED_SUPPLIERS.map((supplier) => (
          <div
            key={supplier.slug}
            className="rounded-lg border border-border/60 bg-muted/10 p-4"
          >
            <p className="mb-3 text-sm font-semibold text-foreground">{supplier.name}</p>
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
        ))}
      </CardContent>
    </Card>
  );
}
