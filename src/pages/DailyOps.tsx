import { useState, useMemo, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import {
  Activity,
  Users,
  AlertTriangle,
  TrendingDown,
  Download,
  Phone,
  MessageCircle,
  ArrowDown,
  Trophy,
  Medal,
  Award,
} from "lucide-react";
import {
  useDailyOps,
  type CriticalPackage,
  type CoachLeaderboardEntry,
  type DecliningClient,
} from "@/hooks/useDailyOps";

// ── CSV Export Utility ──

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── KPI Card ──

function KpiCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: "emerald" | "blue" | "red" | "orange";
  subtitle?: string;
}) {
  const colorMap = {
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400",
    blue: "from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400",
    red: "from-red-500/20 to-red-500/5 border-red-500/30 text-red-400",
    orange: "from-orange-500/20 to-orange-500/5 border-orange-500/30 text-orange-400",
  };

  return (
    <Card className={`bg-gradient-to-br ${colorMap[color]} border`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {title}
            </p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <Icon className={`h-8 w-8 opacity-60 ${colorMap[color].split(" ").pop()}`} />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Sort helper ──

type SortDir = "asc" | "desc";

function useSortable<T>(data: T[], defaultKey: keyof T, defaultDir: SortDir = "desc") {
  const [sortKey, setSortKey] = useState<keyof T>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = Number(a[sortKey]) || 0;
      const bv = Number(b[sortKey]) || 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [data, sortKey, sortDir]);

  const toggle = useCallback(
    (key: keyof T) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey],
  );

  return { sorted, sortKey, sortDir, toggle };
}

// ── Rank Badge ──

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-400" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-300" />;
  if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
  return <span className="text-muted-foreground font-mono text-sm">{rank}</span>;
}

// ── Frequency Chart (simple bar) ──

function FrequencyBars({
  increasing,
  stable,
  decreasing,
}: {
  increasing: number;
  stable: number;
  decreasing: number;
}) {
  const total = increasing + stable + decreasing || 1;
  const pct = (v: number) => Math.round((v / total) * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-widest">
          Frequency Trends
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[
          { label: "Increasing", value: increasing, color: "bg-emerald-500", pctVal: pct(increasing) },
          { label: "Stable", value: stable, color: "bg-blue-500", pctVal: pct(stable) },
          { label: "Declining", value: decreasing, color: "bg-red-500", pctVal: pct(decreasing) },
        ].map((item) => (
          <div key={item.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-mono">
                {item.value} ({item.pctVal}%)
              </span>
            </div>
            <div className="h-3 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full ${item.color} rounded-full transition-all`}
                style={{ width: `${item.pctVal}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Main Page ──

export default function DailyOps() {
  const { data, isLoading } = useDailyOps();

  if (isLoading) return <PageSkeleton variant="dashboard" />;
  if (!data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight mb-6">Daily Operations</h1>
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Activity className="h-8 w-8 mb-3 opacity-50" />
          <p className="text-sm">No ops snapshot available</p>
          <p className="text-xs mt-1">Run the daily pipeline to generate data</p>
        </div>
      </div>
    );
  }

  const allPackages: CriticalPackage[] = [
    ...(data.critical_packages ?? []),
    ...(data.high_packages ?? []),
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Operations</h1>
          <p className="text-sm text-muted-foreground">
            Snapshot: {data.snapshot_date}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          <Activity className="h-3 w-3 mr-1" /> Live
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Sessions Today"
          value={data.sessions_today}
          subtitle={`${data.sessions_confirmed_today} confirmed`}
          icon={Activity}
          color="emerald"
        />
        <KpiCard
          title="Active Clients"
          value={data.active_clients_30d}
          subtitle={`${data.total_packages_active} packages`}
          icon={Users}
          color="blue"
        />
        <KpiCard
          title="Packages at Risk"
          value={data.packages_critical + data.packages_high}
          subtitle={`${data.packages_critical} critical · ${data.packages_high} high`}
          icon={AlertTriangle}
          color={data.packages_critical > 0 ? "red" : "orange"}
        />
        <KpiCard
          title="Declining Clients"
          value={data.clients_decreasing}
          subtitle={`${data.clients_increasing} improving`}
          icon={TrendingDown}
          color={data.clients_decreasing > 5 ? "red" : "orange"}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="packages" className="space-y-4">
        <TabsList>
          <TabsTrigger value="packages">Package Alerts</TabsTrigger>
          <TabsTrigger value="coaches">Coach Leaderboard</TabsTrigger>
          <TabsTrigger value="declining">Declining Clients</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* ── Package Alerts ── */}
        <TabsContent value="packages">
          <PackageAlertsTable packages={allPackages} />
        </TabsContent>

        {/* ── Coach Leaderboard ── */}
        <TabsContent value="coaches">
          <CoachLeaderboardTable coaches={data.coach_leaderboard ?? []} />
        </TabsContent>

        {/* ── Declining Clients ── */}
        <TabsContent value="declining">
          <DecliningClientsTable clients={data.declining_clients ?? []} />
        </TabsContent>

        {/* ── Trends ── */}
        <TabsContent value="trends">
          <FrequencyBars
            increasing={data.clients_increasing}
            stable={data.clients_stable}
            decreasing={data.clients_decreasing}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Package Alerts Table ──

function PackageAlertsTable({ packages }: { packages: CriticalPackage[] }) {
  const exportCSV = () => {
    downloadCSV(
      "package-alerts.csv",
      ["Client", "Phone", "Package", "Remaining", "Coach", "Rate/wk", "Booked", "Priority"],
      packages.map((p) => [
        p.client_name,
        p.client_phone,
        p.package_name,
        String(p.remaining_sessions),
        p.last_coach,
        String(p.sessions_per_week),
        String(p.future_booked),
        p.depletion_priority,
      ]),
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-widest">
          Package Alerts ({packages.length})
        </CardTitle>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-3 w-3 mr-1" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Package</TableHead>
              <TableHead className="text-right">Left</TableHead>
              <TableHead>Coach</TableHead>
              <TableHead className="text-right">Rate/wk</TableHead>
              <TableHead className="text-right">Booked</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.map((p, i) => {
              const isCritical = p.depletion_priority === "CRITICAL";
              return (
                <TableRow
                  key={`${p.client_name}-${i}`}
                  className={`cursor-pointer hover:bg-muted/30 transition-colors ${isCritical ? "bg-red-500/5" : "bg-orange-500/5"}`}
                >
                  <TableCell className="font-medium">{p.client_name}</TableCell>
                  <TableCell className="font-mono text-xs">{p.client_phone}</TableCell>
                  <TableCell>{p.package_name}</TableCell>
                  <TableCell className="text-right font-bold">
                    <span className={isCritical ? "text-red-400" : "text-orange-400"}>
                      {p.remaining_sessions}
                    </span>
                  </TableCell>
                  <TableCell>{p.last_coach}</TableCell>
                  <TableCell className="text-right">{p.sessions_per_week}</TableCell>
                  <TableCell className="text-right">{p.future_booked}</TableCell>
                  <TableCell>
                    <Badge variant={isCritical ? "destructive" : "outline"} className="text-[10px]">
                      {p.depletion_priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => window.open(`tel:${p.client_phone}`)}
                      >
                        <Phone className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() =>
                          window.open(
                            `https://wa.me/${p.client_phone.replace(/[^0-9+]/g, "")}`,
                          )
                        }
                      >
                        <MessageCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {packages.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No package alerts 🎉
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Coach Leaderboard Table ──

function CoachLeaderboardTable({ coaches }: { coaches: CoachLeaderboardEntry[] }) {
  const { sorted, toggle } = useSortable(coaches, "total_completed", "desc");

  const exportCSV = () => {
    downloadCSV(
      "coach-leaderboard.csv",
      ["Rank", "Coach", "Avg/Day", "Completed", "Completion%", "Clients", "Retention%"],
      sorted.map((c, i) => [
        String(i + 1),
        c.coach_name,
        c.avg_sessions_per_day,
        String(c.total_completed),
        c.completion_rate,
        String(c.clients_90d),
        c.retention_14d_pct,
      ]),
    );
  };

  const SortHead = ({ label, field }: { label: string; field: keyof CoachLeaderboardEntry }) => (
    <TableHead
      className="cursor-pointer hover:text-white select-none"
      onClick={() => toggle(field)}
    >
      {label}
    </TableHead>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-widest">
          Coach Leaderboard ({coaches.length})
        </CardTitle>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-3 w-3 mr-1" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Coach</TableHead>
              <SortHead label="Avg/Day" field="avg_sessions_per_day" />
              <SortHead label="Completed" field="total_completed" />
              <TableHead>Completion %</TableHead>
              <SortHead label="Clients" field="clients_90d" />
              <SortHead label="Retention %" field="retention_14d_pct" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((c, i) => {
              const rate = parseFloat(c.completion_rate);
              const rateColor =
                rate >= 85 ? "bg-emerald-500" : rate >= 70 ? "bg-yellow-500" : "bg-red-500";
              return (
                <TableRow key={c.coach_name}>
                  <TableCell>
                    <RankBadge rank={i + 1} />
                  </TableCell>
                  <TableCell className="font-medium">{c.coach_name}</TableCell>
                  <TableCell className="font-mono">{c.avg_sessions_per_day}</TableCell>
                  <TableCell className="font-mono">{c.total_completed}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${rateColor} rounded-full`}
                          style={{ width: `${Math.min(rate, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono">{c.completion_rate}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{c.clients_90d}</TableCell>
                  <TableCell className="font-mono">{c.retention_14d_pct}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Declining Clients Table ──

function DecliningClientsTable({ clients }: { clients: DecliningClient[] }) {
  const exportCSV = () => {
    downloadCSV(
      "declining-clients.csv",
      ["Client", "Phone", "Was (4w)", "Now (4w)", "Change", "Coach"],
      clients.map((c) => [
        c.client_name,
        c.phone_number,
        String(c.prior_4w),
        String(c.recent_4w),
        String(c.change),
        c.coach,
      ]),
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-widest">
          Declining Clients ({clients.length})
        </CardTitle>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-3 w-3 mr-1" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Was (4wk)</TableHead>
              <TableHead className="text-right">Now (4wk)</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead>Coach</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((c, i) => (
              <TableRow key={`${c.client_name}-${i}`}>
                <TableCell className="font-medium">{c.client_name}</TableCell>
                <TableCell className="font-mono text-xs">{c.phone_number}</TableCell>
                <TableCell className="text-right font-mono">{c.prior_4w}</TableCell>
                <TableCell className="text-right font-mono">{c.recent_4w}</TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center gap-1 text-red-400 font-bold font-mono">
                    <ArrowDown className="h-3 w-3" />
                    {Math.abs(c.change)}
                  </span>
                </TableCell>
                <TableCell>{c.coach}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => window.open(`tel:${c.phone_number}`)}
                    >
                      <Phone className="h-3 w-3 mr-1" /> Call
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        window.open(
                          `https://wa.me/${c.phone_number.replace(/[^0-9+]/g, "")}`,
                        )
                      }
                    >
                      <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No declining clients 🎉
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
