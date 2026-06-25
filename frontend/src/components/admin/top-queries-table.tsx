import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockTopQueries } from "@/data/mock/admin";

export function TopQueriesTable() {
  // TODO: replace with useAdminTopQueries()
  const queries = mockTopQueries;

  return (
    <div className="rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Query</TableHead>
            <TableHead className="text-right">Count</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {queries.map((row) => (
            <TableRow key={row.rank}>
              <TableCell className="text-muted-foreground">{row.rank}</TableCell>
              <TableCell className="font-medium">{row.query}</TableCell>
              <TableCell className="text-right">{row.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
