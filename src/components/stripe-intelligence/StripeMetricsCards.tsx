import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { XRayTooltip } from "@/components/ui/x-ray-tooltip";
import {
  Wallet,
  Clock,
  TrendingUp,
  Repeat,
  Percent,
  XCircle,
} from "lucide-react";

interface StripeMetricsCardsProps {
  isLoading: boolean;
  metrics: any;
  payingCustomerCount: number;
  currency: string;
  formatCurrency: (amount: number, currency?: string) => string;
}

export const StripeMetricsCards = ({
  isLoading,
  metrics,
  payingCustomerCount,
  currency,
  formatCurrency,
}: StripeMetricsCardsProps) => {

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
      <XRayTooltip
        title="Total Revenue"
        insights={[
          {
            label: "Successful Payments",
            value: `${metrics.successfulPaymentsCount || 0} transactions`,
            color: "text-emerald-400",
          },
          {
            label: "Currency",
            value: currency.toUpperCase(),
          },
        ]}
        summary="Total successful charges for the selected period."
      >
        <Card className="card-dashboard">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-20 mt-1" />
                ) : (
                  <p className="text-lg font-bold font-mono text-success">
                    {formatCurrency(metrics.totalRevenue || 0, currency)}
                  </p>
                )}
              </div>
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
          </CardContent>
        </Card>
      </XRayTooltip>

      <XRayTooltip
        title="Net Revenue"
        insights={[
          {
            label: "Total Refunded",
            value: formatCurrency(metrics.totalRefunded || 0, currency),
            color: "text-rose-400",
          },
          {
            label: "Success Rate",
            value: `${metrics.successRate || 100}%`,
            color: "text-emerald-400",
          },
        ]}
        summary="Total successful charges minus refunds for the selected period."
      >
        <Card className="card-dashboard">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Net Revenue</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-20 mt-1" />
                ) : (
                  <p className="text-lg font-bold font-mono">
                    {formatCurrency(metrics.netRevenue || 0, currency)}
                  </p>
                )}
              </div>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
      </XRayTooltip>

      <XRayTooltip
        title="Paying Customers"
        insights={[
          {
            label: "Total Transactions",
            value: `${(metrics.successfulPaymentsCount || 0) + (metrics.failedPaymentsCount || 0)} attempts`,
          },
          {
            label: "Avg Revenue",
            value:
              payingCustomerCount > 0
                ? formatCurrency(
                    Math.round((metrics.totalRevenue || 0) / payingCustomerCount),
                    currency,
                  )
                : "N/A",
            color: "text-indigo-400",
          },
        ]}
        summary="Unique customers who have made successful payments."
      >
        <Card className="card-dashboard">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Paying Customers</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-20 mt-1" />
                ) : (
                  <p className="text-lg font-bold font-mono text-primary">
                    {payingCustomerCount || 0}
                  </p>
                )}
              </div>
              <Repeat className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>
      </XRayTooltip>

      <XRayTooltip
        title="Success Rate"
        insights={[
          {
            label: "Successful",
            value: `${metrics.successfulPaymentsCount || 0} payments`,
            color: "text-emerald-400",
          },
          {
            label: "Failed",
            value: `${metrics.failedPaymentsCount || 0} payments`,
            color: "text-rose-400",
          },
        ]}
        summary="Percentage of payment attempts that succeed. Below 95% may indicate card issues or fraud."
      >
        <Card className="card-dashboard">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Success Rate</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-16 mt-1" />
                ) : (
                  <p className="text-lg font-bold font-mono text-success">
                    {metrics.successRate || 100}%
                  </p>
                )}
              </div>
              <Percent className="h-5 w-5 text-success" />
            </div>
          </CardContent>
        </Card>
      </XRayTooltip>

      <XRayTooltip
        title="Total Refunded"
        insights={[
          {
            label: "Net Revenue",
            value: formatCurrency(metrics.netRevenue || 0, currency),
            color: "text-emerald-400",
          },
          {
            label: "Refund Impact",
            value: metrics.netRevenue
              ? `${(((metrics.totalRefunded || 0) / (metrics.netRevenue + (metrics.totalRefunded || 0))) * 100).toFixed(1)}%`
              : "0%",
            color: "text-rose-400",
          },
        ]}
        summary="Total amount returned to customers. Monitor closely — high refund rates can trigger Stripe risk reviews."
      >
        <Card className="card-dashboard">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Refunded</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-20 mt-1" />
                ) : (
                  <p className="text-lg font-bold font-mono text-destructive">
                    {formatCurrency(metrics.totalRefunded || 0, currency)}
                  </p>
                )}
              </div>
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </XRayTooltip>
    </div>
  );
};
