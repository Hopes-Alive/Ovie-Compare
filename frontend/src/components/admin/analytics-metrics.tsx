import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { mockAnalyticsMetrics } from "@/data/mock/admin";

export function AnalyticsMetrics() {
  // TODO: replace with useAdminAnalytics()
  const metrics = mockAnalyticsMetrics;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {metric.label}
            </CardTitle>
            {metric.description && (
              <CardDescription>{metric.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{metric.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
