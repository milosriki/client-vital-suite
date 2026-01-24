import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Workflow, DollarSign, Database, Clock } from "lucide-react";
import { CriticalMetrics } from "./types";

interface MetricsGridProps {
  metrics: CriticalMetrics;
}

export const MetricsGrid = ({ metrics }: MetricsGridProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
          <Workflow className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalWorkflows}</div>
          <p className="text-xs text-muted-foreground">
            {metrics.activeWorkflows} active, {metrics.inactiveWorkflows}{" "}
            inactive
          </p>
          <Progress
            value={
              metrics.totalWorkflows > 0
                ? (metrics.activeWorkflows / metrics.totalWorkflows) * 100
                : 0
            }
            className="mt-2"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Revenue at Risk</CardTitle>
          <DollarSign className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            {(metrics.revenueAtRisk / 1000).toFixed(0)}K AED
          </div>
          <p className="text-xs text-muted-foreground">
            {(metrics.monthlyRevenueLoss / 1000).toFixed(0)}K AED/month loss
            rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Properties
          </CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalProperties}</div>
          <p className="text-xs text-muted-foreground">
            {metrics.contactProperties} contacts, {metrics.dealProperties} deals
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">SLA Breach Rate</CardTitle>
          <Clock className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            {metrics.slaBreachRate}%
          </div>
          <p className="text-xs text-muted-foreground">
            {metrics.blankLeadPercentage}% leads blank/null
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
