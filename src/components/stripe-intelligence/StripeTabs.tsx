import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CreditCard,
  Repeat,
  ArrowDownRight,
  CheckCircle,
  XCircle,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionIntercept } from "@/components/ui/action-intercept";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  stripe_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  description: string | null;
  created_at: string;
  contact_id: string | null;
  customer_id: string | null;
  metadata: any;
}

interface StripeTabsProps {
  activeTab: string;
  setActiveTab: (value: string) => void;
  isLoading: boolean;
  metrics: any;
  transactions: Transaction[];
  payingCustomerCount: number;
  currency: string;
  formatCurrency: (amount: number, currency?: string) => string;
}

export const StripeTabs = ({
  activeTab,
  setActiveTab,
  isLoading,
  metrics,
  transactions,
  payingCustomerCount,
  currency,
  formatCurrency,
}: StripeTabsProps) => {
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <Card className="card-dashboard">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Period Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(metrics.totalRevenue || 0, currency)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">Total Payouts</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(metrics.totalPayouts || 0, currency)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Successful Payments
                  </p>
                  <p className="text-xl font-bold text-success">
                    {metrics.successfulPaymentsCount || 0}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Failed Payments
                  </p>
                  <p className="text-xl font-bold text-destructive">
                    {metrics.failedPaymentsCount || 0}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Active Subscriptions
                  </p>
                  <p className="text-xl font-bold">
                    {metrics.activeSubscriptions || 0}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Paying Customers
                  </p>
                  <p className="text-xl font-bold">
                    {payingCustomerCount || 0}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="payments">
        <Card className="card-dashboard">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payments ({transactions.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No payments in selected period
                </p>
              ) : (
                <div className="space-y-2">
                  {transactions.map((transaction: Transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-9 w-9 rounded-full flex items-center justify-center",
                            transaction.status === "succeeded" ||
                              transaction.status === "paid"
                              ? "bg-success/10"
                              : "bg-destructive/10",
                          )}
                        >
                          {transaction.status === "succeeded" ||
                          transaction.status === "paid" ? (
                            <CheckCircle className="h-4 w-4 text-success" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm font-mono">
                            {formatCurrency(
                              transaction.amount,
                              transaction.currency,
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(
                              new Date(transaction.created_at),
                              "MMM d, yyyy HH:mm",
                            )}
                          </p>
                          {transaction.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {transaction.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            transaction.status === "succeeded" ||
                            transaction.status === "paid"
                              ? "default"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          {transaction.status}
                        </Badge>
                        {transaction.payment_method && (
                          <Badge variant="outline" className="text-xs">
                            {transaction.payment_method}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>

    </Tabs>
  );
};
