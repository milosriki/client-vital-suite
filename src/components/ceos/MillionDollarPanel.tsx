import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface MetricCardProps {
  title: string;
  value: string;
  subtext: string;
  trend?: "up" | "down" | "neutral";
  icon: React.ReactNode;
  loading?: boolean;
}

function MetricCard({
  title,
  value,
  subtext,
  trend,
  icon,
  loading,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="bg-card/50 backdrop-blur-sm border-muted hover:border-primary/30 transition-colors group">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {title}
              </p>
              {loading ? (
                <div className="h-9 flex items-center">
                  <div className="w-24 h-6 bg-muted animate-pulse rounded" />
                </div>
              ) : (
                <motion.h3
                  key={value}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-3xl font-bold tracking-tight"
                >
                  {value}
                </motion.h3>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {trend === "up" && (
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                )}
                {trend === "down" && (
                  <TrendingDown className="w-3 h-3 text-rose-500" />
                )}
                {subtext}
              </p>
            </div>
            <div className="p-2 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform">
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function MillionDollarPanel() {
  const [loading, setLoading] = useState(true);
  const [adSpend, setAdSpend] = useState<{
    amount: number;
    currency: string;
  } | null>(null);
  const [revenue, setRevenue] = useState<{
    amount: number;
    currency: string;
  } | null>(null);
  const [leads, setLeads] = useState<number>(0);
  const [roas, setRoas] = useState<number>(0);

  const refreshData = async () => {
    setLoading(true);
    try {
      // Use the centralized get_dashboard_stats RPC
      const { data: stats, error } = await (supabase.rpc as any)(
        "get_dashboard_stats",
      );

      if (error) throw error;

      // Extract values from RPC
      const revenueVal = (stats as any).revenue_this_month || 0;
      const trendVal = (stats as any).revenue_trend || 0;
      const pipelineVal = (stats as any).pipeline_value || 0;

      setRevenue({ amount: revenueVal, currency: "AED" });

      // We still fetch ad spend from the Meta function if possible
      const { data: fbData } = await supabase.functions.invoke(
        "fetch-facebook-insights",
        {
          body: { date_preset: "today" },
        },
      );

      const spend = fbData?.total_spend || 0;
      setAdSpend({ amount: spend, currency: fbData?.currency || "AED" });

      // Leads today (keep direct for now as it's efficient)
      const { count: leadCount } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .gte(
          "created_at",
          new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
        );

      setLeads(leadCount || 0);

      // Compute ROAS
      const calculatedRoas = spend > 0 ? revenueVal / spend : 0;
      setRoas(calculatedRoas);
    } catch (e) {
      console.error("Dashboard Sync Failed", e);
      toast.error("Failed to sync Million Dollar Data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // DECISION LOGIC
  const hasData =
    adSpend && revenue && (adSpend.amount > 0 || revenue.amount > 0);

  const decisionColor = !hasData
    ? "bg-slate-500"
    : roas >= 3
      ? "bg-emerald-500"
      : roas >= 1.5
        ? "bg-yellow-500"
        : "bg-rose-500";

  const decisionText = !hasData
    ? "WAITING FOR DATA ⏳"
    : roas >= 3
      ? "SCALE AGGRESSIVELY 🚀"
      : roas >= 1.5
        ? "OPTIMIZE & HOLD 🔧"
        : "STOP / KILL ADS 🛑";

  const decisionSubtext = !hasData
    ? "System is syncing Ad Spend & Revenue. Check back in 5 minutes."
    : roas >= 3
      ? "You are printing money. For every $1 in, you get $" +
        roas.toFixed(2) +
        " out."
      : roas >= 1.5
        ? "Profitable, but margins are tight. Improve creatives before scaling."
        : "You are losing money. Turn off the campaigns immediately.";

  return (
    <Card className="border-primary/20 bg-background/50 shadow-2xl relative overflow-hidden">
      {/* Background Pulse for "Live" feeling */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-primary to-emerald-500 animate-pulse" />

      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Zap className="w-6 h-6 text-yellow-500 fill-yellow-500" />
              THE MILLION DOLLAR DASHBOARD
            </CardTitle>
            <CardDescription>
              Real-Time Decision Engine • Ad Spend vs. Actual Cash •{" "}
              <span className="text-emerald-500 font-bold">ROAS Focus</span>
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              "Refresh Live Data"
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* TOP ROW: THE TRIANGLE (Spend -> Leads -> Cash) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="TODAY'S AD SPEND (META)"
            value={
              adSpend
                ? `${adSpend.currency} ${adSpend.amount.toLocaleString()}`
                : "---"
            }
            subtext="Live from Facebook API"
            icon={<Target className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="NEW LEADS (TODAY)"
            value={leads.toString()}
            subtext={
              adSpend && leads
                ? `CPL: ${(adSpend.amount / leads).toFixed(0)} ${adSpend.currency}`
                : "---"
            }
            trend="up"
            icon={<TrendingUp className="w-6 h-6" />}
            loading={loading}
          />
          <MetricCard
            title="CASH COLLECTED (STRIPE)"
            value={revenue ? `AED ${revenue.amount.toLocaleString()}` : "---"}
            subtext="Real bankable revenue (Today)"
            trend={
              revenue && adSpend && revenue.amount > adSpend.amount
                ? "up"
                : "down"
            }
            icon={<DollarSign className="w-6 h-6" />}
            loading={loading}
          />
        </div>

        {/* BOTTOM ROW: THE DECISION */}
        <div className="rounded-xl border border-muted p-6 bg-card/80 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1 space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              The Golden Ratio (ROAS)
            </h4>
            <div className="flex items-baseline gap-4">
              <span
                className={`text-6xl font-black tracking-tighter ${roas >= 3 ? "text-emerald-500" : roas < 1 ? "text-rose-500" : "text-primary"}`}
              >
                {loading ? "---" : roas.toFixed(2)}x
              </span>
              <span className="text-muted-foreground text-sm max-w-[200px]">
                Return on Ad Spend (Live)
              </span>
            </div>
          </div>

          <div
            className={`p-6 rounded-lg flex-1 w-full text-center md:text-left ${decisionColor} bg-opacity-10 border border-current`}
          >
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-xl font-bold uppercase">AI RECOMMENDATION</h3>
            </div>
            <div className="text-3xl font-black mb-1">
              {loading ? "ANALYZING..." : decisionText}
            </div>
            <p className="opacity-90 font-medium">
              {loading ? "Connecting dots..." : decisionSubtext}
            </p>
          </div>

          <div className="flex flex-col gap-2 min-w-[200px]">
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              size="lg"
              disabled={loading || !hasData || roas < 2.5}
            >
              AUTH SCALE (+20%)
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              size="lg"
              disabled={loading || !hasData || (hasData && roas > 1.5)}
            >
              KILL CAMPAIGNS
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
