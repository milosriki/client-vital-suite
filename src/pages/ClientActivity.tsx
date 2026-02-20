import { useState, useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import {
  Phone, MessageCircle, RefreshCw, Download, Search,
  AlertTriangle, Users, Calendar, Activity, TrendingDown,
  TrendingUp, Minus, Clock, UserX, Shield,
} from "lucide-react";
import { useClientActivity, type ClientPackage } from "@/hooks/useClientActivity";
import {
  useSessionIntelligence,
  type ClientSessionProfile,
  type CoachActivityProfile,
  type RedZoneAlert,
} from "@/hooks/useSessionIntelligence";
import { useSessionAIBrain, type AIInsight } from "@/hooks/useSessionAIBrain";
import { formatCurrency } from "@/lib/ceo-utils";

// ── Helpers ──

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/40",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  WATCH: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  SAFE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
};

const FREQ_COLORS: Record<string, string> = {
  Active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  Slowing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  Inactive: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  Ghost: "bg-red-500/20 text-red-400 border-red-500/40",
};

const SEVERITY_COLORS: Record<string, string> = {
  warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  critical: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  ghost: "bg-red-500/20 text-red-400 border-red-500/40",
};

const ROW_BG: Record<string, string> = {
  CRITICAL: "bg-red-500/5",
  HIGH: "bg-orange-500/5",
  ghost: "bg-red-500/5",
  critical: "bg-orange-500/5",
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-400" />;
  if (trend === "stable") return <Minus className="h-4 w-4 text-blue-400" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function daysAgoLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${(days / 365).toFixed(1)}y ago`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return format(new Date(dateStr), "MMM d, yyyy");
}

function remainingColor(n: number) {
  if (n <= 1) return "text-red-400 font-bold";
  if (n <= 3) return "text-orange-400 font-semibold";
  if (n <= 5) return "text-yellow-400";
  return "text-emerald-400";
}

function downloadCSV(rows: ClientPackage[]) {
  const headers = [
    "Client Name", "Phone", "Package", "Remaining", "Total",
    "Last Coach", "Last Session", "Sessions/Week", "Future Booked",
    "Next Session", "Priority",
  ];
  const csvRows = rows.map((r) => [
    r.client_name, r.client_phone, r.package_name,
    String(r.remaining_sessions), String(r.total_sessions),
    r.last_coach, r.last_session_date ?? "",
    String(r.sessions_per_week), String(r.future_booked),
    r.next_session_date ?? "", r.depletion_priority,
  ]);
  const csv = [
    headers.join(","),
    ...csvRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `client-activity-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── KPI Card ──

function KpiCard({
  title, value, icon: Icon, color, subtitle,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: "emerald" | "blue" | "red" | "orange" | "yellow" | "purple";
  subtitle?: string;
}) {
  const colorMap = {
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400",
    blue: "from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400",
    red: "from-red-500/20 to-red-500/5 border-red-500/30 text-red-400",
    orange: "from-orange-500/20 to-orange-500/5 border-orange-500/30 text-orange-400",
    yellow: "from-yellow-500/20 to-yellow-500/5 border-yellow-500/30 text-yellow-400",
    purple: "from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400",
  };

  return (
    <Card className={`bg-gradient-to-br ${colorMap[color]} border`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <Icon className="h-8 w-8 opacity-60" />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──

export default function ClientActivity() {
  const { packages, isLoading: pkgLoading, isFetching: pkgFetching, refetch: refetchPkg } = useClientActivity();
  const {
    clientProfiles, coachProfiles, redZoneAlerts, stats,
    isLoading: siLoading, isFetching: siFetching, refetch: refetchSI,
  } = useSessionIntelligence();
  const aiInsights = useSessionAIBrain(clientProfiles, coachProfiles, redZoneAlerts);

  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [freqFilter, setFreqFilter] = useState("ALL");
  const [tab, setTab] = useState("activity");

  const isLoading = pkgLoading || siLoading;
  const isFetching = pkgFetching || siFetching;
  const refetch = () => { refetchPkg(); refetchSI(); };

  // ── Package filtering (Activity + Renewals tabs) ──
  const filteredPkg = useMemo(() => {
    let rows = packages;
    if (priorityFilter !== "ALL") rows = rows.filter((r) => r.depletion_priority === priorityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        r.client_name?.toLowerCase().includes(q) ||
        r.last_coach?.toLowerCase().includes(q) ||
        r.client_phone?.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [packages, search, priorityFilter]);

  // ── Session intelligence filtering ──
  const filteredProfiles = useMemo(() => {
    let rows = clientProfiles;
    if (freqFilter !== "ALL") rows = rows.filter((r) => r.frequency_label === freqFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        r.client_name?.toLowerCase().includes(q) ||
        r.coach_name?.toLowerCase().includes(q),
      );
    }
    return rows.sort((a, b) => b.days_since_last - a.days_since_last);
  }, [clientProfiles, search, freqFilter]);

  // ── Filtered coaches ──
  const filteredCoaches = useMemo(() => {
    if (!search.trim()) return coachProfiles;
    const q = search.toLowerCase();
    return coachProfiles.filter((c) => c.coach_name?.toLowerCase().includes(q));
  }, [coachProfiles, search]);

  // ── Filtered alerts ──
  const filteredAlerts = useMemo(() => {
    if (!search.trim()) return redZoneAlerts;
    const q = search.toLowerCase();
    return redZoneAlerts.filter((a) =>
      a.client_name?.toLowerCase().includes(q) ||
      a.coach_name?.toLowerCase().includes(q),
    );
  }, [redZoneAlerts, search]);

  const criticalCount = packages.filter((r) => r.depletion_priority === "CRITICAL").length;
  const futureBookings = packages.reduce((sum, r) => sum + (r.future_booked ?? 0), 0);

  if (isLoading) return <PageSkeleton variant="table" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Client Activity & Session Intelligence</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.totalSessions.toLocaleString()} total sessions tracked
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSV(filteredPkg)}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={refetch} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <KpiCard title="Active Clients" value={stats.activeClients} icon={Users} color="emerald" />
        <KpiCard title="Slowing Down" value={stats.slowingClients} icon={TrendingDown} color="yellow" />
        <KpiCard title="Inactive (7-30d)" value={stats.inactiveClients} icon={Clock} color="orange" />
        <KpiCard title="Ghost (30d+)" value={stats.ghostClients} icon={UserX} color="red" />
        <KpiCard title="Red Zone Alerts" value={stats.redZoneCount} icon={AlertTriangle} color="red" subtitle="Need attention" />
        <KpiCard title="Future Bookings" value={futureBookings} icon={Calendar} color="blue" />
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search client, coach, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {(tab === "activity" || tab === "renewals") && (
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Priorities</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="WATCH">Watch</SelectItem>
              <SelectItem value="SAFE">Safe</SelectItem>
            </SelectContent>
          </Select>
        )}
        {tab === "sessions" && (
          <Select value={freqFilter} onValueChange={setFreqFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Slowing">Slowing</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
              <SelectItem value="Ghost">Ghost</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4 mr-1" /> Packages
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Calendar className="h-4 w-4 mr-1" /> Session History
          </TabsTrigger>
          <TabsTrigger value="coaches">
            <Shield className="h-4 w-4 mr-1" /> Coach Performance
          </TabsTrigger>
          <TabsTrigger value="alerts" className="relative">
            <AlertTriangle className="h-4 w-4 mr-1" /> Red Zone
            {stats.redZoneCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                {stats.redZoneCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="brain" className="relative">
            <Activity className="h-4 w-4 mr-1" /> AI Brain
            {aiInsights.filter((i) => i.severity === "critical").length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-purple-500 text-white rounded-full">
                {aiInsights.filter((i) => i.severity === "critical").length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Package Activity (original) ── */}
        <TabsContent value="activity">
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead className="text-center">Remaining</TableHead>
                    <TableHead>Coach</TableHead>
                    <TableHead>Last Session</TableHead>
                    <TableHead className="text-center">Sess/Wk</TableHead>
                    <TableHead className="text-center">Booked</TableHead>
                    <TableHead>Next Session</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPkg.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                        No clients found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPkg.map((row) => (
                      <TableRow key={row.id} className={`cursor-pointer hover:bg-muted/30 transition-colors ${ROW_BG[row.depletion_priority] ?? ""}`}>
                        <TableCell className="font-medium">{row.client_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.client_phone}</TableCell>
                        <TableCell className="text-xs">{row.package_name}</TableCell>
                        <TableCell className="text-center">
                          <span className={remainingColor(row.remaining_sessions)}>
                            {row.remaining_sessions}
                          </span>
                          <span className="text-muted-foreground">/{row.total_sessions}</span>
                        </TableCell>
                        <TableCell className="text-xs">{row.last_coach}</TableCell>
                        <TableCell className="text-xs">
                          <div>{formatDate(row.last_session_date)}</div>
                          <div className="text-muted-foreground">
                            {row.last_session_date ? daysAgoLabel(differenceInDays(new Date(), new Date(row.last_session_date))) : "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{row.sessions_per_week}</TableCell>
                        <TableCell className="text-center">{row.future_booked}</TableCell>
                        <TableCell className="text-xs">{formatDate(row.next_session_date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={PRIORITY_COLORS[row.depletion_priority] ?? ""}>
                            {row.depletion_priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <ContactActions phone={row.client_phone} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Session History / Frequency Intelligence ── */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Client Session Frequency — {filteredProfiles.length} clients
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Coach</TableHead>
                    <TableHead className="text-center">Total Sessions</TableHead>
                    <TableHead>Last Session</TableHead>
                    <TableHead className="text-center">Days Since</TableHead>
                    <TableHead className="text-center">Last 7d</TableHead>
                    <TableHead className="text-center">Last 30d</TableHead>
                    <TableHead className="text-center">Avg Gap</TableHead>
                    <TableHead className="text-center">90d</TableHead>
                    <TableHead>Coaches</TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-12">
                        No session data found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProfiles.map((cp) => (
                      <TableRow
                        key={cp.client_name}
                        className={`cursor-pointer hover:bg-muted/30 transition-colors ${
                          cp.frequency_label === "Ghost" ? "bg-red-500/5" :
                          cp.frequency_label === "Inactive" ? "bg-orange-500/5" : ""
                        }`}
                      >
                        <TableCell className="font-medium">{cp.client_name}</TableCell>
                        <TableCell className="text-xs">{cp.coach_name}</TableCell>
                        <TableCell className="text-center font-semibold">{cp.total_sessions}</TableCell>
                        <TableCell className="text-xs">{formatDate(cp.last_session_date)}</TableCell>
                        <TableCell className="text-center">
                          <span className={
                            cp.days_since_last > 30 ? "text-red-400 font-bold" :
                            cp.days_since_last > 14 ? "text-orange-400 font-semibold" :
                            cp.days_since_last > 7 ? "text-yellow-400" : "text-emerald-400"
                          }>
                            {cp.days_since_last < 999 ? `${cp.days_since_last}d` : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{cp.sessions_last_7d}</TableCell>
                        <TableCell className="text-center">{cp.sessions_last_30d}</TableCell>
                        <TableCell className="text-center text-xs">
                          {cp.avg_days_between !== null ? `${cp.avg_days_between}d` : "—"}
                        </TableCell>
                        <TableCell className="text-center">{cp.sessions_last_90d}</TableCell>
                        <TableCell className="text-xs">
                          {cp.multi_coach ? (
                            <div className="space-y-0.5">
                              {cp.all_coaches.map((ch) => (
                                <div key={ch.coach_name} className="flex items-center gap-1">
                                  <span className={ch.coach_name === cp.coach_name ? "font-semibold" : "text-muted-foreground"}>
                                    {ch.coach_name}
                                  </span>
                                  <span className="text-muted-foreground">({ch.sessions})</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span>{cp.coach_name}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TrendIcon trend={cp.trend} />
                            <span className="text-xs capitalize">{cp.trend}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={FREQ_COLORS[cp.frequency_label] ?? ""}>
                            {cp.frequency_label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Coach Performance ── */}
        <TabsContent value="coaches">
          <div className="space-y-4">
            {filteredCoaches.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No coach data
                </CardContent>
              </Card>
            ) : (
              filteredCoaches.map((coach) => (
                <Card key={coach.coach_name}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{coach.coach_name}</CardTitle>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-muted-foreground">
                          Last session: <span className={coach.days_since_last > 7 ? "text-orange-400 font-semibold" : "text-emerald-400"}>
                            {daysAgoLabel(coach.days_since_last)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Coach KPIs */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                      <MiniStat label="Total Sessions" value={coach.total_sessions} />
                      <MiniStat label="Unique Clients" value={coach.unique_clients} />
                      <MiniStat label="Last 7 Days" value={coach.sessions_last_7d} />
                      <MiniStat label="Last 30 Days" value={coach.sessions_last_30d} />
                      <MiniStat label="Avg/Week" value={coach.avg_sessions_per_week} />
                      <MiniStat
                        label="Inactive Clients"
                        value={coach.clients_inactive_7d}
                        highlight={coach.clients_inactive_7d > 0}
                      />
                    </div>

                    {/* Red zone clients for this coach */}
                    {coach.red_zone_clients.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                          ⚠ Inactive Clients ({coach.red_zone_clients.length})
                        </p>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Client</TableHead>
                                <TableHead>Last Session</TableHead>
                                <TableHead className="text-center">Days Since</TableHead>
                                <TableHead className="text-center">Total Sessions</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {coach.red_zone_clients.map((c) => (
                                <TableRow key={c.client_name} className="cursor-pointer hover:bg-muted/30 transition-colors">
                                  <TableCell className="font-medium">{c.client_name}</TableCell>
                                  <TableCell className="text-xs">{formatDate(c.last_session_date)}</TableCell>
                                  <TableCell className="text-center">
                                    <span className={
                                      c.days_since_last > 30 ? "text-red-400 font-bold" :
                                      c.days_since_last > 14 ? "text-orange-400 font-semibold" :
                                      "text-yellow-400"
                                    }>
                                      {c.days_since_last}d
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center">{c.total_sessions}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={FREQ_COLORS[c.frequency_label] ?? ""}>
                                      {c.frequency_label}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ── Tab 4: Red Zone Alerts ── */}
        <TabsContent value="alerts">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                Red Zone — {filteredAlerts.length} clients need attention
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Pattern-based detection: alerts trigger when a client is overdue relative to their own training frequency, not a flat day count.
              </p>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Coach</TableHead>
                    <TableHead>Last Session</TableHead>
                    <TableHead className="text-center">Days Since</TableHead>
                    <TableHead>Action Needed</TableHead>
                    <TableHead>Contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAlerts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-emerald-400">
                        All clients active — no red zone alerts
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAlerts.map((alert) => {
                      // Find matching package for phone number
                      const pkg = packages.find((p) =>
                        p.client_name === alert.client_name ||
                        p.last_coach === alert.coach_name,
                      );
                      return (
                        <TableRow
                          key={`${alert.client_name}-${alert.coach_name}`}
                          className={`cursor-pointer hover:bg-muted/30 transition-colors ${ROW_BG[alert.severity] ?? ""}`}
                        >
                          <TableCell>
                            <Badge variant="outline" className={SEVERITY_COLORS[alert.severity] ?? ""}>
                              {alert.severity === "ghost" ? "GHOST" :
                               alert.severity === "critical" ? "CRITICAL" : "WARNING"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{alert.client_name}</TableCell>
                          <TableCell className="text-xs">{alert.coach_name}</TableCell>
                          <TableCell className="text-xs">{formatDate(alert.last_session_date)}</TableCell>
                          <TableCell className="text-center">
                            <span className={
                              alert.days_since_last > 30 ? "text-red-400 font-bold text-lg" :
                              alert.days_since_last > 14 ? "text-orange-400 font-semibold" :
                              "text-yellow-400"
                            }>
                              {alert.days_since_last}d
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">
                            {alert.severity === "ghost"
                              ? "Client lost — immediate outreach required"
                              : alert.severity === "critical"
                              ? "Urgent follow-up — check-in call"
                              : "Schedule next session"}
                          </TableCell>
                          <TableCell>
                            <ContactActions phone={pkg?.client_phone} />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ── Tab 5: AI Brain ── */}
        <TabsContent value="brain">
          <div className="space-y-4">
            {aiInsights.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No insights generated — need more session data
                </CardContent>
              </Card>
            ) : (
              aiInsights.map((insight) => (
                <InsightCard key={insight.id} insight={insight} />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Small Components ──

function MiniStat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-red-500/40 bg-red-500/5" : "border-border/40"}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${highlight ? "text-red-400" : ""}`}>{value}</p>
    </div>
  );
}

const INSIGHT_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  critical: { border: "border-red-500/40", bg: "bg-red-500/5", icon: "text-red-400" },
  warning: { border: "border-orange-500/40", bg: "bg-orange-500/5", icon: "text-orange-400" },
  opportunity: { border: "border-emerald-500/40", bg: "bg-emerald-500/5", icon: "text-emerald-400" },
  info: { border: "border-blue-500/40", bg: "bg-blue-500/5", icon: "text-blue-400" },
};

const CATEGORY_LABELS: Record<string, string> = {
  retention: "Retention",
  coach: "Coach",
  revenue: "Revenue",
  pattern: "Pattern",
  operational: "Operations",
};

function InsightCard({ insight }: { insight: AIInsight }) {
  const style = INSIGHT_STYLES[insight.severity] ?? INSIGHT_STYLES.info;
  return (
    <Card className={`${style.border} ${style.bg} border`}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={`text-[10px] ${style.border} ${style.icon}`}>
                {insight.severity.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {CATEGORY_LABELS[insight.category] ?? insight.category}
              </Badge>
              {insight.metric && (
                <span className="text-xs text-muted-foreground">{insight.metric}</span>
              )}
            </div>
            <h3 className={`font-semibold ${style.icon}`}>{insight.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
          </div>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Recommended Action
          </p>
          <p className="text-sm">{insight.action}</p>
        </div>
        {insight.affected && insight.affected.length > 5 && (
          <p className="text-xs text-muted-foreground">
            +{insight.affected.length - 5} more affected
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ContactActions({ phone }: { phone?: string | null }) {
  if (!phone) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1">
      <a href={`tel:${phone}`} target="_blank" rel="noreferrer">
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Phone className="h-3.5 w-3.5" />
        </Button>
      </a>
      <a href={`https://wa.me/${phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-400">
          <MessageCircle className="h-3.5 w-3.5" />
        </Button>
      </a>
    </div>
  );
}
