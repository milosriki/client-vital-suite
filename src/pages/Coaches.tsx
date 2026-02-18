import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  RefreshCw, Users, TrendingUp, TrendingDown, Minus, Search,
  AlertTriangle, Phone, Calendar, Activity, DollarSign, ChevronRight,
  Download, ArrowUpDown,
} from "lucide-react";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { format, differenceInDays } from "date-fns";
import type { CoachPerformance } from "@/types/database";

// ── Types ──
interface EnrichedClient {
  client_id: string;
  client_name: string;
  email: string | null;
  phone: string | null;
  // Package info
  remaining_sessions: number;
  pack_size: number;
  package_value: number;
  sessions_per_week: number;
  future_booked: number;
  // Activity
  last_session_date: string | null;
  days_since_last: number;
  sessions_last_14d: number;
  sessions_last_30d: number;
  total_sessions: number;
  // Health & Churn
  health_score: number | null;
  health_zone: string | null;
  churn_score: number | null;
  churn_factors: Record<string, unknown> | null;
  revenue_at_risk: number;
  predicted_churn_date: string | null;
  // Computed
  depletion_priority: string;
  days_until_depleted: number | null;
  trend: "improving" | "declining" | "stable";
}

interface CoachSummary {
  coach_name: string;
  total_clients: number;
  active_clients: number;
  at_risk_clients: number;
  avg_health: number;
  total_revenue_at_risk: number;
  avg_sessions_per_week: number;
  clients_red: number;
  clients_yellow: number;
  clients_green: number;
  clients: EnrichedClient[];
}

// ── Helpers ──
function daysAgoLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${(days / 365).toFixed(1)}y ago`;
}

function priorityColor(p: string): string {
  switch (p) {
    case "CRITICAL": return "bg-red-500/20 text-red-400 border-red-500/40";
    case "HIGH": return "bg-orange-500/20 text-orange-400 border-orange-500/40";
    case "MEDIUM": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/40";
    case "LOW": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
    default: return "bg-gray-500/20 text-gray-400";
  }
}

function healthZoneColor(zone: string | null): string {
  switch (zone) {
    case "RED": return "bg-red-500 text-white";
    case "YELLOW": return "bg-yellow-500 text-black";
    case "GREEN": return "bg-green-500 text-white";
    case "PURPLE": return "bg-purple-500 text-white";
    default: return "bg-gray-500 text-white";
  }
}

function churnBadge(score: number | null) {
  if (score === null) return null;
  if (score >= 70) return <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-xs">⚠ {score}%</Badge>;
  if (score >= 40) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40 text-xs">{score}%</Badge>;
  return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs">{score}%</Badge>;
}

// ── Main Component ──
export default function Coaches() {
  const [selectedCoach, setSelectedCoach] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<EnrichedClient | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"churn" | "days" | "remaining" | "revenue">("churn");

  // ── Fetch all data in parallel ──
  const { data: coaches, isLoading: coachLoading, refetch } = useDedupedQuery<CoachPerformance[]>({
    queryKey: ["coach-performance-latest"],
    queryFn: async () => {
      const { data: latestDate } = await (supabase as any)
        .from("coach_performance")
        .select("report_date")
        .order("report_date", { ascending: false })
        .limit(1)
        .single();
      if (!latestDate?.report_date) return [];
      const { data, error } = await (supabase as any)
        .from("coach_performance")
        .select("*")
        .eq("report_date", latestDate.report_date)
        .order("avg_client_health", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: packages } = useDedupedQuery<any[]>({
    queryKey: ["client-packages-live"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_packages_live" as never).select("*");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: predictions } = useDedupedQuery<any[]>({
    queryKey: ["client-predictions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_predictions" as never).select("*");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: healthScores } = useDedupedQuery<any[]>({
    queryKey: ["client-health-latest"],
    queryFn: async () => {
      const { data: latest } = await (supabase as any)
        .from("client_health_scores")
        .select("calculated_on")
        .order("calculated_on", { ascending: false })
        .limit(1)
        .single();
      if (!latest?.calculated_on) return [];
      const { data, error } = await (supabase as any)
        .from("client_health_scores")
        .select("*")
        .eq("calculated_on", latest.calculated_on);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: sessions } = useDedupedQuery<any[]>({
    queryKey: ["training-sessions-live"],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_sessions_live" as never).select("*");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Build enriched coach summaries ──
  const coachSummaries = useMemo(() => {
    if (!coaches || !packages) return [];

    const now = new Date();
    const predMap = new Map((predictions || []).map((p) => [p.client_id, p]));
    const healthMap = new Map((healthScores || []).map((h) => [h.assigned_coach + ":" + (h.email || h.firstname), h]));

    // Group sessions by client
    const sessionsByClient = new Map<string, any[]>();
    for (const s of sessions || []) {
      const cid = s.client_id || s.client_name;
      if (!cid) continue;
      const arr = sessionsByClient.get(cid) || [];
      arr.push(s);
      sessionsByClient.set(cid, arr);
    }

    // Group packages by coach
    const pkgByCoach = new Map<string, any[]>();
    for (const pkg of packages) {
      const coach = pkg.last_coach || "Unassigned";
      const arr = pkgByCoach.get(coach) || [];
      arr.push(pkg);
      pkgByCoach.set(coach, arr);
    }

    const summaries: CoachSummary[] = [];

    for (const coach of coaches) {
      const coachPkgs = pkgByCoach.get(coach.coach_name) || [];
      const enrichedClients: EnrichedClient[] = [];

      for (const pkg of coachPkgs) {
        const clientId = pkg.client_id || pkg.client_name;
        const pred = predMap.get(clientId);
        const clientSessions = sessionsByClient.get(clientId) || [];

        const lastDate = pkg.last_session_date ? new Date(pkg.last_session_date) : null;
        const daysSince = lastDate ? differenceInDays(now, lastDate) : 999;

        const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
        const fourWeeksAgo = new Date(now.getTime() - 28 * 86400000);
        const recent14 = clientSessions.filter((s: any) => new Date(s.session_date || s.date) >= twoWeeksAgo).length;
        const prior14 = clientSessions.filter((s: any) => {
          const d = new Date(s.session_date || s.date);
          return d >= fourWeeksAgo && d < twoWeeksAgo;
        }).length;

        const remaining = pkg.remaining_sessions ?? 0;
        const spw = pkg.sessions_per_week ?? 1;
        const weeksLeft = spw > 0 ? remaining / spw : 99;
        const daysUntilDepleted = Math.round(weeksLeft * 7);

        let depletion = "LOW";
        if (remaining <= 1 || daysUntilDepleted <= 7) depletion = "CRITICAL";
        else if (remaining <= 3 || daysUntilDepleted <= 14) depletion = "HIGH";
        else if (remaining <= 5 || daysUntilDepleted <= 28) depletion = "MEDIUM";

        const trend: "improving" | "declining" | "stable" =
          recent14 > prior14 ? "improving" : recent14 < prior14 ? "declining" : "stable";

        // Find health score for this client
        const healthKey = coach.coach_name + ":" + (pkg.client_email || pkg.client_name);
        const health = healthMap.get(healthKey);

        enrichedClients.push({
          client_id: clientId,
          client_name: pkg.client_name || clientId,
          email: pkg.client_email || null,
          phone: pred?.churn_factors?.phone || null,
          remaining_sessions: remaining,
          pack_size: pkg.pack_size ?? 0,
          package_value: pkg.package_value ?? 0,
          sessions_per_week: spw,
          future_booked: pkg.future_booked ?? 0,
          last_session_date: pkg.last_session_date || null,
          days_since_last: daysSince,
          sessions_last_14d: recent14,
          sessions_last_30d: clientSessions.filter((s: any) => new Date(s.session_date || s.date) >= new Date(now.getTime() - 30 * 86400000)).length,
          total_sessions: clientSessions.length,
          health_score: health?.health_score ?? pred?.churn_score ? (100 - (pred?.churn_score ?? 0)) : null,
          health_zone: health?.health_zone ?? (pred?.churn_score >= 70 ? "RED" : pred?.churn_score >= 40 ? "YELLOW" : "GREEN"),
          churn_score: pred?.churn_score ?? null,
          churn_factors: pred?.churn_factors ?? null,
          revenue_at_risk: pred?.revenue_at_risk ?? pkg.package_value ?? 0,
          predicted_churn_date: pred?.predicted_churn_date ?? null,
          depletion_priority: depletion,
          days_until_depleted: daysUntilDepleted,
          trend,
        });
      }

      const atRisk = enrichedClients.filter((c) => (c.churn_score ?? 0) >= 50).length;
      const totalRevAtRisk = enrichedClients.reduce((s, c) => s + ((c.churn_score ?? 0) >= 50 ? c.revenue_at_risk : 0), 0);

      summaries.push({
        coach_name: coach.coach_name,
        total_clients: enrichedClients.length,
        active_clients: enrichedClients.filter((c) => c.days_since_last < 30).length,
        at_risk_clients: atRisk,
        avg_health: coach.avg_client_health ?? 0,
        total_revenue_at_risk: totalRevAtRisk,
        avg_sessions_per_week: enrichedClients.length > 0
          ? Math.round((enrichedClients.reduce((s, c) => s + c.sessions_per_week, 0) / enrichedClients.length) * 10) / 10
          : 0,
        clients_red: coach.clients_red ?? 0,
        clients_yellow: coach.clients_yellow ?? 0,
        clients_green: coach.clients_green ?? 0,
        clients: enrichedClients,
      });
    }

    return summaries.sort((a, b) => b.total_clients - a.total_clients);
  }, [coaches, packages, predictions, healthScores, sessions]);

  // ── Selected coach's clients ──
  const selectedSummary = coachSummaries.find((c) => c.coach_name === selectedCoach);
  const filteredClients = useMemo(() => {
    if (!selectedSummary) return [];
    let list = selectedSummary.clients;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.client_name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    }
    // Sort
    switch (sortBy) {
      case "churn": return [...list].sort((a, b) => (b.churn_score ?? 0) - (a.churn_score ?? 0));
      case "days": return [...list].sort((a, b) => b.days_since_last - a.days_since_last);
      case "remaining": return [...list].sort((a, b) => a.remaining_sessions - b.remaining_sessions);
      case "revenue": return [...list].sort((a, b) => b.revenue_at_risk - a.revenue_at_risk);
      default: return list;
    }
  }, [selectedSummary, search, sortBy]);

  // ── Export CSV ──
  const exportCSV = () => {
    if (!filteredClients.length) return;
    const headers = "Client,Email,Phone,Remaining,Pack Size,Sessions/Week,Last Session,Days Since,Churn %,Revenue at Risk,Priority\n";
    const rows = filteredClients.map((c) =>
      `"${c.client_name}","${c.email || ""}","${c.phone || ""}",${c.remaining_sessions},${c.pack_size},${c.sessions_per_week},"${c.last_session_date || ""}",${c.days_since_last},${c.churn_score ?? "N/A"},${c.revenue_at_risk},"${c.depletion_priority}"`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedCoach}-clients-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const isLoading = coachLoading;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Coach Performance</h1>
            <p className="text-muted-foreground text-sm">
              {coachSummaries.length} coaches • {coachSummaries.reduce((s, c) => s + c.total_clients, 0)} active packages • Click any coach to drill into clients
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Coach Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-52" />)}
          </div>
        ) : coachSummaries.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No coach data. Run data sync first.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coachSummaries.map((coach) => (
              <Card
                key={coach.coach_name}
                className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg"
                onClick={() => setSelectedCoach(coach.coach_name)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-lg">{coach.coach_name}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Users className="h-3.5 w-3.5" />
                        <span>{coach.total_clients} clients</span>
                        <span>•</span>
                        <span>{coach.active_clients} active</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${coach.avg_health >= 70 ? "text-green-500" : coach.avg_health >= 50 ? "text-yellow-500" : "text-red-500"}`}>
                        {coach.avg_health.toFixed(0)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Health</div>
                    </div>
                  </div>

                  {/* Health distribution bar */}
                  {coach.total_clients > 0 && (
                    <div className="h-2.5 flex rounded-full overflow-hidden mb-3">
                      {coach.clients_red > 0 && <div className="bg-red-500" style={{ width: `${(coach.clients_red / coach.total_clients) * 100}%` }} />}
                      {coach.clients_yellow > 0 && <div className="bg-yellow-500" style={{ width: `${(coach.clients_yellow / coach.total_clients) * 100}%` }} />}
                      {coach.clients_green > 0 && <div className="bg-green-500" style={{ width: `${(coach.clients_green / coach.total_clients) * 100}%` }} />}
                    </div>
                  )}

                  {/* Key metrics row */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                    <div>
                      <div className="font-semibold text-red-400">{coach.at_risk_clients}</div>
                      <div className="text-muted-foreground">At Risk</div>
                    </div>
                    <div>
                      <div className="font-semibold">{coach.avg_sessions_per_week}</div>
                      <div className="text-muted-foreground">Sess/Wk</div>
                    </div>
                    <div>
                      <div className="font-semibold text-orange-400">
                        {coach.total_revenue_at_risk > 0 ? `${(coach.total_revenue_at_risk / 1000).toFixed(0)}K` : "0"}
                      </div>
                      <div className="text-muted-foreground">AED Risk</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Click to view clients →</span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Coach Detail Modal ── */}
        <Dialog open={!!selectedCoach} onOpenChange={() => { setSelectedCoach(null); setSelectedClient(null); }}>
          <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-3">
                {selectedCoach}
                <Badge variant="outline" className="text-sm font-normal">
                  {selectedSummary?.total_clients ?? 0} clients
                </Badge>
                {(selectedSummary?.at_risk_clients ?? 0) > 0 && (
                  <Badge className="bg-red-500/20 text-red-400 border-red-500/40 text-sm">
                    <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                    {selectedSummary?.at_risk_clients} at risk
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            {/* Coach summary cards */}
            {selectedSummary && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <Card className="bg-muted/50"><CardContent className="p-3 text-center">
                  <div className="text-lg font-bold">{selectedSummary.total_clients}</div>
                  <div className="text-[10px] text-muted-foreground">Total Clients</div>
                </CardContent></Card>
                <Card className="bg-muted/50"><CardContent className="p-3 text-center">
                  <div className="text-lg font-bold">{selectedSummary.active_clients}</div>
                  <div className="text-[10px] text-muted-foreground">Active (30d)</div>
                </CardContent></Card>
                <Card className="bg-muted/50"><CardContent className="p-3 text-center">
                  <div className="text-lg font-bold text-red-400">{selectedSummary.at_risk_clients}</div>
                  <div className="text-[10px] text-muted-foreground">At Risk</div>
                </CardContent></Card>
                <Card className="bg-muted/50"><CardContent className="p-3 text-center">
                  <div className="text-lg font-bold">{selectedSummary.avg_health.toFixed(0)}</div>
                  <div className="text-[10px] text-muted-foreground">Avg Health</div>
                </CardContent></Card>
                <Card className="bg-muted/50"><CardContent className="p-3 text-center">
                  <div className="text-lg font-bold text-orange-400">
                    AED {selectedSummary.total_revenue_at_risk.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Revenue at Risk</div>
                </CardContent></Card>
              </div>
            )}

            {/* Search + Sort + Export */}
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-1">
                {(["churn", "days", "remaining", "revenue"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={sortBy === s ? "default" : "outline"}
                    onClick={() => setSortBy(s)}
                    className="text-xs"
                  >
                    {s === "churn" ? "Churn %" : s === "days" ? "Inactive" : s === "remaining" ? "Sessions" : "Revenue"}
                  </Button>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={exportCSV}>
                <Download className="h-3.5 w-3.5 mr-1" /> CSV
              </Button>
            </div>

            {/* Client Table */}
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[200px]">Client</TableHead>
                    <TableHead className="text-center">Health</TableHead>
                    <TableHead className="text-center">Churn Risk</TableHead>
                    <TableHead className="text-center">Sessions Left</TableHead>
                    <TableHead className="text-center">Last Session</TableHead>
                    <TableHead className="text-center">Freq (14d)</TableHead>
                    <TableHead className="text-center">Future Booked</TableHead>
                    <TableHead className="text-right">AED at Risk</TableHead>
                    <TableHead className="text-center">Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow
                      key={client.client_id}
                      className={`cursor-pointer hover:bg-muted/30 ${
                        client.depletion_priority === "CRITICAL" ? "bg-red-500/5" :
                        client.depletion_priority === "HIGH" ? "bg-orange-500/5" : ""
                      }`}
                      onClick={() => setSelectedClient(client)}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">{client.client_name}</div>
                          <div className="text-xs text-muted-foreground">{client.email || "No email"}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {client.health_zone && (
                          <Badge className={`${healthZoneColor(client.health_zone)} text-xs`}>
                            {client.health_score?.toFixed(0) ?? "—"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {churnBadge(client.churn_score)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-semibold ${
                          client.remaining_sessions <= 1 ? "text-red-400" :
                          client.remaining_sessions <= 3 ? "text-orange-400" :
                          "text-foreground"
                        }`}>
                          {client.remaining_sessions}
                        </span>
                        <span className="text-muted-foreground text-xs">/{client.pack_size}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className={`text-sm ${client.days_since_last > 14 ? "text-red-400" : client.days_since_last > 7 ? "text-yellow-400" : ""}`}>
                          {client.last_session_date ? daysAgoLabel(client.days_since_last) : "Never"}
                        </div>
                        {client.last_session_date && (
                          <div className="text-[10px] text-muted-foreground">
                            {format(new Date(client.last_session_date), "MMM d")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={client.sessions_last_14d === 0 ? "text-red-400 font-semibold" : ""}>
                          {client.sessions_last_14d}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={client.future_booked === 0 ? "text-red-400 font-semibold" : "text-emerald-400"}>
                          {client.future_booked}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {client.revenue_at_risk > 0 ? `${client.revenue_at_risk.toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`${priorityColor(client.depletion_priority)} text-[10px]`}>
                          {client.depletion_priority}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredClients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No clients found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Client Detail Modal ── */}
        <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
          <DialogContent className="max-w-2xl">
            {selectedClient && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-xl flex items-center gap-2">
                    {selectedClient.client_name}
                    {selectedClient.health_zone && (
                      <Badge className={healthZoneColor(selectedClient.health_zone)}>
                        {selectedClient.health_zone}
                      </Badge>
                    )}
                    {churnBadge(selectedClient.churn_score)}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Contact */}
                  <div className="flex gap-4 text-sm">
                    {selectedClient.email && <span className="text-muted-foreground">📧 {selectedClient.email}</span>}
                    {selectedClient.phone && <span className="text-muted-foreground">📱 {selectedClient.phone}</span>}
                  </div>

                  {/* Key Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="bg-muted/50"><CardContent className="p-3 text-center">
                      <div className={`text-xl font-bold ${selectedClient.remaining_sessions <= 3 ? "text-red-400" : ""}`}>
                        {selectedClient.remaining_sessions}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Sessions Left / {selectedClient.pack_size}</div>
                      <Progress value={(selectedClient.remaining_sessions / Math.max(selectedClient.pack_size, 1)) * 100} className="h-1 mt-1" />
                    </CardContent></Card>
                    <Card className="bg-muted/50"><CardContent className="p-3 text-center">
                      <div className="text-xl font-bold">{selectedClient.sessions_per_week}</div>
                      <div className="text-[10px] text-muted-foreground">Sessions / Week</div>
                    </CardContent></Card>
                    <Card className="bg-muted/50"><CardContent className="p-3 text-center">
                      <div className={`text-xl font-bold ${selectedClient.days_since_last > 14 ? "text-red-400" : ""}`}>
                        {selectedClient.days_since_last === 999 ? "N/A" : `${selectedClient.days_since_last}d`}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Since Last Session</div>
                    </CardContent></Card>
                    <Card className="bg-muted/50"><CardContent className="p-3 text-center">
                      <div className="text-xl font-bold text-orange-400">
                        AED {selectedClient.revenue_at_risk.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Revenue at Risk</div>
                    </CardContent></Card>
                  </div>

                  {/* Activity Pattern */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Activity Pattern</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last 14 days</span>
                        <span className="font-medium">{selectedClient.sessions_last_14d} sessions</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last 30 days</span>
                        <span className="font-medium">{selectedClient.sessions_last_30d} sessions</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total sessions (90d)</span>
                        <span className="font-medium">{selectedClient.total_sessions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Future bookings</span>
                        <span className={`font-medium ${selectedClient.future_booked === 0 ? "text-red-400" : "text-emerald-400"}`}>
                          {selectedClient.future_booked}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Trend</span>
                        <span className="flex items-center gap-1 font-medium">
                          {selectedClient.trend === "improving" && <><TrendingUp className="h-3.5 w-3.5 text-green-500" /> Improving</>}
                          {selectedClient.trend === "declining" && <><TrendingDown className="h-3.5 w-3.5 text-red-500" /> Declining</>}
                          {selectedClient.trend === "stable" && <><Minus className="h-3.5 w-3.5 text-gray-400" /> Stable</>}
                        </span>
                      </div>
                      {selectedClient.days_until_depleted !== null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Estimated depletion</span>
                          <span className="font-medium">
                            {selectedClient.days_until_depleted <= 0 ? "Depleted" :
                             `~${selectedClient.days_until_depleted} days`}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Churn Factors */}
                  {selectedClient.churn_factors && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Churn Risk Factors</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(selectedClient.churn_factors)
                            .filter(([k]) => !["phone", "coach"].includes(k))
                            .map(([key, val]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
                                <span className="font-medium">{typeof val === "number" ? (val < 1 ? `${(val * 100).toFixed(0)}%` : val) : String(val ?? "—")}</span>
                              </div>
                            ))}
                        </div>
                        {selectedClient.predicted_churn_date && (
                          <div className="mt-3 text-xs text-red-400 bg-red-500/10 rounded p-2">
                            ⚠ Predicted churn: {format(new Date(selectedClient.predicted_churn_date), "MMM d, yyyy")}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
