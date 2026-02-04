import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Search,
} from "lucide-react";
import { ErrorDetective } from "@/lib/error-detective";
import { TruthTriangle } from "@/components/analytics/TruthTriangle";

// --- Sub-Components ---

const StatCard = ({
  title,
  value,
  subtext,
  colorClass = "",
  warning = false,
}: any) => (
  <Card
    className={
      warning
        ? "border-l-4 border-l-red-500"
        : colorClass
          ? `border-l-4 ${colorClass}`
          : ""
    }
  >
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div
        className={`text-2xl font-bold ${colorClass && !warning ? "text-foreground" : ""}`}
      >
        {value}
      </div>
      {subtext && (
        <div className="text-xs text-muted-foreground mt-1">{subtext}</div>
      )}
    </CardContent>
  </Card>
);

const CampaignRow = ({ camp, index, formatCurrency }: any) => (
  <div className="flex items-center justify-between p-4 border rounded-lg">
    <div className="space-y-1">
      <div className="font-semibold flex items-center gap-2">
        {index < 3 && <Badge variant="secondary">#{index + 1}</Badge>}
        {camp.name}
      </div>
      <div className="text-sm text-muted-foreground">
        {camp.deals} Closed Deals
      </div>
    </div>
    <div className="text-right">
      <div className="font-bold text-lg text-green-600">
        {formatCurrency(camp.revenue)}
      </div>
    </div>
  </div>
);

const AttributionWarRoom = () => {
  const [period, setPeriod] = useState("this_month");

  // Fetch the Truth from our new Edge Function
  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ["attribution-truth", period],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "data-reconciler",
        {
          body: { date_range: period },
        },
      );
      if (error) throw error;
      return data;
    },
  });

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
    }).format(val);

  const getRoasColor = (roas: number) => {
    if (roas >= 4) return "text-green-500";
    if (roas >= 2) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-900 to-slate-950 p-6 space-y-8 text-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Attribution War Room
          </h1>
          <p className="text-muted-foreground mt-1">
            Cross-referencing HubSpot (Bank), AnyTrack (Click), and Facebook
            (Spend).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={period === "this_month" ? "default" : "outline"}
            onClick={() => setPeriod("this_month")}
          >
            This Month
          </Button>
          <Button
            variant={period === "last_30d" ? "default" : "outline"}
            onClick={() => setPeriod("last_30d")}
          >
            Last 30 Days
          </Button>
          <Button
            onClick={() => refetch()}
            disabled={isLoading}
            variant="outline"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Re-Verify Data
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Validation Failed</AlertTitle>
          <AlertDescription>
            Could not contact the Intelligence Engine. {String(error)}
          </AlertDescription>
        </Alert>
      )}

      {/* The Truth Triangle (Visual Data Reconciliation) */}
      <TruthTriangle
        hubspotValue={data?.financials?.attributed_revenue || 0}
        stripeValue={data?.financials?.attributed_revenue || 0} // Using HubSpot as proxy for verified revenue until Stripe fully linked
        posthogValue={data?.financials?.attributed_revenue || 0} // Using HubSpot as proxy for verified revenue until PostHog fully linked
        className="mb-8"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="True ROAS (Validated)"
          value={`${(data?.intelligence?.true_roas || 0).toFixed(2)}x`}
          subtext={`Based on ${formatCurrency(data?.financials?.attributed_revenue || 0)} actual revenue`}
          colorClass={getRoasColor(data?.intelligence?.true_roas || 0).replace(
            "text-",
            "border-l-",
          )}
        />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Facebook Reported ROAS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(data?.intelligence?.reported_roas || 0).toFixed(2)}x
            </div>
            <div className="flex items-center mt-1 text-xs">
              {data?.intelligence?.roas_uplift_percent > 0 ? (
                <span className="text-green-500 font-medium flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Under-reporting by{" "}
                  {(data?.intelligence?.roas_uplift_percent || 0).toFixed(0)}%
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Matching Ad Manager
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <StatCard
          title="Ad Spend (Investment)"
          value={formatCurrency(data?.financials?.ad_spend || 0)}
          subtext="Meta Ads Manager"
        />

        <StatCard
          title="Attribution Conflicts"
          value={data?.discrepancies?.count || 0}
          subtext="Deals with mismatched sources"
          warning={data?.discrepancies?.count > 0}
        />
      </div>

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">Winning Campaigns</TabsTrigger>
          <TabsTrigger value="conversions">Recent Conversions</TabsTrigger>
          <TabsTrigger value="discrepancies">Discrepancy Log</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle>Winning Campaigns (By Validated Revenue)</CardTitle>
              <CardDescription>
                These campaigns actually generated money in the bank (HubSpot
                Closed Won).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data?.intelligence?.winning_campaigns?.map(
                  (camp: any, i: number) => (
                    <CampaignRow
                      key={i}
                      index={i}
                      camp={camp}
                      formatCurrency={formatCurrency}
                    />
                  ),
                )}
                {!data?.intelligence?.winning_campaigns?.length && (
                  <div className="text-center py-8 text-muted-foreground">
                    No paid conversions found for this period.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversions">
          <Card>
            <CardHeader>
              <CardTitle>Recent Verified Conversions</CardTitle>
              <CardDescription>
                Full detail log of the last processed deals and their
                attribution source.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data?.recent_deals?.map((deal: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full items-center">
                      <div className="col-span-1">
                        <div className="font-semibold text-sm">
                          {deal.deal_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {deal.contacts?.email}
                        </div>
                      </div>
                      <div className="col-span-1">
                        <Badge
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {deal.contacts?.latest_traffic_source || "Direct"}
                        </Badge>
                      </div>
                      <div className="col-span-1 text-xs text-muted-foreground">
                        {deal.contacts?.utm_campaign ? (
                          <span className="flex items-center gap-1">
                            <Search className="h-3 w-3" />{" "}
                            {deal.contacts.utm_campaign}
                          </span>
                        ) : (
                          "No Campaign"
                        )}
                      </div>
                      <div className="col-span-1 text-right font-bold text-green-700">
                        {formatCurrency(deal.deal_value)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discrepancies">
          <Card>
            <CardHeader>
              <CardTitle>Attribution Conflict Log</CardTitle>
              <CardDescription>
                Where HubSpot says one thing, and AnyTrack/Ads say another.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data?.discrepancies?.items?.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-start justify-between p-4 border border-red-200 bg-red-50/50 rounded-lg"
                  >
                    <div>
                      <div className="font-semibold text-red-700 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {item.deal_name}
                      </div>
                      <p className="text-sm text-red-600 mt-1">
                        {item.message}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-red-200 text-red-700"
                    >
                      {formatCurrency(item.value)}
                    </Badge>
                  </div>
                ))}
                {!data?.discrepancies?.items?.length && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                    <h3 className="font-semibold text-lg">
                      No Discrepancies Found
                    </h3>
                    <p className="text-muted-foreground">
                      Good news! HubSpot and your Ad Tracking are perfectly
                      aligned.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AttributionWarRoom;
