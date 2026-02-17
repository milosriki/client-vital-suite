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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Brain,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Shield,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PulseIndicator } from "@/components/dashboard/PulseIndicator";
import { MarketingIntelligenceGhost } from "@/components/dashboard/MarketingIntelligenceGhost";
import { XRayTooltip } from "@/components/ui/x-ray-tooltip";
import { VisualDNA } from "@/components/dashboard/VisualDNA";
import { usePeriodComparison } from "@/hooks/usePeriodComparison";
import { useDeepIntelligence } from "@/hooks/useDeepIntelligence";
import { useDeepAnalysis, useMetaAds, useMoneyMap } from "@/hooks/useMarketingAnalytics";

/* ─────────────────────────────────────────────
   Shared inline components
   ───────────────────────────────────────────── */

function PulseCard({
  title,
  value,
  subtext,
  icon: Icon,
  trend,
  color,
  pulsing,
}: {
  title: string;
  value: string;
  subtext: string;
  icon: React.ElementType;
  trend?: "up" | "down";
  color: string;
  pulsing?: boolean;
}) {
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

function FunnelStep({ label, value, icon: Icon, color, isLast }: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  isLast?: boolean;
}) {
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

function HealthBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    critical: "bg-rose-500/20 text-rose-400 border-rose-500/30",
  };
  return (
    <Badge variant="outline" className={`font-mono text-[10px] uppercase ${colors[status] || colors.warning}`}>
      {status}
    </Badge>
  );
}

function TrustBadge({ verdict }: { verdict: string }) {
  const map: Record<string, { color: string; icon: React.ElementType }> = {
    ALIGNED: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: CheckCircle },
    DRIFTING: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: AlertTriangle },
    BROKEN: { color: "bg-rose-500/20 text-rose-400 border-rose-500/30", icon: XCircle },
  };
  const m = map[verdict] || map.DRIFTING;
  const IconComp = m.icon;
  return (
    <Badge variant="outline" className={`font-mono text-[10px] uppercase gap-1 ${m.color}`}>
      <IconComp className="h-3 w-3" />
      {verdict}
    </Badge>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Tab 1: Command Center (existing content)
   ───────────────────────────────────────────── */

function CommandCenterTab({
  data,
  deltas,
  range,
}: {
  data: MarketingDashboardData | undefined;
  deltas: ReturnType<typeof usePeriodComparison>["data"];
  range: string;
}) {
  if (!data) return null;
  return (
    <>
      {/* ZONE A: THE PULSE */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Zone A: The Pulse</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <XRayTooltip
            title="True ROAS"
            insights={[
              { label: "Cash Collected", value: `AED ${data.zone_a.metrics.cash_collected.toLocaleString()}`, color: "text-emerald-400" },
              { label: "Ad Spend", value: `AED ${data.zone_a.metrics.ad_spend.toLocaleString()}`, color: "text-rose-400" },
              { label: "Formula", value: "Cash / Ad Spend" },
            ]}
            summary="True ROAS = total Stripe cash collected ÷ total Meta ad spend. Target: > 3.0x for profitable scaling."
          >
            <PulseCard
              title="True ROAS"
              value={`${Number(data?.zone_a?.metrics?.true_roas ?? 0).toFixed(2)}x`}
              subtext="Revenue / Ad Spend"
              icon={Target}
              trend={deltas?.roas?.trend || (data.zone_a.metrics.true_roas > 3) ? "up" : "down"}
              color="text-emerald-500"
              pulsing
            />
          </XRayTooltip>
          <XRayTooltip
            title="Cash Collected"
            insights={[
              { label: "Source", value: "Stripe (Succeeded)" },
              { label: "Period", value: range === "today" ? "Today" : range === "week" ? "Last 7 Days" : "Last 30 Days" },
            ]}
            summary="Total payment volume from Stripe with status 'succeeded' in the selected period."
          >
            <PulseCard
              title="Cash Collected"
              value={`AED ${data.zone_a.metrics.cash_collected.toLocaleString()}`}
              subtext="Stripe Succeeded"
              icon={DollarSign}
              color="text-green-500"
              pulsing
            />
          </XRayTooltip>
          <Link to="/campaign-money-map" className="block transition-transform hover:scale-105">
            <XRayTooltip
              title="Ad Spend"
              insights={[
                { label: "Platform", value: "Meta Ads" },
                { label: "Period", value: range === "today" ? "Today" : range === "week" ? "Last 7 Days" : "Last 30 Days" },
              ]}
              summary="Total spend synced from Meta Business API via fetch-facebook-insights → facebook_ads_insights table."
            >
              <PulseCard
                title="Ad Spend"
                value={`AED ${data.zone_a.metrics.ad_spend.toLocaleString()}`}
                subtext="Meta Ads"
                icon={Zap}
                color="text-blue-500"
                pulsing
              />
            </XRayTooltip>
          </Link>
          <Link to="/sales-pipeline" className="block transition-transform hover:scale-105">
            <XRayTooltip
              title="New Leads"
              insights={[
                { label: "Source", value: "HubSpot + Organic" },
                { label: "Synced Via", value: "hubspot-webhook" },
              ]}
              summary="Lead contacts synced from HubSpot into Supabase contacts table with lifecycle_stage='lead'."
            >
              <PulseCard
                title="New Leads"
                value={data.zone_a.metrics.new_leads.toString() || "0"}
                subtext="HubSpot + Organic"
                icon={Users}
                color="text-indigo-500"
                pulsing
              />
            </XRayTooltip>
          </Link>
          <XRayTooltip
            title="Cost Per Lead"
            insights={[
              { label: "Total Spend", value: `AED ${data.zone_a.metrics.ad_spend.toLocaleString()}`, color: "text-rose-400" },
              { label: "Total Leads", value: (data.zone_a.metrics.new_leads || 0).toString(), color: "text-amber-400" },
              { label: "Formula", value: "Spend ÷ Leads" },
              { label: "Target CPL", value: "< AED 30", color: (data.zone_a.metrics.cpl || 0) > 30 ? "text-rose-400" : "text-emerald-400" },
            ]}
            summary={`CPL = Ad Spend ÷ New Leads. ${(data.zone_a.metrics.cpl || 0) > 50 ? "⚠️ Above $50 threshold — review campaign targeting." : "Within acceptable range."}`}
          >
            <PulseCard
              title="Cost Per Lead"
              value={`AED ${Number(data?.zone_a?.metrics?.cpl ?? 0).toFixed(2)}`}
              subtext="Target: < AED 30"
              icon={ShoppingCart}
              color={data.zone_a.metrics.cpl > 50 ? "text-red-500" : "text-purple-500"}
              pulsing
            />
          </XRayTooltip>
          <XRayTooltip
            title="Integrity Score"
            insights={[
              { label: "Verified Rev", value: `AED ${data.zone_a.metrics.cash_collected.toLocaleString()}`, color: "text-emerald-400" },
              { label: "Claimed Rev", value: "Dependent on Ad Source", color: "text-amber-400" },
              { label: "Leak Score", value: `${((1 - Number(data?.zone_a?.metrics?.integrity_score || 1)) * 100).toFixed(1)}%`, color: "text-rose-400" },
            ]}
            summary="The measure of truth. 100% means platform attribution matches bank deposits perfectly."
          >
            <PulseCard
              title="Integrity Score"
              value={`${(Number(data?.zone_a?.metrics?.integrity_score || 1) * 100).toFixed(0)}%`}
              subtext="Platform Truth Match"
              icon={Zap}
              color={Number(data?.zone_a?.metrics?.integrity_score || 1) < 0.8 ? "text-red-500" : "text-emerald-500"}
              pulsing
            />
          </XRayTooltip>
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
              <CardDescription>Latest deal activity and pipeline movement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.zone_b.recent_activity.map((deal, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {deal.deal_name[0]}
                      </div>
                      <div>
                        <p className="font-medium">{deal.deal_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(deal.created_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">AED {Number(deal.amount || 0).toLocaleString()}</p>
                      <Badge variant="outline" className="capitalize">{deal.stage}</Badge>
                    </div>
                  </div>
                ))}
                {(!data.zone_b.recent_activity || data.zone_b.recent_activity.length === 0) && (
                  <div className="text-center text-muted-foreground py-10">No recent deals found.</div>
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
                <FunnelStep label="Impressions" value={data.zone_c.funnel.impressions || 0} icon={Eye} color="bg-blue-100 dark:bg-blue-900/20" />
                <div className="flex justify-center"><ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" /></div>
                <FunnelStep label="Clicks" value={data.zone_c.funnel.clicks || 0} icon={MousePointer} color="bg-indigo-100 dark:bg-indigo-900/20" />
                <div className="flex justify-center"><ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" /></div>
                <FunnelStep label="Leads" value={data.zone_c.funnel.leads || 0} icon={Users} color="bg-purple-100 dark:bg-purple-900/20" />
                <div className="flex justify-center"><ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" /></div>
                <FunnelStep label="Appointments" value={data.zone_c.funnel.appointments || 0} icon={Calendar} color="bg-pink-100 dark:bg-pink-900/20" />
                <div className="flex justify-center"><ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" /></div>
                <FunnelStep label="Sales" value={data.zone_c.funnel.sales || 0} icon={DollarSign} color="bg-green-100 dark:bg-green-900/20" isLast />
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* ZONE D: CREATIVE BRAIN */}
      <section className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Zone D: Creative Brain</h2>
          </div>
          <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-tighter">
            Visual DNA Active
          </Badge>
        </div>
        <div className="mt-4">
          <VisualDNA
            ads={data.zone_d.top_performers || []}
            integrityScore={data.zone_a.metrics.integrity_score || 1.0}
          />
        </div>
      </section>
    </>
  );
}

/* ─────────────────────────────────────────────
   Tab 2: Deep Intel
   ───────────────────────────────────────────── */

function DeepIntelTab() {
  const { data, isLoading } = useDeepIntelligence();

  if (isLoading) return <LoadingSkeleton />;
  if (!data) return <div className="text-center text-muted-foreground py-10">No deep intelligence data available.</div>;

  const { baselines, funnel, lossReasons, assessmentTruth, ceoBrief } = data;
  const projections = ceoBrief?.projections || (data.projections as any)?.projections;

  return (
    <div className="space-y-8">
      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-2 p-3 rounded-lg border ${
              alert.level === "critical" ? "bg-rose-500/10 border-rose-500/30 text-rose-400" :
              alert.level === "warning" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
              "bg-blue-500/10 border-blue-500/30 text-blue-400"
            }`}>
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* CEO Morning Brief */}
      {ceoBrief && (
        <Card className="bg-black/40 border-emerald-500/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-400" />
              <CardTitle>CEO Morning Brief</CardTitle>
              <PulseIndicator className="scale-75" />
            </div>
            <CardDescription>
              {ceoBrief.brief_date ? format(new Date(ceoBrief.brief_date), "EEEE, MMM d, yyyy") : "Latest"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Yesterday Spend</p>
                <p className="text-lg font-mono font-bold">AED {ceoBrief.yesterday_spend?.toLocaleString() ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Yesterday Leads</p>
                <p className="text-lg font-mono font-bold">{ceoBrief.yesterday_leads ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Yesterday CPL</p>
                <p className="text-lg font-mono font-bold">AED {ceoBrief.yesterday_cpl?.toFixed(2) ?? "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">7d ROAS</p>
                <p className="text-lg font-mono font-bold text-emerald-400">{ceoBrief.rolling_7d_roas?.toFixed(2) ?? "—"}x</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">7d Ghost Rate</p>
                <p className={`text-lg font-mono font-bold ${(ceoBrief.rolling_7d_ghost_rate || 0) > 30 ? "text-rose-400" : "text-amber-400"}`}>
                  {ceoBrief.rolling_7d_ghost_rate?.toFixed(0) ?? "—"}%
                </p>
              </div>
            </div>

            {/* Actions Required */}
            {ceoBrief.actions_required && (ceoBrief.actions_required as any[]).length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-semibold text-amber-400">Actions Required:</p>
                {(ceoBrief.actions_required as any[]).map((action: any, i: number) => (
                  <div key={i} className="text-sm text-muted-foreground pl-4 border-l-2 border-amber-500/30">
                    {action.action || action.message || JSON.stringify(action)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Historical Baselines */}
      {baselines.length > 0 && (
        <Card className="bg-black/40">
          <CardHeader>
            <CardTitle>Historical Baselines</CardTitle>
            <CardDescription>Performance benchmarks across periods</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-3 text-muted-foreground">Period</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">Avg ROAS</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">Avg CPL</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">Ghost Rate</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">Close Rate</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">Total Spend</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {baselines.map((b, i) => (
                    <tr key={i} className="border-b border-white/10 hover:bg-white/5">
                      <td className="py-2 px-3 font-mono">{b.period_days}d</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-400">{Number(b?.avg_roas ?? 0).toFixed(2)}x</td>
                      <td className="py-2 px-3 text-right font-mono">AED {Number(b?.avg_cpl ?? 0).toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-mono">{Number((b?.avg_ghost_rate ?? 0) * 100).toFixed(0)}%</td>
                      <td className="py-2 px-3 text-right font-mono">{Number((b?.avg_close_rate ?? 0) * 100).toFixed(0)}%</td>
                      <td className="py-2 px-3 text-right font-mono">AED {b.total_spend?.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">
                        <Badge variant="outline" className={`font-mono text-[10px] ${b.trend_direction === "up" ? "text-emerald-400" : "text-rose-400"}`}>
                          {b.trend_direction === "up" ? "↑" : "↓"} {Number(b?.trend_pct ?? 0).toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 7-Stage Funnel */}
      {funnel && (
        <Card className="bg-black/40">
          <CardHeader>
            <CardTitle>7-Stage Funnel Health</CardTitle>
            <CardDescription>
              {funnel.metric_date ? format(new Date(funnel.metric_date), "MMM d, yyyy") : "Latest"} — Overall lead→customer: {funnel.overall_lead_to_customer_pct?.toFixed(1)}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: "Leads Created", value: funnel.leads_created, pct: null },
                { label: "Assessments Booked", value: funnel.assessments_booked, pct: funnel.lead_to_booked_pct },
                { label: "Assessments Held", value: funnel.assessments_held, pct: funnel.booked_to_held_pct },
                { label: "Deals Created", value: funnel.deals_created, pct: funnel.held_to_deal_pct },
                { label: "Packages Selected", value: funnel.packages_selected, pct: null },
                { label: "Payments Pending", value: funnel.payments_pending, pct: funnel.deal_to_payment_pct },
                { label: "Closed Won", value: funnel.closed_won, pct: funnel.payment_to_won_pct },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">{i + 1}</div>
                  <div className="flex-1">
                    <span className="font-medium">{step.label}</span>
                  </div>
                  <span className="font-mono font-bold">{step.value?.toLocaleString() ?? 0}</span>
                  {step.pct !== null && step.pct !== undefined && (
                    <span className={`font-mono text-sm ${step.pct > 50 ? "text-emerald-400" : step.pct > 25 ? "text-amber-400" : "text-rose-400"}`}>
                      {Number(step?.pct ?? 0).toFixed(1)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Marketing:</span>
                <HealthBadge status={funnel.marketing_health} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sales:</span>
                <HealthBadge status={funnel.sales_health} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Coach:</span>
                <HealthBadge status={funnel.coach_health} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ops:</span>
                <HealthBadge status={funnel.ops_health} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loss Analysis */}
        {lossReasons.length > 0 && (
          <Card className="bg-black/40">
            <CardHeader>
              <CardTitle>Loss Analysis</CardTitle>
              <CardDescription>Why deals are lost — ranked by frequency</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lossReasons.slice(0, 8).map((reason, i) => {
                  const maxCount = lossReasons[0]?.count || 1;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{reason.primary_loss_reason.replace(/_/g, " ")}</span>
                        <span className="font-mono text-muted-foreground">{reason.count} ({reason.avg_confidence}% conf)</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-rose-500/60 rounded-full"
                          style={{ width: `${(reason.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assessment Truth Matrix */}
        <Card className="bg-black/40">
          <CardHeader>
            <CardTitle>Assessment Truth Matrix</CardTitle>
            <CardDescription>
              HubSpot vs AWS verification — {assessmentTruth.accuracy}% accuracy ({assessmentTruth.total} checked)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {Object.entries(assessmentTruth.counts).map(([status, count]) => (
                <div key={status} className="flex justify-between items-center p-2 rounded bg-white/5 text-sm">
                  <span className="truncate text-muted-foreground">{status.replace(/_/g, " ").toLowerCase()}</span>
                  <span className="font-mono font-bold ml-2">{count}</span>
                </div>
              ))}
            </div>
            {assessmentTruth.recent.length > 0 && (
              <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-1 px-2">Name</th>
                      <th className="text-left py-1 px-2">Coach</th>
                      <th className="text-left py-1 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessmentTruth.recent.slice(0, 8).map((row, i) => (
                      <tr key={i} className="border-b border-white/10">
                        <td className="py-1 px-2">{row.first_name} {row.last_name?.[0]}.</td>
                        <td className="py-1 px-2 text-muted-foreground">{row.coach || "—"}</td>
                        <td className="py-1 px-2">
                          <Badge variant="outline" className={`text-[9px] ${
                            row.truth_status === "CONFIRMED_ATTENDED" ? "text-emerald-400" :
                            row.truth_status === "BOOKED_NOT_ATTENDED" ? "text-rose-400" : "text-amber-400"
                          }`}>
                            {row.truth_status?.replace(/_/g, " ").toLowerCase()}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Projections */}
      {projections && (
        <Card className="bg-black/40 border-emerald-500/20">
          <CardHeader>
            <CardTitle>Revenue Projections</CardTitle>
            <CardDescription>30 / 60 / 90-day outlook</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "30-Day Revenue", value: projections.revenue_30d },
                { label: "60-Day Revenue", value: projections.revenue_60d },
                { label: "90-Day Revenue", value: projections.revenue_90d },
              ].map((p, i) => (
                <div key={i} className="p-4 rounded-lg bg-white/5 text-center">
                  <p className="text-sm text-muted-foreground mb-1">{p.label}</p>
                  <p className="text-2xl font-mono font-bold text-emerald-400">
                    AED {p.value?.toLocaleString() ?? "—"}
                  </p>
                </div>
              ))}
            </div>
            {projections.roas_30d && (
              <div className="mt-3 flex gap-4 justify-center text-sm text-muted-foreground">
                <span>Projected 30d Spend: AED {projections.spend_30d?.toLocaleString() ?? "—"}</span>
                <span>Projected 30d ROAS: {projections.roas_30d?.toFixed(2) ?? "—"}x</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Tab 3: Meta Ads
   ───────────────────────────────────────────── */

function MetaAdsTab({ dateRange }: { dateRange: string }) {
  const rangeMap: Record<string, string> = { today: "today", week: "this_week", month: "this_month" };
  const { data, isLoading } = useMetaAds(rangeMap[dateRange] || "this_month");

  if (isLoading) return <LoadingSkeleton />;
  if (!data) return <div className="text-center text-muted-foreground py-10">No Meta Ads data available.</div>;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {data.metrics.map((m, i) => (
          <Card key={i} className="bg-black/40">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
              <p className="text-2xl font-mono font-bold">
                {m.label === "CPC" ? m.value.replace("$", "AED ") : m.value}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {m.delta.type === "positive" ? (
                  <TrendingUp className="h-3 w-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-rose-400" />
                )}
                <span className="text-xs text-muted-foreground font-mono">
                  {m.delta.value > 0 ? "+" : ""}{m.delta.value}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaign Table */}
      <Card className="bg-black/40">
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
          <CardDescription>Top campaigns by spend</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-muted-foreground">Campaign</th>
                  <th className="text-left py-2 px-3 text-muted-foreground">Status</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Spend</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Leads</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">CPL</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((c, i) => (
                  <tr key={i} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-2 px-3 max-w-[200px] truncate">{c.campaign}</td>
                    <td className="py-2 px-3">
                      <Badge variant="outline" className="text-[10px] text-emerald-400">{c.status}</Badge>
                    </td>
                    <td className="py-2 px-3 text-right font-mono">AED {c.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 px-3 text-right font-mono">{c.leads}</td>
                    <td className="py-2 px-3 text-right font-mono">AED {Number(c?.cpl ?? 0).toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-400">{Number(c?.roas ?? 0).toFixed(2)}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Tab 4: Money Map
   ───────────────────────────────────────────── */

function MoneyMapTab({ dateRange }: { dateRange: string }) {
  const rangeMap: Record<string, string> = { today: "today", week: "this_week", month: "this_month" };
  const mappedRange = rangeMap[dateRange] || "this_month";
  const { data, isLoading } = useMoneyMap(mappedRange);
  const { data: deepData, isLoading: deepLoading } = useDeepAnalysis(mappedRange);

  if (isLoading) return <LoadingSkeleton />;
  if (!data) return <div className="text-center text-muted-foreground py-10">No money map data available.</div>;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {data.metrics.map((m, i) => (
          <Card key={i} className="bg-black/40">
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
              <XRayTooltip
                title={m.label}
                insights={[{ label: "Source", value: "Stripe + Meta + HubSpot" }]}
                summary={`${m.label} calculated from real transaction and ad data.`}
              >
                <p className="text-2xl font-mono font-bold">
                  {m.value.replace(/\$/g, "AED ")}
                </p>
              </XRayTooltip>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Campaign ROI Table */}
      <Card className="bg-black/40">
        <CardHeader>
          <CardTitle>Campaign ROI Breakdown</CardTitle>
          <CardDescription>Revenue attribution per campaign</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-muted-foreground">Campaign</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Spend</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Revenue</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">ROI</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">CAC</th>
                  <th className="text-right py-2 px-3 text-muted-foreground">Margin</th>
                </tr>
              </thead>
              <tbody>
                {data.campaignROI.map((c, i) => (
                  <tr key={i} className="border-b border-white/10 hover:bg-white/5">
                    <td className="py-2 px-3 max-w-[200px] truncate">{c.campaign}</td>
                    <td className="py-2 px-3 text-right font-mono">AED {c.spend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-400">AED {c.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="py-2 px-3 text-right font-mono">{Number(c?.roi ?? 0).toFixed(2)}x</td>
                    <td className="py-2 px-3 text-right font-mono">AED {Number(c?.cac ?? 0).toFixed(0)}</td>
                    <td className={`py-2 px-3 text-right font-mono ${c.margin >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      AED {c.margin.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cohort Analysis */}
      {deepData?.cohortAnalysis && deepData.cohortAnalysis.length > 0 && (
        <Card className="bg-black/40">
          <CardHeader>
            <CardTitle>Cohort Analysis</CardTitle>
            <CardDescription>Monthly cohort performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-3 text-muted-foreground">Month</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">Leads</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">Conv %</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">Revenue</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">ROAS</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">CAC</th>
                  </tr>
                </thead>
                <tbody>
                  {deepData.cohortAnalysis.map((c, i) => (
                    <tr key={i} className="border-b border-white/10 hover:bg-white/5">
                      <td className="py-2 px-3 font-mono">{c.month}</td>
                      <td className="py-2 px-3 text-right font-mono">{c.leads}</td>
                      <td className="py-2 px-3 text-right font-mono">{Number(c?.conv ?? 0).toFixed(1)}%</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-400">AED {c.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="py-2 px-3 text-right font-mono">{Number(c?.roas ?? 0).toFixed(2)}x</td>
                      <td className="py-2 px-3 text-right font-mono">AED {Number(c?.cac ?? 0).toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Tab 5: Source Truth
   ───────────────────────────────────────────── */

function SourceTruthTab() {
  const { data: deepData, isLoading: deepLoading } = useDeepIntelligence();

  const { data: triangleData, isLoading: triangleLoading } = useQuery({
    queryKey: ["truth-triangle"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_truth_triangle" as any)
        .select("*")
        .order("month", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (deepLoading || triangleLoading) return <LoadingSkeleton />;

  const sourceAlignment = deepData?.sourceAlignment;

  return (
    <div className="space-y-6">
      {/* Overall Verdict */}
      {sourceAlignment && (
        <Card className="bg-black/40">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Source Alignment Score</CardTitle>
                <PulseIndicator className="scale-75" />
              </div>
              <TrustBadge verdict={sourceAlignment.overallVerdict} />
            </div>
            <CardDescription>Average discrepancy gap: {sourceAlignment.avgGap}%</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(sourceAlignment.verdictCounts).map(([verdict, count]) => (
                <div key={verdict} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <TrustBadge verdict={verdict} />
                  <span className="font-mono font-bold text-lg">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source Discrepancy Matrix */}
      {sourceAlignment && sourceAlignment.details.length > 0 && (
        <Card className="bg-black/40">
          <CardHeader>
            <CardTitle>Source Discrepancy Matrix</CardTitle>
            <CardDescription>FB Leads vs AnyTrack Leads vs Supabase Contacts per campaign</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-3 text-muted-foreground">Date</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">Campaign</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">FB Leads</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">AnyTrack</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">Supabase</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">Gap %</th>
                    <th className="text-left py-2 px-3 text-muted-foreground">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceAlignment.details.map((row, i) => (
                    <tr key={i} className="border-b border-white/10 hover:bg-white/5">
                      <td className="py-2 px-3 font-mono text-xs">{row.report_date}</td>
                      <td className="py-2 px-3 max-w-[180px] truncate">{row.campaign_name}</td>
                      <td className="py-2 px-3 text-right font-mono">{row.fb_reported_leads}</td>
                      <td className="py-2 px-3 text-right font-mono">{row.anytrack_leads}</td>
                      <td className="py-2 px-3 text-right font-mono">{row.supabase_contacts}</td>
                      <td className={`py-2 px-3 text-right font-mono ${
                        row.max_discrepancy_pct > 25 ? "text-rose-400" : row.max_discrepancy_pct > 10 ? "text-amber-400" : "text-emerald-400"
                      }`}>{row.max_discrepancy_pct}%</td>
                      <td className="py-2 px-3"><TrustBadge verdict={row.trust_verdict} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Truth Triangle */}
      {triangleData && triangleData.length > 0 && (
        <Card className="bg-black/40 border-emerald-500/20">
          <CardHeader>
            <CardTitle>Truth Triangle</CardTitle>
            <CardDescription>Monthly: Meta Spend vs HubSpot Deal Value vs Stripe Cash</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...triangleData].reverse()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" tick={{ fill: "#888", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8 }}
                    formatter={(value: number) => `AED ${value?.toLocaleString() ?? 0}`}
                  />
                  <Bar dataKey="meta_spend" name="Meta Spend" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="hubspot_deal_value" name="HubSpot Deals" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="stripe_cash" name="Stripe Cash" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-3 text-muted-foreground">Month</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">Meta Spend</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">HubSpot Deals</th>
                    <th className="text-right py-2 px-3 text-muted-foreground">Stripe Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {triangleData.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-white/10 hover:bg-white/5">
                      <td className="py-2 px-3 font-mono">{row.month}</td>
                      <td className="py-2 px-3 text-right font-mono text-rose-400">AED {row.meta_spend?.toLocaleString() ?? 0}</td>
                      <td className="py-2 px-3 text-right font-mono text-amber-400">AED {row.hubspot_deal_value?.toLocaleString() ?? 0}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-400">AED {row.stripe_cash?.toLocaleString() ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Page Component
   ───────────────────────────────────────────── */

export default function MarketingIntelligence() {
  const [range, setRange] = useState<"today" | "week" | "month">("month");
  const { data: deltas } = usePeriodComparison();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["marketing-intelligence", range],
    queryFn: async () => {
      const response = await supabase.functions.invoke(
        "business-intelligence-dashboard",
        { body: { range } },
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
        <h2 className="text-xl font-bold text-destructive mb-2">Error Loading Dashboard</h2>
        <p className="text-muted-foreground mb-4">Could not fetch intelligence data.</p>
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
            <RefreshCw className={`h-4 w-4 ${isLoading || isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="command-center" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="command-center">Command Center</TabsTrigger>
          <TabsTrigger value="deep-intel">Deep Intel</TabsTrigger>
          <TabsTrigger value="meta-ads">Meta Ads</TabsTrigger>
          <TabsTrigger value="money-map">Money Map</TabsTrigger>
          <TabsTrigger value="source-truth">Source Truth</TabsTrigger>
        </TabsList>

        <TabsContent value="command-center" className="space-y-8 mt-6">
          {isLoading ? (
            <MarketingIntelligenceGhost />
          ) : (
            <CommandCenterTab data={data} deltas={deltas} range={range} />
          )}
        </TabsContent>

        <TabsContent value="deep-intel" className="mt-6">
          <DeepIntelTab />
        </TabsContent>

        <TabsContent value="meta-ads" className="mt-6">
          <MetaAdsTab dateRange={range} />
        </TabsContent>

        <TabsContent value="money-map" className="mt-6">
          <MoneyMapTab dateRange={range} />
        </TabsContent>

        <TabsContent value="source-truth" className="mt-6">
          <SourceTruthTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
