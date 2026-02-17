import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { CHART_COLORS, RECHARTS_PALETTE, CHART_AXIS } from "@/lib/chartColors";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Headphones,
  ArrowUpDown,
  TrendingUp,
  Phone,
  DollarSign,
  AlertTriangle,
  Trophy,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SetterPerformance {
  setter_id: number;
  total_calls: number;
  outbound_calls: number;
  inbound_calls: number;
  completed_calls: number;
  unanswered_calls: number;
  missed_calls: number;
  very_short_calls: number;
  short_calls: number;
  medium_calls: number;
  long_calls: number;
  avg_duration_seconds: number;
  total_talk_hours: number;
  connection_rate: number;
  appointment_rate: number;
  calls_30d: number;
  completed_30d: number;
  calls_7d: number;
  completed_7d: number;
  total_deals: number;
  won_deals: number;
  lost_deals: number;
  revenue_aed: number;
  won_deals_30d: number;
  revenue_30d_aed: number;
  total_contacts: number;
  customers: number;
  sqls: number;
  leads_assigned: number;
  calls_per_deal: number;
  avg_deal_value_aed: number;
}

interface DailyCallActivity {
  setter_id: number;
  call_date: string;
  total_calls: number;
  outbound: number;
  completed: number;
  unanswered: number;
  missed: number;
  very_short: number;
  avg_duration_ms: number;
  total_talk_ms: number;
  appointments_set: number;
  with_recording: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SETTER_NAMES: Record<number, string> = {
  452974662: "Matthew Twigg",
  85674007: "Philips Ad",
  87154383: "Rebecca Johnson",
  82655976: "Mazen Moussa",
  49635184: "Marko Antic",
  87875713: "Yehia Salah",
};

const SETTER_COLORS: Record<number, string> = {
  452974662: RECHARTS_PALETTE[0],
  85674007: RECHARTS_PALETTE[1],
  87154383: RECHARTS_PALETTE[2],
  82655976: RECHARTS_PALETTE[3],
  49635184: RECHARTS_PALETTE[4],
  87875713: RECHARTS_PALETTE[5],
};

const AED_USD_RATE = 0.27;
const formatAED = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format;
const formatUSD = (aed: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(aed * AED_USD_RATE);

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function getName(id: number): string {
  return SETTER_NAMES[id] ?? `Setter ${id}`;
}

// ─── Data Hooks ──────────────────────────────────────────────────────────────

function useSetterPerformance() {
  return useDedupedQuery<SetterPerformance[]>({
    queryKey: ["setter-command-center", "performance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_setter_performance")
        .select("*");
      if (error) throw error;
      return (data ?? []) as SetterPerformance[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

function useDailyActivity() {
  return useDedupedQuery<DailyCallActivity[]>({
    queryKey: ["setter-command-center", "daily-activity"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await supabase
        .from("view_daily_call_activity")
        .select("*")
        .gte("call_date", thirtyDaysAgo.toISOString().split("T")[0])
        .order("call_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DailyCallActivity[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Mini Sparkline ──────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return <span className="text-muted-foreground text-xs">No data</span>;
  const max = Math.max(...data, 1);
  const h = 24;
  const w = 80;
  const step = w / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={CHART_COLORS.neutral}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function getSetterStatus(
  setterId: number,
  dailyData: DailyCallActivity[]
): { label: string; color: string } {
  const setterDays = dailyData
    .filter((d) => d.setter_id === setterId)
    .sort((a, b) => b.call_date.localeCompare(a.call_date));

  if (!setterDays.length) return { label: "Inactive", color: "bg-zinc-600" };

  const latest = new Date(setterDays[0].call_date);
  const now = new Date();
  const diffH = (now.getTime() - latest.getTime()) / (1000 * 60 * 60);

  if (diffH <= 48) return { label: "Active", color: "bg-emerald-500" };
  if (diffH <= 7 * 24) return { label: "Idle", color: "bg-amber-500" };
  return { label: "Inactive", color: "bg-zinc-600" };
}

// ─── Connection Rate Badge ───────────────────────────────────────────────────

function ConnectionBadge({ rate }: { rate: number }) {
  const pct = (rate * 100).toFixed(1);
  const cls =
    rate > 0.4
      ? "bg-emerald-500/20 text-emerald-400"
      : rate >= 0.3
        ? "bg-amber-500/20 text-amber-400"
        : "bg-rose-500/20 text-rose-400";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{pct}%</span>;
}

// ─── Section 1: Scorecard Grid ───────────────────────────────────────────────

function ScorecardGrid({
  setters,
  daily,
}: {
  setters: SetterPerformance[];
  daily: DailyCallActivity[];
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {setters.map((s) => {
        const status = getSetterStatus(s.setter_id, daily);
        const last7 = daily
          .filter((d) => d.setter_id === s.setter_id)
          .sort((a, b) => a.call_date.localeCompare(b.call_date))
          .slice(-7)
          .map((d) => d.total_calls);
        const initial = getName(s.setter_id).charAt(0);

        return (
          <div
            key={s.setter_id}
            className="bg-card border border-border rounded-xl p-6 flex flex-col gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg">
                {initial}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-foreground">{getName(s.setter_id)}</div>
                <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium text-white ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <ConnectionBadge rate={s.connection_rate ?? 0} />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <div className="text-muted-foreground">7d</div>
                <div className="font-semibold text-foreground">{s.calls_7d ?? 0}</div>
              </div>
              <div>
                <div className="text-muted-foreground">30d</div>
                <div className="font-semibold text-foreground">{s.calls_30d ?? 0}</div>
              </div>
              <div>
                <div className="text-muted-foreground">All</div>
                <div className="font-semibold text-foreground">{s.total_calls ?? 0}</div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <div>
                <div className="text-muted-foreground">Revenue</div>
                <div className="font-semibold text-foreground">{formatAED(s.revenue_aed ?? 0)}</div>
                <div className="text-muted-foreground">{formatUSD(s.revenue_aed ?? 0)}</div>
              </div>
              <div className="text-right">
                <div className="text-muted-foreground">Calls/Deal</div>
                <div className="font-semibold text-foreground">{(s.calls_per_deal ?? 0).toFixed(1)}</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Sparkline data={last7} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Section 2: Comparison Table ─────────────────────────────────────────────

type SortKey =
  | "name" | "calls_7d" | "calls_30d" | "total_calls" | "completed_7d" | "completed_30d"
  | "connection_rate" | "unanswered" | "missed" | "very_short" | "avg_duration"
  | "talk_hours" | "appointments" | "won_deals" | "total_deals" | "revenue"
  | "rev_per_call" | "calls_per_deal" | "avg_deal";

interface ColDef {
  key: SortKey;
  label: string;
  getValue: (s: SetterPerformance) => number | string;
  format?: (v: number) => string;
  isHigherBetter?: boolean;
  flagRed?: (s: SetterPerformance) => boolean;
}

const COLUMNS: ColDef[] = [
  { key: "name", label: "Setter", getValue: (s) => getName(s.setter_id) },
  { key: "calls_7d", label: "7d", getValue: (s) => s.calls_7d ?? 0, isHigherBetter: true },
  { key: "calls_30d", label: "30d", getValue: (s) => s.calls_30d ?? 0, isHigherBetter: true },
  { key: "total_calls", label: "Total", getValue: (s) => s.total_calls ?? 0, isHigherBetter: true },
  { key: "completed_7d", label: "7d Conn", getValue: (s) => s.completed_7d ?? 0, isHigherBetter: true },
  { key: "completed_30d", label: "30d Conn", getValue: (s) => s.completed_30d ?? 0, isHigherBetter: true },
  { key: "connection_rate", label: "Conn %", getValue: (s) => s.connection_rate ?? 0, format: (v) => `${(v * 100).toFixed(1)}%`, isHigherBetter: true },
  { key: "unanswered", label: "Unans.", getValue: (s) => s.unanswered_calls ?? 0, isHigherBetter: false },
  { key: "missed", label: "Missed", getValue: (s) => s.missed_calls ?? 0, isHigherBetter: false },
  {
    key: "very_short", label: "<5s", getValue: (s) => s.very_short_calls ?? 0,
    isHigherBetter: false,
    flagRed: (s) => s.total_calls > 0 && (s.very_short_calls ?? 0) / s.total_calls > 0.1,
  },
  { key: "avg_duration", label: "Avg Dur", getValue: (s) => s.avg_duration_seconds ?? 0, format: (v) => formatDuration(v), isHigherBetter: true },
  { key: "talk_hours", label: "Talk Hrs", getValue: (s) => s.total_talk_hours ?? 0, format: (v) => v.toFixed(1), isHigherBetter: true },
  { key: "appointments", label: "Appts", getValue: (s) => s.appointment_rate ?? 0, format: (v) => `${(v * 100).toFixed(1)}%`, isHigherBetter: true },
  { key: "won_deals", label: "Won", getValue: (s) => s.won_deals ?? 0, isHigherBetter: true },
  { key: "total_deals", label: "Deals", getValue: (s) => s.total_deals ?? 0, isHigherBetter: true },
  { key: "revenue", label: "Revenue", getValue: (s) => s.revenue_aed ?? 0, format: (v) => formatAED(v), isHigherBetter: true },
  {
    key: "rev_per_call", label: "Rev/Call",
    getValue: (s) => (s.completed_calls ?? 0) > 0 ? (s.revenue_aed ?? 0) / s.completed_calls : 0,
    format: (v) => formatAED(v), isHigherBetter: true,
  },
  { key: "calls_per_deal", label: "Calls/Deal", getValue: (s) => s.calls_per_deal ?? 0, format: (v) => v.toFixed(1), isHigherBetter: false },
  { key: "avg_deal", label: "Avg Deal", getValue: (s) => s.avg_deal_value_aed ?? 0, format: (v) => formatAED(v), isHigherBetter: true },
];

function ComparisonTable({ setters }: { setters: SetterPerformance[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);

  const topPerformers = useMemo(() => {
    const tops: Record<string, number> = {};
    for (const col of COLUMNS) {
      if (col.key === "name" || col.isHigherBetter === undefined) continue;
      let bestId = -1;
      let bestVal = col.isHigherBetter ? -Infinity : Infinity;
      for (const s of setters) {
        const v = col.getValue(s);
        if (typeof v !== "number") continue;
        if (col.isHigherBetter ? v > bestVal : v < bestVal) {
          bestVal = v;
          bestId = s.setter_id;
        }
      }
      if (bestId >= 0) tops[col.key] = bestId;
    }
    return tops;
  }, [setters]);

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey);
    if (!col) return setters;
    return [...setters].sort((a, b) => {
      const va = col.getValue(a);
      const vb = col.getValue(b);
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return sortAsc ? cmp : -cmp;
    });
  }, [setters, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="px-2 py-2 text-left text-muted-foreground font-medium cursor-pointer hover:text-foreground whitespace-nowrap"
                onClick={() => handleSort(col.key)}
              >
                {col.label}
                {sortKey === col.key && <ArrowUpDown className="inline ml-1 w-3 h-3" />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.setter_id} className="border-b border-border/50 hover:bg-muted/20">
              {COLUMNS.map((col) => {
                const raw = col.getValue(s);
                const isTop = topPerformers[col.key] === s.setter_id;
                const isRed = col.flagRed?.(s);
                const display =
                  col.key === "name"
                    ? raw
                    : col.format
                      ? col.format(raw as number)
                      : raw;
                return (
                  <td
                    key={col.key}
                    className={`px-2 py-2 whitespace-nowrap ${isRed ? "text-rose-400 font-bold" : "text-foreground"} ${isTop ? "ring-1 ring-amber-400/60 rounded bg-amber-400/5" : ""}`}
                  >
                    {display}
                    {isTop && <Trophy className="inline ml-1 w-3 h-3 text-amber-400" />}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Section 3: Daily Activity Chart ─────────────────────────────────────────

function DailyActivityChart({ daily }: { daily: DailyCallActivity[] }) {
  const [metric, setMetric] = useState<"total_calls" | "completed">("total_calls");
  const setterIds = useMemo(() => [...new Set(daily.map((d) => d.setter_id))], [daily]);

  const chartData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {};
    for (const d of daily) {
      if (!byDate[d.call_date]) byDate[d.call_date] = { date: 0 };
      byDate[d.call_date][`s_${d.setter_id}`] = metric === "total_calls" ? d.total_calls : d.completed;
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date, ...vals }));
  }, [daily, metric]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          className={`px-3 py-1 rounded text-xs font-medium ${metric === "total_calls" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          onClick={() => setMetric("total_calls")}
        >
          Total Calls
        </button>
        <button
          className={`px-3 py-1 rounded text-xs font-medium ${metric === "completed" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          onClick={() => setMetric("completed")}
        >
          Completed
        </button>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <CartesianGrid stroke={CHART_AXIS.gridStroke} strokeOpacity={CHART_AXIS.gridOpacity} />
          <XAxis
            dataKey="date"
            stroke={CHART_AXIS.stroke}
            tick={{ fill: CHART_AXIS.tickFill, fontSize: 10 }}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis stroke={CHART_AXIS.stroke} tick={{ fill: CHART_AXIS.tickFill, fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Legend />
          {setterIds.map((id) => (
            <Area
              key={id}
              type="monotone"
              dataKey={`s_${id}`}
              name={getName(id)}
              stackId="1"
              fill={SETTER_COLORS[id] ?? CHART_COLORS.secondary}
              stroke={SETTER_COLORS[id] ?? CHART_COLORS.secondary}
              fillOpacity={0.4}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Section 4: Quality Flags ────────────────────────────────────────────────

interface Alert {
  icon: string;
  message: string;
  severity: "red" | "yellow" | "green" | "black";
}

function generateAlerts(
  setters: SetterPerformance[],
  daily: DailyCallActivity[]
): Alert[] {
  const alerts: Alert[] = [];

  for (const s of setters) {
    const name = getName(s.setter_id);

    if ((s.very_short_calls ?? 0) > 5) {
      alerts.push({
        icon: "🔴",
        message: `${name} has ${s.very_short_calls} very short calls (<5s) — potential missed callbacks`,
        severity: "red",
      });
    }

    if ((s.connection_rate ?? 0) < 0.3) {
      alerts.push({
        icon: "🟡",
        message: `${name} connection rate below 30% this week`,
        severity: "yellow",
      });
    }

    const status = getSetterStatus(s.setter_id, daily);
    if (status.label === "Idle" || status.label === "Inactive") {
      alerts.push({
        icon: "⚫",
        message: `${name} no activity in last 48 hours`,
        severity: "black",
      });
    }
  }

  // Top performer by revenue per call
  const withRevPerCall = setters
    .filter((s) => (s.completed_calls ?? 0) > 0)
    .map((s) => ({ ...s, rpc: (s.revenue_aed ?? 0) / s.completed_calls }));
  if (withRevPerCall.length > 0) {
    const top = withRevPerCall.reduce((a, b) => (a.rpc > b.rpc ? a : b));
    alerts.push({
      icon: "🟢",
      message: `${getName(top.setter_id)} is top performer — highest revenue per call (${formatAED(top.rpc)})`,
      severity: "green",
    });
  }

  return alerts;
}

function QualityFlags({ setters, daily }: { setters: SetterPerformance[]; daily: DailyCallActivity[] }) {
  const alerts = useMemo(() => generateAlerts(setters, daily), [setters, daily]);

  if (!alerts.length) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm ${
            a.severity === "red"
              ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
              : a.severity === "yellow"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                : a.severity === "green"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
          }`}
        >
          <span>{a.icon}</span>
          <span>{a.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SetterCommandCenter() {
  const { data: setters = [], isLoading: loadingPerf } = useSetterPerformance();
  const { data: daily = [], isLoading: loadingDaily } = useDailyActivity();

  const isLoading = loadingPerf || loadingDaily;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-6 h-48 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Headphones className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Setter Command Center</h1>
      </div>

      {/* Section 1: Scorecard Grid */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Phone className="w-5 h-5" /> Setter Scorecards
        </h2>
        <ScorecardGrid setters={setters} daily={daily} />
      </section>

      {/* Section 2: Comparison Table */}
      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" /> Detailed Comparison
        </h2>
        <ComparisonTable setters={setters} />
      </section>

      {/* Section 3: Daily Activity Chart */}
      <section className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" /> Daily Activity (30 Days)
        </h2>
        <DailyActivityChart daily={daily} />
      </section>

      {/* Section 4: Quality Flags */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Call Quality Flags
        </h2>
        <QualityFlags setters={setters} daily={daily} />
      </section>
    </div>
  );
}
