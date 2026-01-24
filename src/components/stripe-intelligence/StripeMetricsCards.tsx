import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  balance: any;
  metrics: any;
  payingCustomerCount: number;
  currency: string;
  formatCurrency: (amount: number, currency?: string) => string;
}

export const StripeMetricsCards = ({
  isLoading,
  balance,
  metrics,
  payingCustomerCount,
  currency,
  formatCurrency,
}: StripeMetricsCardsProps) => {
  const availableBalance = balance?.available?.[0]?.amount || 0;
  const pendingBalance = balance?.pending?.[0]?.amount || 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <Card className="card-dashboard">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Available</p>
              {isLoading ? (
                <Skeleton className="h-6 w-20 mt-1" />
              ) : (
                <p className="text-lg font-bold font-mono text-success">
                  {formatCurrency(availableBalance, currency)}
                </p>
              )}
            </div>
            <Wallet className="h-5 w-5 text-success" />
          </div>
        </CardContent>
      </Card>

      <Card className="card-dashboard">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              {isLoading ? (
                <Skeleton className="h-6 w-20 mt-1" />
              ) : (
                <p className="text-lg font-bold font-mono text-warning">
                  {formatCurrency(pendingBalance, currency)}
                </p>
              )}
            </div>
            <Clock className="h-5 w-5 text-warning" />
          </div>
        </CardContent>
      </Card>

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

      <Card className="card-dashboard">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">MRR</p>
              {isLoading ? (
                <Skeleton className="h-6 w-20 mt-1" />
              ) : (
                <p className="text-lg font-bold font-mono text-primary">
                  {formatCurrency(metrics.mrr || 0, currency)}
                </p>
              )}
            </div>
            <Repeat className="h-5 w-5 text-primary" />
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
};
