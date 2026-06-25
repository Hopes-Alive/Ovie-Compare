import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SupplierRow = {
  slug: string;
  name: string;
  is_active: boolean | null;
};

type ConnectedSuppliersProps = {
  suppliers: SupplierRow[] | null;
  dbConnected: boolean;
  errorMessage?: string;
};

export function ConnectedSuppliers({
  suppliers,
  dbConnected,
  errorMessage,
}: ConnectedSuppliersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected suppliers</CardTitle>
        <CardDescription>
          Suppliers currently integrated for price comparison.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!dbConnected ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Database not ready.</strong> Run the SQL migration in
            Supabase, then refresh.
            {errorMessage && (
              <p className="mt-1 text-xs opacity-80">{errorMessage}</p>
            )}
          </div>
        ) : suppliers && suppliers.length > 0 ? (
          <ul className="space-y-3">
            {suppliers.map((supplier) => (
              <li
                key={supplier.slug}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
              >
                <span className="font-medium">{supplier.name}</span>
                <Badge variant={supplier.is_active ? "default" : "secondary"}>
                  {supplier.is_active ? "Active" : "Inactive"}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No suppliers loaded yet. Seed data will appear here after the first
            scrape.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
