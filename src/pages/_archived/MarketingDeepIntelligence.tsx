import { useState } from "react";
import {
  RefreshCw,
  TrendingUp,
  Target,
  Ghost,
  DollarSign,
  Users,
  Calendar,
  CreditCard,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRight,
  BarChart3,
  ShieldAlert,
  Rocket,
  Activity,
  Eye,
  FileText,
  Briefcase,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { XRayTooltip } from "@/components/ui/x-ray-tooltip";
import {
  useDeepIntelligence,
  type HistoricalBaseline,
  type FunnelMetric,
  type LossAnalysisRow,
  type AssessmentTruth,
  type CeoBrief,
} from "@/hooks/useDeepIntelligence";
import { cn } from "@/lib/utils";

// ─── HELPERS ─────────────────────────────────────────────────

function trendIcon(direction: string) {
  if (direction === "improving") return "▲";
  if (direction === "declining") return "▼";
  return "→";
}

function trendColor(direction: string) {
  if (direction === "improving") return "text-emerald-500";
  if (direction === "declining") return "text-rose-500";
  return "text-muted-foreground";
}

function healthDot(status: string | null) {
  if (status === "healthy") return "bg-emerald-500";
  if (status === "warning") return "bg-amber-500";
  if (status === "critical") return "bg-rose-500";
  return "bg-muted-foreground";
}

function healthLabel(status: string | null) {
  if (status === "healthy") return "Healthy";
  if (status === "warning") return "Warning";
  if (status === "critical") return "Critical";
  return "No Data";
}

function verdictBadge(verdict: string) {
  if (verdict === "ALIGNED")
    return {
      color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      icon: CheckCircle,
    };
  if (verdict === "DRIFTING")
    return {
      color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      icon: AlertTriangle,
    };
  return {
    color: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    icon: XCircle,
  };
}

const LOSS_REASON_COLORS: Record<string, string> = {
  response_time: "bg-rose-500",
  ghost: "bg-amber-500",
  coach_mismatch: "bg-purple-500",
  lead_quality: "bg-blue-500",
  timing: "bg-cyan-500",
  unknown: "bg-muted-foreground",
};

const LOSS_REASON_LABELS: Record<string, string> = {
  response_time: "Slow Response",
  ghost: "No-Show / Ghost",
  coach_mismatch: "Coach Mismatch",
  lead_quality: "Low Quality Lead",
  timing: "Bad Timing",
  unknown: "Unknown",
};

const INDUSTRY_BENCHMARKS = {
  roas: 3.0,
  cpl: 30,
  ghost_rate: 25,
  close_rate: 25,
};

// ─── PAGE ────────────────────────────────────────────────────

export default function MarketingDeepIntelligence() {
  const { data, isLoading, isError, refetch, isRefetching } =
    useDeepIntelligence();

  if (isError) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-destructive mb-2">
          Error Loading Deep Intelligence
        </h2>
        <p className="text-muted-foreground mb-4">
          Could not fetch intelligence data. The SQL migration may not be
          deployed yet.
        </p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  const b90 = data?.baselines?.find(
    (b: HistoricalBaseline) => b.period_days === 90,
  );
  const b60 = data?.baselines?.find(
    (b: HistoricalBaseline) => b.period_days === 60,
  );
  const b30 = data?.baselines?.find(
    (b: HistoricalBaseline) => b.period_days === 30,
  );
  const funnel = data?.funnel;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-amber-500 to-rose-500 bg-clip-text text-transparent">
            Deep Intelligence
          </h1>
          <p className="text-muted-foreground mt-1">
            Historical baselines · Loss analysis · Funnel truth · Projections
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            refetch();
            toast.success("Refreshing deep intelligence...");
          }}
          disabled={isLoading || isRefetching}
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoading || isRefetching ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {isLoading ? (
        <DeepIntelGhost />
      ) : (
        <>
          {/* ═══ ZONE 1: TREND PULSE ═══ */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">
                Zone 1: 90-Day Trend Pulse
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <XRayTooltip
                title="90-Day ROAS"
                insights={[
                  { label: "Source", value: "historical_baselines (90d)" },
                  { label: "Formula", value: "Total Revenue / Total Ad Spend" },
                  {
                    label: "Industry Benchmark",
                    value: `${INDUSTRY_BENCHMARKS.roas}x`,
                    color: "text-primary",
                  },
                ]}
                summary="Rolling 90-day return on ad spend across all campaigns. Target: >3.0x for profitable scaling."
              >
                <TrendCard
                  title="90d ROAS"
                  value={b90?.avg_roas ? `${b90.avg_roas.toFixed(2)}x` : "—"}
                  benchmark={`Target: ${INDUSTRY_BENCHMARKS.roas}x`}
                  trend={b90?.trend_direction || "stable"}
                  trendPct={b90?.trend_pct}
                  color="text-emerald-500"
                  icon={Target}
                />
              </XRayTooltip>
              <XRayTooltip
                title="90-Day CPL"
                insights={[
                  { label: "Source", value: "historical_baselines (90d)" },
                  { label: "Formula", value: "Total Spend / Total Leads" },
                  {
                    label: "Industry Benchmark",
                    value: `AED ${INDUSTRY_BENCHMARKS.cpl}`,
                    color: "text-primary",
                  },
                ]}
                summary="Rolling 90-day cost per lead. Lower is better. Target: <AED 30."
              >
                <TrendCard
                  title="90d CPL"
                  value={b90?.avg_cpl ? `AED ${b90.avg_cpl.toFixed(0)}` : "—"}
                  benchmark={`Target: <AED ${INDUSTRY_BENCHMARKS.cpl}`}
                  trend={
                    b90?.trend_direction === "improving"
                      ? "declining"
                      : b90?.trend_direction === "declining"
                        ? "improving"
                        : "stable"
                  }
                  trendPct={b90?.trend_pct}
                  color="text-amber-500"
                  icon={DollarSign}
                  invertTrend
                />
              </XRayTooltip>
              <XRayTooltip
                title="Ghost Rate"
                insights={[
                  { label: "Source", value: "historical_baselines (90d)" },
                  {
                    label: "Formula",
                    value: "1 - (Assessments Held / Assessments Booked)",
                  },
                  {
                    label: "Industry Benchmark",
                    value: `${INDUSTRY_BENCHMARKS.ghost_rate}%`,
                    color: "text-primary",
                  },
                ]}
                summary="Percentage of booked assessments that didn't show up. Lower is better. Target: <25%."
              >
                <TrendCard
                  title="Ghost Rate"
                  value={
                    b90?.avg_ghost_rate
                      ? `${b90.avg_ghost_rate.toFixed(1)}%`
                      : "—"
                  }
                  benchmark={`Target: <${INDUSTRY_BENCHMARKS.ghost_rate}%`}
                  trend={
                    b90?.trend_direction === "improving"
                      ? "declining"
                      : b90?.trend_direction === "declining"
                        ? "improving"
                        : "stable"
                  }
                  trendPct={b90?.trend_pct}
                  color="text-rose-500"
                  icon={Ghost}
                  invertTrend
                />
              </XRayTooltip>
              <XRayTooltip
                title="Close Rate"
                insights={[
                  { label: "Source", value: "historical_baselines (90d)" },
                  {
                    label: "Formula",
                    value: "Closed Won / Total Deals Created",
                  },
                  {
                    label: "Industry Benchmark",
                    value: `${INDUSTRY_BENCHMARKS.close_rate}%`,
                    color: "text-primary",
                  },
                ]}
                summary="Percentage of deals that close successfully. Target: >25% for fitness industry."
              >
                <TrendCard
                  title="Close Rate"
                  value={
                    b90?.avg_close_rate
                      ? `${b90.avg_close_rate.toFixed(1)}%`
                      : "—"
                  }
                  benchmark={`Target: >${INDUSTRY_BENCHMARKS.close_rate}%`}
                  trend={b90?.trend_direction || "stable"}
                  trendPct={b90?.trend_pct}
                  color="text-blue-500"
                  icon={Users}
                />
              </XRayTooltip>
            </div>
          </section>

          {/* ═══ ZONE 2 + 3: FUNNEL + ROOT CAUSE ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <section className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">
                  Zone 2: 12-Stage Funnel
                </h2>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Conversion Pipeline</CardTitle>
                  <CardDescription>
                    Stage-to-stage conversion with drop-off rates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <FunnelRow
                      label="Leads Created"
                      value={funnel?.leads_created}
                      icon={Users}
                      color="bg-blue-500"
                    />
                    <FunnelArrow
                      pct={funnel?.lead_to_booked_pct}
                      owner="Marketing"
                    />
                    <FunnelRow
                      label="Assessments Booked"
                      value={funnel?.assessments_booked}
                      icon={Calendar}
                      color="bg-indigo-500"
                    />
                    <FunnelArrow
                      pct={funnel?.booked_to_held_pct}
                      owner="Sales"
                    />
                    <FunnelRow
                      label="Assessments Held"
                      value={funnel?.assessments_held}
                      icon={CheckCircle}
                      color="bg-purple-500"
                    />
                    <FunnelArrow pct={funnel?.held_to_deal_pct} owner="Coach" />
                    <FunnelRow
                      label="Deals Created"
                      value={funnel?.deals_created}
                      icon={Target}
                      color="bg-pink-500"
                    />
                    <FunnelArrow
                      pct={funnel?.deal_to_payment_pct}
                      owner="Ops"
                    />
                    <FunnelRow
                      label="Payments Pending"
                      value={funnel?.payments_pending}
                      icon={CreditCard}
                      color="bg-orange-500"
                    />
                    <FunnelArrow pct={funnel?.payment_to_won_pct} owner="Ops" />
                    <FunnelRow
                      label="Closed Won"
                      value={funnel?.closed_won}
                      icon={CheckCircle}
                      color="bg-emerald-500"
                      isLast
                    />

                    {funnel && (
                      <div className="mt-4 p-3 bg-muted/30 rounded-lg flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Overall Lead→Customer
                        </span>
                        <span className="text-lg font-bold text-primary">
                          {funnel.overall_lead_to_customer_pct?.toFixed(1) ??
                            "—"}
                          %
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* ZONE 3: ROOT CAUSE HEALTH */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Zone 3: Root Cause</h2>
              </div>
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>Health by Owner</CardTitle>
                  <CardDescription>Who owns each bottleneck?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <HealthRow
                    label="Marketing"
                    sublabel="Lead → Booked"
                    status={funnel?.marketing_health || null}
                  />
                  <HealthRow
                    label="Sales"
                    sublabel="Booked → Held"
                    status={funnel?.sales_health || null}
                  />
                  <HealthRow
                    label="Coach"
                    sublabel="Held → Deal"
                    status={funnel?.coach_health || null}
                  />
                  <HealthRow
                    label="Operations"
                    sublabel="Deal → Payment → Won"
                    status={funnel?.ops_health || null}
                  />
                </CardContent>
              </Card>

              {/* BEST/WORST WEEKS */}
              {b90 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Best vs Worst Week
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-emerald-500/10 rounded-lg">
                      <span className="text-sm">Best Week</span>
                      <div className="text-right">
                        <span className="font-bold text-emerald-500">
                          {b90.best_week_roas?.toFixed(2) ?? "—"}x
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          {b90.best_week_start || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-rose-500/10 rounded-lg">
                      <span className="text-sm">Worst Week</span>
                      <div className="text-right">
                        <span className="font-bold text-rose-500">
                          {b90.worst_week_roas?.toFixed(2) ?? "—"}x
                        </span>
                        <p className="text-[10px] text-muted-foreground">
                          {b90.worst_week_start || "—"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>

          {/* ═══ ZONE 4 + 5: LOSS INTEL + SOURCE TRUTH ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* ZONE 4 */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-rose-500" />
                <h2 className="text-xl font-semibold">
                  Zone 4: Loss Intelligence
                </h2>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Why We Lose Deals</CardTitle>
                  <CardDescription>
                    Evidence-backed loss analysis with confidence scores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data?.lossReasons && data.lossReasons.length > 0 ? (
                    <div className="space-y-3">
                      {data.lossReasons.map((reason: LossAnalysisRow) => {
                        const total = data.lossReasons.reduce(
                          (s: number, r: LossAnalysisRow) => s + r.count,
                          0,
                        );
                        const pct =
                          total > 0 ? (reason.count / total) * 100 : 0;
                        return (
                          <div
                            key={reason.primary_loss_reason}
                            className="space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {LOSS_REASON_LABELS[
                                  reason.primary_loss_reason
                                ] || reason.primary_loss_reason}
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {reason.count} deals
                                </Badge>
                                <span className="text-sm font-bold">
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  LOSS_REASON_COLORS[
                                    reason.primary_loss_reason
                                  ] || "bg-muted-foreground",
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Confidence: {reason.avg_confidence}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <XCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No loss analysis data yet.</p>
                      <p className="text-xs mt-1">
                        Deploy marketing-loss-analyst EF to populate.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* ZONE 5 */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Zone 5: Source Truth</h2>
              </div>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Data Alignment</CardTitle>
                      <CardDescription>
                        Facebook vs AnyTrack vs DB (7d)
                      </CardDescription>
                    </div>
                    {data?.sourceAlignment && (
                      <SourceVerdictBadge
                        verdict={data.sourceAlignment.overallVerdict}
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {data?.sourceAlignment?.details &&
                  data.sourceAlignment.details.length > 0 ? (
                    <div className="space-y-3">
                      {/* Summary stats */}
                      <div className="grid grid-cols-3 gap-2 text-center p-3 bg-muted/30 rounded-lg">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Aligned
                          </p>
                          <p className="text-lg font-bold text-emerald-500">
                            {data.sourceAlignment.verdictCounts.ALIGNED}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Drifting
                          </p>
                          <p className="text-lg font-bold text-amber-500">
                            {data.sourceAlignment.verdictCounts.DRIFTING}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Broken
                          </p>
                          <p className="text-lg font-bold text-rose-500">
                            {data.sourceAlignment.verdictCounts.BROKEN}
                          </p>
                        </div>
                      </div>

                      {/* Avg gap */}
                      <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                        <span className="text-sm text-muted-foreground">
                          Avg Discrepancy
                        </span>
                        <span
                          className={cn(
                            "font-bold",
                            data.sourceAlignment.avgGap > 25
                              ? "text-rose-500"
                              : data.sourceAlignment.avgGap > 10
                                ? "text-amber-500"
                                : "text-emerald-500",
                          )}
                        >
                          {data.sourceAlignment.avgGap}%
                        </span>
                      </div>

                      {/* Recent rows */}
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {data.sourceAlignment.details
                          .slice(0, 5)
                          .map((row, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2 bg-muted/10 rounded text-xs"
                            >
                              <span className="truncate max-w-[120px]">
                                {row.report_date}
                              </span>
                              <div className="flex items-center gap-3">
                                <span title="Facebook">
                                  FB: {row.fb_reported_leads}
                                </span>
                                <span title="AnyTrack">
                                  AT: {row.anytrack_leads}
                                </span>
                                <span title="Database">
                                  DB: {row.supabase_contacts}
                                </span>
                              </div>
                              <MiniVerdictDot verdict={row.trust_verdict} />
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No source alignment data yet.</p>
                      <p className="text-xs mt-1">
                        Deploy SQL migration to create source_discrepancy_matrix
                        view.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>

          {/* ═══ ZONE 6: PROJECTIONS ═══ */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Rocket className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">
                Zone 6: Revenue Projections
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ProjectionCard
                period="30d"
                baseline={b30}
                projections={data?.projections}
              />
              <ProjectionCard
                period="60d"
                baseline={b60}
                projections={data?.projections}
              />
              <ProjectionCard
                period="90d"
                baseline={b90}
                projections={data?.projections}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Method: 60% current 7d pace + 40% historical baseline · Updated by
              marketing-predictor agent
            </p>
          </section>

          {/* ═══ ZONE 7 + 8: ASSESSMENT TRUTH + CEO BRIEF ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* ZONE 7: ASSESSMENT TRUTH MATRIX */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">
                  Zone 7: Assessment Truth
                </h2>
              </div>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>HubSpot vs AWS Ground Truth</CardTitle>
                      <CardDescription>
                        Do bookings in CRM match actual attendance?
                      </CardDescription>
                    </div>
                    {data?.assessmentTruth && (
                      <div
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold",
                          data.assessmentTruth.accuracy >= 80
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : data.assessmentTruth.accuracy >= 50
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              : "bg-rose-500/10 text-rose-500 border-rose-500/20",
                        )}
                      >
                        <Activity className="h-3.5 w-3.5" />
                        {data.assessmentTruth.accuracy}% Verified
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {data?.assessmentTruth && data.assessmentTruth.total > 0 ? (
                    <div className="space-y-4">
                      {/* Status breakdown */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                          <p className="text-lg font-bold text-emerald-500">
                            {data.assessmentTruth.counts.CONFIRMED_ATTENDED}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Confirmed
                          </p>
                        </div>
                        <div className="p-2 bg-amber-500/10 rounded-lg">
                          <p className="text-lg font-bold text-amber-500">
                            {
                              data.assessmentTruth.counts
                                .HUBSPOT_ONLY_NO_AWS_PROOF
                            }
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            CRM Only
                          </p>
                        </div>
                        <div className="p-2 bg-rose-500/10 rounded-lg">
                          <p className="text-lg font-bold text-rose-500">
                            {data.assessmentTruth.counts.BOOKED_NOT_ATTENDED}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            No-Show
                          </p>
                        </div>
                      </div>

                      {/* Additional counts */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-xs">
                          <span className="text-muted-foreground">
                            AWS ✓ but CRM ✗
                          </span>
                          <span className="font-bold text-blue-400">
                            {
                              data.assessmentTruth.counts
                                .ATTENDED_BUT_HUBSPOT_NOT_UPDATED
                            }
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg text-xs">
                          <span className="text-muted-foreground">
                            Past Stage
                          </span>
                          <span className="font-bold">
                            {data.assessmentTruth.counts.PAST_ASSESSMENT_STAGE}
                          </span>
                        </div>
                      </div>

                      {/* Recent records */}
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {data.assessmentTruth.recent
                          .slice(0, 6)
                          .map((r: AssessmentTruth, i: number) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2 bg-muted/10 rounded text-xs"
                            >
                              <span className="truncate max-w-[100px]">
                                {r.first_name} {r.last_name?.[0]}.
                              </span>
                              <span className="text-muted-foreground truncate max-w-[80px]">
                                {r.coach}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px]",
                                  r.truth_status === "CONFIRMED_ATTENDED" &&
                                    "text-emerald-500 border-emerald-500/30",
                                  r.truth_status === "BOOKED_NOT_ATTENDED" &&
                                    "text-rose-500 border-rose-500/30",
                                  r.truth_status ===
                                    "HUBSPOT_ONLY_NO_AWS_PROOF" &&
                                    "text-amber-500 border-amber-500/30",
                                )}
                              >
                                {r.truth_status
                                  .replace(/_/g, " ")
                                  .toLowerCase()}
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No assessment truth data yet.</p>
                      <p className="text-xs mt-1">
                        Deploy SQL migration to create assessment_truth_matrix
                        view.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            {/* ZONE 8: CEO MORNING BRIEF */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">
                  Zone 8: CEO Morning Brief
                </h2>
              </div>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Latest Intelligence Brief</CardTitle>
                      <CardDescription>
                        Auto-generated daily by the marketing-brief agent
                      </CardDescription>
                    </div>
                    {data?.ceoBrief && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono"
                      >
                        {data.ceoBrief.brief_date}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {data?.ceoBrief ? (
                    <div className="space-y-4">
                      {/* Yesterday snapshot */}
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                          Yesterday
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="p-2 bg-muted/30 rounded-lg text-center">
                            <p className="text-sm font-bold">
                              AED{" "}
                              {data.ceoBrief.yesterday_spend?.toLocaleString() ??
                                "—"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Spend
                            </p>
                          </div>
                          <div className="p-2 bg-muted/30 rounded-lg text-center">
                            <p className="text-sm font-bold">
                              {data.ceoBrief.yesterday_leads ?? "—"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Leads
                            </p>
                          </div>
                          <div className="p-2 bg-muted/30 rounded-lg text-center">
                            <p className="text-sm font-bold">
                              AED {data.ceoBrief.yesterday_cpl ?? "—"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              CPL
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 7-Day rolling */}
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                          7-Day Rolling
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                            <span className="text-xs text-muted-foreground">
                              ROAS
                            </span>
                            <span
                              className={cn(
                                "text-sm font-bold",
                                (data.ceoBrief.rolling_7d_roas ?? 0) >= 3
                                  ? "text-emerald-500"
                                  : "text-amber-500",
                              )}
                            >
                              {data.ceoBrief.rolling_7d_roas?.toFixed(2) ?? "—"}
                              x
                            </span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                            <span className="text-xs text-muted-foreground">
                              Ghost
                            </span>
                            <span
                              className={cn(
                                "text-sm font-bold",
                                (data.ceoBrief.rolling_7d_ghost_rate ?? 100) <=
                                  25
                                  ? "text-emerald-500"
                                  : "text-rose-500",
                              )}
                            >
                              {data.ceoBrief.rolling_7d_ghost_rate?.toFixed(
                                1,
                              ) ?? "—"}
                              %
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action items */}
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Pending Actions
                        </p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <p className="text-sm font-bold text-primary">
                              {(data.ceoBrief.actions_required || []).length}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Actions
                            </p>
                          </div>
                          <div className="p-2 bg-amber-500/10 rounded-lg">
                            <p className="text-sm font-bold text-amber-500">
                              {(data.ceoBrief.budget_proposals || []).length}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Budget
                            </p>
                          </div>
                          <div className="p-2 bg-rose-500/10 rounded-lg">
                            <p className="text-sm font-bold text-rose-500">
                              {(data.ceoBrief.fatigue_alerts || []).length}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Fatigue
                            </p>
                          </div>
                        </div>
                        {data.ceoBrief.new_copy_pending > 0 && (
                          <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-lg">
                            <FileText className="h-3.5 w-3.5 text-blue-400" />
                            <span className="text-xs text-blue-400">
                              {data.ceoBrief.new_copy_pending} new creative
                              {data.ceoBrief.new_copy_pending > 1 ? "s" : ""}{" "}
                              pending review
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <Briefcase className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No CEO brief generated yet.</p>
                      <p className="text-xs mt-1">
                        The daily-marketing-brief agent runs at 08:30 UAE.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>

          {/* ═══ ALERT BAR ═══ */}
          {data?.alerts && data.alerts.length > 0 && (
            <section className="space-y-2">
              {data.alerts.map((alert, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border text-sm",
                    alert.level === "critical" &&
                      "bg-rose-500/10 border-rose-500/20 text-rose-400",
                    alert.level === "warning" &&
                      "bg-amber-500/10 border-amber-500/20 text-amber-400",
                    alert.level === "info" &&
                      "bg-blue-500/10 border-blue-500/20 text-blue-400",
                  )}
                >
                  {alert.level === "critical" ? (
                    <XCircle className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  )}
                  {alert.message}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────

function TrendCard({
  title,
  value,
  benchmark,
  trend,
  trendPct,
  color,
  icon: Icon,
  invertTrend,
}: {
  title: string;
  value: string;
  benchmark: string;
  trend: string;
  trendPct?: number;
  color: string;
  icon: any;
  invertTrend?: boolean;
}) {
  const displayTrend = invertTrend
    ? trend === "improving"
      ? "declining"
      : trend === "declining"
        ? "improving"
        : trend
    : trend;
  return (
    <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between mb-3">
          <div
            className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center",
              color.replace("text-", "bg-") + "/10",
            )}
          >
            <Icon className={cn("h-5 w-5", color)} />
          </div>
          {trendPct !== undefined && trendPct !== null && (
            <span
              className={cn(
                "text-xs font-mono font-bold",
                trendColor(displayTrend),
              )}
            >
              {trendIcon(displayTrend)} {Math.abs(trendPct).toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
          {title}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {benchmark}
        </p>
      </CardContent>
    </Card>
  );
}

function FunnelRow({
  label,
  value,
  icon: Icon,
  color,
  isLast,
}: {
  label: string;
  value?: number;
  icon: any;
  color: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg bg-muted/30",
        isLast && "ring-1 ring-emerald-500/30",
      )}
    >
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center text-white shrink-0",
          color,
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm font-medium flex-1">{label}</span>
      <span className="text-lg font-bold font-mono">{value ?? "—"}</span>
    </div>
  );
}

function FunnelArrow({ pct, owner }: { pct?: number; owner: string }) {
  const pctNum = pct ?? 0;
  return (
    <div className="flex items-center justify-center gap-2 py-1">
      <ArrowRight className="h-3 w-3 text-muted-foreground rotate-90" />
      <span
        className={cn(
          "text-xs font-mono font-bold",
          pctNum >= 50
            ? "text-emerald-500"
            : pctNum >= 25
              ? "text-amber-500"
              : "text-rose-500",
        )}
      >
        {pctNum > 0 ? `${pctNum.toFixed(1)}%` : "—"}
      </span>
      <Badge variant="outline" className="text-[9px] font-mono">
        {owner}
      </Badge>
    </div>
  );
}

function HealthRow({
  label,
  sublabel,
  status,
}: {
  label: string;
  sublabel: string;
  status: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "h-3 w-3 rounded-full shrink-0 animate-pulse",
          healthDot(status),
        )}
      />
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{sublabel}</p>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "text-[10px]",
          status === "healthy" && "text-emerald-500 border-emerald-500/30",
          status === "warning" && "text-amber-500 border-amber-500/30",
          status === "critical" && "text-rose-500 border-rose-500/30",
        )}
      >
        {healthLabel(status)}
      </Badge>
    </div>
  );
}

function SourceVerdictBadge({ verdict }: { verdict: string }) {
  const v = verdictBadge(verdict);
  const Icon = v.icon;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold",
        v.color,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {verdict}
    </div>
  );
}

function MiniVerdictDot({ verdict }: { verdict: string }) {
  return (
    <div
      className={cn(
        "h-2.5 w-2.5 rounded-full shrink-0",
        verdict === "ALIGNED" && "bg-emerald-500",
        verdict === "DRIFTING" && "bg-amber-500",
        verdict === "BROKEN" && "bg-rose-500",
        verdict === "NO_DATA" && "bg-muted-foreground",
      )}
      title={verdict}
    />
  );
}

function ProjectionCard({
  period,
  baseline,
  projections,
}: {
  period: string;
  baseline?: HistoricalBaseline;
  projections?: any;
}) {
  const projKey = `projected_revenue_${period.replace("d", "")}d`;
  const projValue = projections?.[projKey] ?? baseline?.total_revenue;
  const histAvg = baseline?.total_revenue;

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline" className="text-[10px] font-mono">
            {period}
          </Badge>
          {histAvg && projValue && projValue > histAvg && (
            <span className="text-xs text-emerald-500 font-mono font-bold">
              ▲ {(((projValue - histAvg) / histAvg) * 100).toFixed(0)}%
            </span>
          )}
        </div>
        <p className="text-2xl font-bold tracking-tight">
          {projValue ? `AED ${Number(projValue).toLocaleString()}` : "—"}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Historical avg:{" "}
          {histAvg ? `AED ${Number(histAvg).toLocaleString()}` : "—"}
        </p>
      </CardContent>
    </Card>
  );
}

// ─── SKELETON ────────────────────────────────────────────────

function DeepIntelGhost() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-muted/30 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 h-96 bg-muted/30 rounded-lg" />
        <div className="h-64 bg-muted/30 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="h-64 bg-muted/30 rounded-lg" />
        <div className="h-64 bg-muted/30 rounded-lg" />
      </div>
    </div>
  );
}
