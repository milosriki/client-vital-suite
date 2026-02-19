import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Filter,
  Download,
  TrendingDown,
  Clock,
  Users,
  DollarSign,
  ArrowDown,
  Loader2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
type TimeRange = "7d" | "30d" | "90d" | "all";

interface StageRow {
  stage: string;
  label: string;
  count: number;
  amount: number;
}

// ── Constants ──────────────────────────────────────────────────────────────
const DEAL_STAGE_ORDER: { key: string; label: string }[] = [
  { key: "appointmentscheduled", label: "Appointment Scheduled" },
  { key: "qualifiedtobuy", label: "Qualified to Buy" },
  { key: "presentationscheduled", label: "Presentation Scheduled" },
  { key: "decisionmakerboughtin", label: "Decision Maker Bought-In" },
  { key: "contractsent", label: "Contract Sent" },
  { key: "closedwon", label: "Closed Won" },
];

const LIFECYCLE_ORDER: { key: string; label: string }[] = [
  { key: "subscriber", label: "Subscriber" },
  { key: "lead", label: "Lead" },
  { key: "opportunity", label: "Opportunity" },
  { key: "customer", label: "Customer" },
];

const TIME_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "all", label: "All Time" },
];

function daysAgo(range: TimeRange): string | null {
  if (range === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - (range === "7d" ? 7 : range === "30d" ? 30 : 90));
  return d.toISOString();
}

function conversionColor(rate: number) {
  if (rate > 20) return "text-emerald-400";
  if (rate >= 10) return "text-yellow-400";
  return "text-red-400";
}

function conversionBadge(rate: number) {
  if (rate > 20)
    return (
      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
        {rate.toFixed(1)}%
      </Badge>
    );
  if (rate >= 10)
    return (
      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
        {rate.toFixed(1)}%
      </Badge>
    );
  return (
    <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
      {rate.toFixed(1)}%
    </Badge>
  );
}

function formatAED(n: number) {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${n.toFixed(0)}`;
}

// ── Data hooks ─────────────────────────────────────────────────────────────
function useDealStages(range: TimeRange) {
  const cutoff = daysAgo(range);
  return useQuery({
    queryKey: ["conversion-funnel-deals", range],
    queryFn: async () => {
      // We need to use RPC or raw select with group by — supabase-js doesn't support group by natively
      // So we fetch all dealstage + amount and aggregate client-side (limited columns, fast)
      let q = supabase
        .from("deals")
        .select("dealstage, amount, created_at");
      if (cutoff) q = q.gte("created_at", cutoff);
      const { data, error } = await q;
      if (error) throw error;

      const map = new Map<string, { count: number; amount: number }>();
      for (const row of data ?? []) {
        const stage = row.dealstage ?? "unknown";
        const prev = map.get(stage) ?? { count: 0, amount: 0 };
        prev.count++;
        prev.amount += Number(row.amount ?? 0);
        map.set(stage, prev);
      }

      return DEAL_STAGE_ORDER.map((s) => ({
        stage: s.key,
        label: s.label,
        count: map.get(s.key)?.count ?? 0,
        amount: map.get(s.key)?.amount ?? 0,
      }));
    },
    staleTime: 5 * 60_000,
  });
}

function useLifecycleStages(range: TimeRange) {
  const cutoff = daysAgo(range);
  return useQuery({
    queryKey: ["conversion-funnel-lifecycle", range],
    queryFn: async () => {
      let q = supabase.from("contacts").select("lifecycle_stage, created_at");
      if (cutoff) q = q.gte("created_at", cutoff);
      const { data, error } = await q;
      if (error) throw error;

      const map = new Map<string, number>();
      for (const row of data ?? []) {
        const stage = (row.lifecycle_stage ?? "unknown").toLowerCase();
        map.set(stage, (map.get(stage) ?? 0) + 1);
      }

      return LIFECYCLE_ORDER.map((s) => ({
        stage: s.key,
        label: s.label,
        count: map.get(s.key) ?? 0,
      }));
    },
    staleTime: 5 * 60_000,
  });
}

function useLeadJourney() {
  return useQuery({
    queryKey: ["conversion-funnel-journey"],
    queryFn: async () => {
      // Get contacts with lifecycle_stage = customer and their created_at
      const { data: customers, error: cErr } = await supabase
        .from("contacts")
        .select("email, created_at, lifecycle_stage")
        .eq("lifecycle_stage", "customer");
      if (cErr) throw cErr;

      // Get closed-won deals with closedate
      const { data: wonDeals, error: dErr } = await supabase
        .from("deals")
        .select("contact_email, closedate, created_at")
        .eq("dealstage", "closedwon");
      if (dErr) throw dErr;

      // Build a map of contact_email -> earliest deal closedate
      const dealMap = new Map<string, string>();
      for (const d of wonDeals ?? []) {
        const email = d.contact_email;
        if (!email) continue;
        const existing = dealMap.get(email);
        if (!existing || (d.closedate && d.closedate < existing)) {
          dealMap.set(email, d.closedate ?? d.created_at ?? "");
        }
      }

      // Calculate average days from contact created → deal closed
      const daysToClose: number[] = [];
      for (const c of customers ?? []) {
        if (!c.email || !c.created_at) continue;
        const close = dealMap.get(c.email);
        if (!close) continue;
        const diff =
          (new Date(close).getTime() - new Date(c.created_at).getTime()) /
          (1000 * 60 * 60 * 24);
        if (diff > 0 && diff < 3650) daysToClose.push(diff);
      }

      const avg =
        daysToClose.length > 0
          ? daysToClose.reduce((a, b) => a + b, 0) / daysToClose.length
          : 0;
      const median =
        daysToClose.length > 0
          ? daysToClose.sort((a, b) => a - b)[
              Math.floor(daysToClose.length / 2)
            ]
          : 0;

      return {
        avgDays: Math.round(avg),
        medianDays: Math.round(median),
        sampleSize: daysToClose.length,
      };
    },
    staleTime: 10 * 60_000,
  });
}

// ── CSV Export ──────────────────────────────────────────────────────────────
function exportCSV(dealStages: StageRow[], lifecycle: { stage: string; label: string; count: number }[]) {
  const lines = ["Section,Stage,Count,Amount (AED),Conversion %"];
  for (let i = 0; i < dealStages.length; i++) {
    const s = dealStages[i];
    const rate =
      i === 0
        ? 100
        : dealStages[i - 1].count > 0
        ? (s.count / dealStages[i - 1].count) * 100
        : 0;
    lines.push(
      `Deal Pipeline,${s.label},${s.count},${s.amount},${rate.toFixed(1)}`
    );
  }
  for (let i = 0; i < lifecycle.length; i++) {
    const s = lifecycle[i];
    const rate =
      i === 0
        ? 100
        : lifecycle[i - 1].count > 0
        ? (s.count / lifecycle[i - 1].count) * 100
        : 0;
    lines.push(`Lifecycle,${s.label},${s.count},,${rate.toFixed(1)}`);
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `conversion-funnel-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Funnel Visual ──────────────────────────────────────────────────────────
function FunnelBar({
  label,
  count,
  amount,
  maxCount,
  conversionRate,
  isFirst,
}: {
  label: string;
  count: number;
  amount?: number;
  maxCount: number;
  conversionRate: number;
  isFirst: boolean;
}) {
  const widthPct = maxCount > 0 ? Math.max((count / maxCount) * 100, 8) : 8;
  return (
    <div className="flex flex-col items-center gap-1">
      {!isFirst && (
        <div className="flex items-center gap-2">
          <ArrowDown className="h-4 w-4 text-zinc-500" />
          <span className={`text-xs font-medium ${conversionColor(conversionRate)}`}>
            {conversionRate.toFixed(1)}%
          </span>
        </div>
      )}
      <div
        className="relative rounded-lg bg-gradient-to-r from-blue-600/80 to-blue-500/60 border border-blue-500/30 cursor-pointer hover:bg-muted/30 transition-colors duration-200 flex items-center justify-between px-4 py-3"
        style={{ width: `${widthPct}%`, minWidth: "200px" }}
      >
        <span className="text-sm font-medium text-zinc-100 truncate">
          {label}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm font-bold text-zinc-100">
            {count.toLocaleString()}
          </span>
          {amount != null && amount > 0 && (
            <span className="text-xs text-zinc-300">{formatAED(amount)}</span>
          )}
          {!isFirst && conversionBadge(conversionRate)}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ConversionFunnel() {
  const [range, setRange] = useState<TimeRange>("all");

  const { data: dealStages, isLoading: loadingDeals } = useDealStages(range);
  const { data: lifecycle, isLoading: loadingLifecycle } =
    useLifecycleStages(range);
  const { data: journey, isLoading: loadingJourney } = useLeadJourney();

  const isLoading = loadingDeals || loadingLifecycle;

  const totalContacts = useMemo(
    () => (lifecycle ?? []).reduce((s, l) => s + l.count, 0),
    [lifecycle]
  );
  const totalDeals = useMemo(
    () => (dealStages ?? []).reduce((s, d) => s + d.count, 0),
    [dealStages]
  );
  const totalRevenue = useMemo(
    () => (dealStages ?? []).reduce((s, d) => s + d.amount, 0),
    [dealStages]
  );
  const wonCount = useMemo(
    () => dealStages?.find((d) => d.stage === "closedwon")?.count ?? 0,
    [dealStages]
  );
  const wonAmount = useMemo(
    () => dealStages?.find((d) => d.stage === "closedwon")?.amount ?? 0,
    [dealStages]
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">
            Conversion Funnel
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            HubSpot deal pipeline & contact lifecycle — real data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Time range filter */}
          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
            <Filter className="h-4 w-4 text-zinc-400 ml-2" />
            {TIME_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={range === opt.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setRange(opt.value)}
                className={`cursor-pointer hover:bg-muted/30 transition-colors duration-200 text-xs ${
                  range === opt.value
                    ? "bg-blue-600 text-white"
                    : "text-zinc-400"
                }`}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              dealStages &&
              lifecycle &&
              exportCSV(dealStages, lifecycle)
            }
            className="cursor-pointer hover:bg-muted/30 transition-colors duration-200"
          >
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
              <Users className="h-3.5 w-3.5" /> Total Contacts
            </div>
            <p className="text-2xl font-bold text-zinc-100">
              {isLoading ? "…" : totalContacts.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
              <TrendingDown className="h-3.5 w-3.5" /> Total Deals
            </div>
            <p className="text-2xl font-bold text-zinc-100">
              {isLoading ? "…" : totalDeals.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
              <DollarSign className="h-3.5 w-3.5" /> Closed Won
            </div>
            <p className="text-2xl font-bold text-emerald-400">
              {isLoading ? "…" : formatAED(wonAmount)}
            </p>
            <p className="text-xs text-zinc-500">
              {wonCount.toLocaleString()} deals
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
              <Clock className="h-3.5 w-3.5" /> Avg Days to Close
            </div>
            <p className="text-2xl font-bold text-zinc-100">
              {loadingJourney ? "…" : journey?.avgDays ?? "—"}
            </p>
            <p className="text-xs text-zinc-500">
              median: {journey?.medianDays ?? "—"}d ({journey?.sampleSize ?? 0}{" "}
              samples)
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* Contact Lifecycle Funnel */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-zinc-100 text-lg">
                Contact Lifecycle Funnel
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-1">
              {(lifecycle ?? []).map((s, i) => {
                const prev = i === 0 ? s.count : (lifecycle ?? [])[i - 1].count;
                const rate = prev > 0 ? (s.count / prev) * 100 : 0;
                return (
                  <FunnelBar
                    key={s.stage}
                    label={s.label}
                    count={s.count}
                    maxCount={(lifecycle ?? [])[0]?.count ?? 1}
                    conversionRate={rate}
                    isFirst={i === 0}
                  />
                );
              })}
            </CardContent>
          </Card>

          {/* Deal Pipeline Funnel */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-zinc-100 text-lg">
                Deal Pipeline Funnel
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-1">
              {(dealStages ?? []).map((s, i) => {
                const prev =
                  i === 0 ? s.count : (dealStages ?? [])[i - 1].count;
                const rate = prev > 0 ? (s.count / prev) * 100 : 0;
                return (
                  <FunnelBar
                    key={s.stage}
                    label={s.label}
                    count={s.count}
                    amount={s.amount}
                    maxCount={(dealStages ?? [])[0]?.count ?? 1}
                    conversionRate={rate}
                    isFirst={i === 0}
                  />
                );
              })}
            </CardContent>
          </Card>

          {/* Detailed Table */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-zinc-100 text-lg">
                Stage Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800">
                    <TableHead className="text-zinc-400">Section</TableHead>
                    <TableHead className="text-zinc-400">Stage</TableHead>
                    <TableHead className="text-zinc-400 text-right">
                      Count
                    </TableHead>
                    <TableHead className="text-zinc-400 text-right">
                      Amount
                    </TableHead>
                    <TableHead className="text-zinc-400 text-right">
                      Conv. Rate
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(lifecycle ?? []).map((s, i) => {
                    const prev =
                      i === 0 ? s.count : (lifecycle ?? [])[i - 1].count;
                    const rate = prev > 0 ? (s.count / prev) * 100 : 0;
                    return (
                      <TableRow
                        key={`lc-${s.stage}`}
                        className="border-zinc-800 cursor-pointer hover:bg-muted/30 transition-colors duration-200"
                      >
                        <TableCell className="text-zinc-400 text-xs">
                          Lifecycle
                        </TableCell>
                        <TableCell className="text-zinc-100">
                          {s.label}
                        </TableCell>
                        <TableCell className="text-right text-zinc-100">
                          {s.count.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-zinc-500">
                          —
                        </TableCell>
                        <TableCell className="text-right">
                          {i === 0 ? (
                            <span className="text-zinc-500">—</span>
                          ) : (
                            conversionBadge(rate)
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(dealStages ?? []).map((s, i) => {
                    const prev =
                      i === 0 ? s.count : (dealStages ?? [])[i - 1].count;
                    const rate = prev > 0 ? (s.count / prev) * 100 : 0;
                    return (
                      <TableRow
                        key={`ds-${s.stage}`}
                        className="border-zinc-800 cursor-pointer hover:bg-muted/30 transition-colors duration-200"
                      >
                        <TableCell className="text-zinc-400 text-xs">
                          Pipeline
                        </TableCell>
                        <TableCell className="text-zinc-100">
                          {s.label}
                        </TableCell>
                        <TableCell className="text-right text-zinc-100">
                          {s.count.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-zinc-100">
                          {s.amount > 0 ? formatAED(s.amount) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {i === 0 ? (
                            <span className="text-zinc-500">—</span>
                          ) : (
                            conversionBadge(rate)
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Lead Journey */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-zinc-100 text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-400" />
                Lead Journey Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingJourney ? (
                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              ) : (
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-8">
                    {/* Journey visualization */}
                    <div className="flex items-center gap-2">
                      <div className="bg-blue-600/20 border border-blue-500/30 rounded-lg px-4 py-2 text-center">
                        <p className="text-xs text-zinc-400">Contact Created</p>
                        <p className="text-sm font-bold text-zinc-100">Day 0</p>
                      </div>
                      <div className="w-16 h-0.5 bg-zinc-700 relative">
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-zinc-500 whitespace-nowrap">
                          avg journey
                        </span>
                      </div>
                      <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-lg px-4 py-2 text-center">
                        <p className="text-xs text-zinc-400">Closed Won</p>
                        <p className="text-sm font-bold text-emerald-400">
                          Day {journey?.avgDays ?? "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500 ml-4">
                    Median: {journey?.medianDays ?? "—"} days •{" "}
                    {journey?.sampleSize ?? 0} matched contacts
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
