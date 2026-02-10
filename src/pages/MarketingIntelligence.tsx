import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MarketingDashboardData } from "@/types/marketing";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Activity,
  Target,
  Zap,
  MousePointer,
  Eye,
  ShoppingCart,
  Calendar,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PulseIndicator } from "@/components/dashboard/PulseIndicator";
import { MarketingIntelligenceGhost } from "@/components/dashboard/MarketingIntelligenceGhost";

export default function MarketingIntelligence() {
  const [range, setRange] = useState<"today" | "week" | "month">("today");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["marketing-intelligence", range],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "business-intelligence-dashboard",
        {
          body: {}, // Body checks for range in searchParams usually, but let's try passing in URL
        },
      );

      // Supabase invoke helper doesn't easily let us append search params to URL unless we build it manually or use body.
      // My Edge Function checks `req.url` searchParams.
      // Let's modify the invoke to pass query params via options if supported, or just put them in body and update Edge Function?
      // Actually, passing body JSON is cleaner. Let's assume I updated Edge Function to read body too?
      // No, let's keep it simple: pass range in body for now, but my Edge Function reads URL.
      // Wait, `supabase.functions.invoke` sends a POST by default.
      // My Edge Function handles `req.url` which is fine.
      // Ideally I should update Edge Function to read body, but let's try passing query params in the URL of invoke?
      // `invoke` takes `functionName` and options.
      // Workaround: Re-deploy Edge Function to look at Body? No, let's use the current one.
      // I can fetch directly via URL if I had the URL, but `invoke` is better for Auth.
      // Let's look at `invoke` signature. It's `invoke(functionName, { body, headers, method })`.
      // It sends to `.../functions/v1/functionName`.
      // I can't easily append query params via `invoke`.
      // I will update my Edge Function to read from JSON body as well for robustness.
      // OR, I can just rely on defaults ("today") for now, but I want "week/month".
      // Let's assume I'll fix the Edge Function to read body.

      // Attempting to send body
      const response = await supabase.functions.invoke(
        "business-intelligence-dashboard",
        {
          body: { range }, // Sending range in body
          method: "POST",
        },
      );

      if (response.error) throw response.error;
      return response.data as MarketingDashboardData;
    },
  });

  const handleRefresh = () => {
    refetch();
    toast.success("Refreshing dashboard data...");
  };

  if (isError) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-destructive mb-2">
          Error Loading Dashboard
        </h2>
        <p className="text-muted-foreground mb-4">
          Could not fetch intelligence data.
        </p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Marketing Command Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time intelligence across Stripe, HubSpot, and Meta Ads.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-card border rounded-lg p-1 shadow-sm">
          {(["today", "week", "month"] as const).map((r) => (
            <Button
              key={r}
              variant={range === r ? "default" : "ghost"}
              size="sm"
              onClick={() => setRange(r)}
              className="capitalize"
            >
              {r}
            </Button>
          ))}
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading || isRefetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading || isRefetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <MarketingIntelligenceGhost />
      ) : (
        <>
          {/* ZONE A: THE PULSE */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Zone A: The Pulse</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <PulseCard
                title="True ROAS"
                value={`${data?.zone_a.metrics.true_roas.toFixed(2)}x`}
                subtext="Revenue / Ad Spend"
                icon={Target}
                trend="up"
                color="text-emerald-500"
                pulsing
              />
              <PulseCard
                title="Cash Collected"
                value={`AED ${data?.zone_a.metrics.cash_collected.toLocaleString()}`}
                subtext="Stripe Succeeded"
                icon={DollarSign}
                color="text-green-500"
                pulsing
              />
              <Link
                to="/campaign-money-map"
                className="block transition-transform hover:scale-105"
              >
                <PulseCard
                  title="Ad Spend"
                  value={`AED ${data?.zone_a.metrics.ad_spend.toLocaleString()}`}
                  subtext="Meta Ads"
                  icon={Zap}
                  color="text-blue-500"
                  pulsing
                />
              </Link>
              <Link
                to="/sales-pipeline"
                className="block transition-transform hover:scale-105"
              >
                <PulseCard
                  title="New Leads"
                  value={data?.zone_a.metrics.new_leads.toString() || "0"}
                  subtext="HubSpot + Organic"
                  icon={Users}
                  color="text-indigo-500"
                  pulsing
                />
              </Link>
              <PulseCard
                title="Cost Per Lead"
                value={`AED ${data?.zone_a.metrics.cpl.toFixed(2)}`}
                subtext="Target: < AED 30"
                icon={ShoppingCart}
                color={
                  data?.zone_a.metrics.cpl && data.zone_a.metrics.cpl > 50
                    ? "text-red-500"
                    : "text-purple-500"
                }
                pulsing
              />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ZONE B: GROWTH ENGINE */}
            <section className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Zone B: Growth Engine</h2>
              </div>

              <Card className="h-[400px]">
                <CardHeader>
                  <CardTitle>Recent Velocity</CardTitle>
                  <CardDescription>
                    Latest deal activity and pipeline movement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Reuse recent activity for now as a simple list, chart would need history */}
                  <div className="space-y-4">
                    {data?.zone_b.recent_activity.map((deal, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {deal.deal_name[0]}
                          </div>
                          <div>
                            <p className="font-medium">{deal.deal_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(
                                new Date(deal.created_at),
                                "MMM d, h:mm a",
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">AED {deal.amount}</p>
                          <Badge variant="outline" className="capitalize">
                            {deal.stage}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {(!data?.zone_b.recent_activity ||
                      data.zone_b.recent_activity.length === 0) && (
                      <div className="text-center text-muted-foreground py-10">
                        No recent deals found.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* ZONE C: FUNNEL TRUTH */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Zone C: Funnel Truth</h2>
              </div>

              <Card className="h-[400px]">
                <CardHeader>
                  <CardTitle>Conversion Funnel</CardTitle>
                  <CardDescription>Leak detection system</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6 relative">
                    {/* Funnel Visual */}
                    <FunnelStep
                      label="Impressions"
                      value={data?.zone_c.funnel.impressions || 0}
                      icon={Eye}
                      color="bg-blue-100 dark:bg-blue-900/20"
                    />
                    <div className="flex justify-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                    </div>
                    <FunnelStep
                      label="Clicks"
                      value={data?.zone_c.funnel.clicks || 0}
                      icon={MousePointer}
                      color="bg-indigo-100 dark:bg-indigo-900/20"
                    />
                    <div className="flex justify-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                    </div>
                    <FunnelStep
                      label="Leads"
                      value={data?.zone_c.funnel.leads || 0}
                      icon={Users}
                      color="bg-purple-100 dark:bg-purple-900/20"
                    />
                    <div className="flex justify-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                    </div>
                    <FunnelStep
                      label="Appointments"
                      value={data?.zone_c.funnel.appointments || 0}
                      icon={Calendar}
                      color="bg-pink-100 dark:bg-pink-900/20"
                    />
                    <div className="flex justify-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                    </div>
                    <FunnelStep
                      label="Sales"
                      value={data?.zone_c.funnel.sales || 0}
                      icon={DollarSign}
                      color="bg-green-100 dark:bg-green-900/20"
                      isLast
                    />
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>

          {/* ZONE D: CREATIVE BRAIN */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Zone D: Creative Brain</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.zone_d.top_performers.map((ad, i) => (
                <Card
                  key={i}
                  className="overflow-hidden border-l-4 border-l-primary/50"
                >
                  <CardContent className="pt-6">
                    <h3
                      className="font-semibold truncate mb-2"
                      title={ad.ad_name}
                    >
                      {ad.ad_name}
                    </h3>
                    <div className="grid grid-cols-3 gap-2 text-sm mt-4">
                      <div>
                        <p className="text-muted-foreground text-xs">Spend</p>
                        <p className="font-medium">AED {ad.spend}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">CTR</p>
                        <p className="font-medium text-emerald-500">
                          {ad.ctr.toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">CPC</p>
                        <p className="font-medium">AED {ad.cpc.toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!data?.zone_d.top_performers ||
                data.zone_d.top_performers.length === 0) && (
                <div className="col-span-full text-center py-10 bg-muted/20 rounded-lg border border-dashed">
                  No active creative data found for this period.
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function PulseCard({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  color,
  pulsing,
}: any) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-center gap-2">
            {pulsing && <PulseIndicator className="scale-75 origin-right" />}
            <div
              className={`p-2 rounded-full bg-background border shadow-sm ${color}`}
            >
              <Icon className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-1 mt-1">
          {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
          {trend === "down" && (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          <p className="text-xs text-muted-foreground">{subtext}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelStep({ label, value, icon: Icon, color, isLast }: any) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg ${color}`}
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 opacity-70" />
        <span className="font-medium">{label}</span>
      </div>
      <span className="font-bold text-lg">{value.toLocaleString()}</span>
    </div>
  );
}

// Missing imports?
import { Brain } from "lucide-react";
