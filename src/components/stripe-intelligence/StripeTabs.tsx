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

interface StripeTabsProps {
  activeTab: string;
  setActiveTab: (value: string) => void;
  isLoading: boolean;
  metrics: any;
  stripeData: any;
  payingCustomerCount: number;
  currency: string;
  formatCurrency: (amount: number, currency?: string) => string;
}

export const StripeTabs = ({
  activeTab,
  setActiveTab,
  isLoading,
  metrics,
  stripeData,
  payingCustomerCount,
  currency,
  formatCurrency,
}: StripeTabsProps) => {
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        <TabsTrigger value="payouts">Payouts</TabsTrigger>
        <TabsTrigger value="treasury">Treasury</TabsTrigger>
        <TabsTrigger value="customers">Customers</TabsTrigger>
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
              Payments ({stripeData?.payments?.length || 0})
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
              ) : stripeData?.payments?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No payments in selected period
                </p>
              ) : (
                <div className="space-y-2">
                  {stripeData?.payments?.map((payment: any) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-9 w-9 rounded-full flex items-center justify-center",
                            payment.status === "succeeded"
                              ? "bg-success/10"
                              : "bg-destructive/10",
                          )}
                        >
                          {payment.status === "succeeded" ? (
                            <CheckCircle className="h-4 w-4 text-success" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm font-mono">
                            {formatCurrency(payment.amount, payment.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(
                              new Date(payment.created * 1000),
                              "MMM d, yyyy HH:mm",
                            )}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          payment.status === "succeeded"
                            ? "default"
                            : "destructive"
                        }
                        className="text-xs"
                      >
                        {payment.status}
                      </Badge>

                      {/* Action Intercept: Refund or Retry */}
                      {payment.status === "succeeded" && (
                        <ActionIntercept
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive ml-2"
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span className="sr-only">Refund</span>
                            </Button>
                          }
                          title="Issue Refund?"
                          description={`Are you sure you want to refund ${formatCurrency(payment.amount, payment.currency)}? This action will reverse the transfer and cannot be undone.`}
                          variant="danger"
                          confirmText="Process Refund"
                          onConfirm={() => {
                            // TODO: Call refund API endpoint
                          }}
                        />
                      )}

                      {payment.status !== "succeeded" && (
                        <ActionIntercept
                          trigger={
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-primary ml-2"
                            >
                              <RefreshCw className="h-4 w-4" />
                              <span className="sr-only">Retry</span>
                            </Button>
                          }
                          title="Retry Payment?"
                          description="This will attempt to charge the customer's payment method again."
                          variant="warning"
                          confirmText="Retry Charge"
                          onConfirm={() => {
                            // TODO: Call payment retry API endpoint
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="subscriptions">
        <Card className="card-dashboard">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5" />
              Subscriptions ({stripeData?.subscriptions?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : stripeData?.subscriptions?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No subscriptions found
                </p>
              ) : (
                <div className="space-y-2">
                  {stripeData?.subscriptions?.map((sub: any) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "h-9 w-9 rounded-full flex items-center justify-center",
                            sub.status === "active"
                              ? "bg-success/10"
                              : sub.status === "trialing"
                                ? "bg-warning/10"
                                : "bg-destructive/10",
                          )}
                        >
                          <Repeat
                            className={cn(
                              "h-4 w-4",
                              sub.status === "active"
                                ? "text-success"
                                : sub.status === "trialing"
                                  ? "text-warning"
                                  : "text-destructive",
                            )}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {sub.items?.data?.[0]?.price?.product ||
                              "Subscription"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(
                              new Date(sub.current_period_end * 1000),
                              "MMM d, yyyy",
                            )}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          sub.status === "active"
                            ? "default"
                            : sub.status === "trialing"
                              ? "secondary"
                              : "destructive"
                        }
                        className="text-xs"
                      >
                        {sub.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="payouts">
        <Card className="card-dashboard">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownRight className="h-5 w-5" />
              Payouts ({stripeData?.payouts?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : stripeData?.payouts?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No payouts in selected period
                </p>
              ) : (
                <div className="space-y-2">
                  {stripeData?.payouts?.map((payout: any) => (
                    <div
                      key={payout.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <ArrowDownRight className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm font-mono">
                            {formatCurrency(payout.amount, payout.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(
                              new Date(payout.arrival_date * 1000),
                              "MMM d, yyyy",
                            )}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {payout.status}
                      </Badge>
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
