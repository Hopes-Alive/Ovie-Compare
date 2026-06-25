import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { mockOverviewStats } from "@/data/mock/admin";

export function OverviewCards() {
  // TODO: replace with useAdminOverview()
  const stats = mockOverviewStats;

  const cards = [
    { label: "Active suppliers", value: String(stats.activeSuppliers) },
    { label: "Products indexed", value: stats.totalProducts.toLocaleString() },
    { label: "Last scrape", value: stats.lastScrapeAgo },
    { label: "Failed jobs (24h)", value: String(stats.failedJobs24h) },
    { label: "Searches today", value: String(stats.searchesToday) },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
