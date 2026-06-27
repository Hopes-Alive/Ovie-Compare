import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupplierDisplayName } from "@/lib/suppliers/display-name";
import type { ProductCardData, StockStatus } from "@/types/chat";

function stockLabel(status: StockStatus): string {
  switch (status) {
    case "in_stock":
      return "In stock";
    case "out_of_stock":
      return "Out of stock";
    case "low_stock":
      return "Low stock";
    case "unknown":
      return "Unknown";
  }
}

type ComparisonTableProps = {
  products: ProductCardData[];
};

export function ComparisonTable({ products }: ComparisonTableProps) {
  if (products.length < 2) return null;

  return (
    <div className="hidden rounded-xl border border-border bg-card md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Supplier</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Stock</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Checked</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="font-medium">
                {getSupplierDisplayName(product.supplier_slug, product.supplier)}
              </TableCell>
              <TableCell className="max-w-xs truncate">{product.name}</TableCell>
              <TableCell>
                ${product.price.toFixed(2)} {product.currency}
              </TableCell>
              <TableCell>{stockLabel(product.stockStatus)}</TableCell>
              <TableCell>{product.deliveryText}</TableCell>
              <TableCell className="text-muted-foreground">
                {product.lastCheckedAgo}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
