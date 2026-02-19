import { useState, useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import { AlertTriangle, RefreshCw, Phone, CheckCircle2, Brain, Loader2, Clock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";

// ── Types ──
interface InterventionItem {
  id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  coach: string;
  health_zone: string;
  churn_score: number;
  remaining_sessions: number;
  days_inactive: number;
  future_booked: number;
  revenue_at_risk: number;
  issue: string;
  recommended_action: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM";
  completed: boolean;
}

const PRIORITY_BADGES: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/40",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
};

const AlertCenter = () => {
  const [tab, setTab] = useState("interventions");
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [coachFilter, setCoachFilter] = useState("ALL");

  // ── Fetch packages + predictions + health to build intervention queue ──
  const { data: packages, isLoading: pkgLoading, refetch: refetchPkgs } = useDedupedQuery<any[]>({
    queryKey: ["alert-packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_packages_live" as never).select("*");
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: predictions } = useDedupedQuery<any[]>({
    queryKey: ["alert-predictions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_predictions" as never).select("*");
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: healthScores } = useDedupedQuery<any[]>({
    queryKey: ["alert-health"],
    queryFn: async () => {
      const { data: latest } = await (supabase as any)
        .from("client_health_scores")
        .select("calculated_on")
        .order("calculated_on", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latest?.calculated_on) return [];
      const { data, error } = await (supabase as any)
        .from("client_health_scores")
        .select("*")
        .eq("calculated_on", latest.calculated_on);
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Legacy alerts table
  const { data: legacyAlerts, isLoading: legacyLoading, refetch: refetchLegacy } = useDedupedQuery<any[]>({
    queryKey: ["session-depletion-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_depletion_alerts" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60 * 1000,
  });

  // ── Build daily intervention queue ──
  const interventions = useMemo(() => {
    if (!packages) return [];

    const now = new Date();
    const predMap = new Map((predictions || []).map(p => [p.client_id, p]));
    const healthByEmail = new Map<string, any>();
    for (const h of healthScores || []) {
      if (h.email) healthByEmail.set(h.email.toLowerCase(), h);
    }

    const items: InterventionItem[] = [];

    for (const pkg of packages) {
      const pred = predMap.get(pkg.client_id);
      const h = pkg.client_email ? healthByEmail.get(pkg.client_email.toLowerCase()) : null;
      const phone = pkg.client_phone || pred?.churn_factors?.phone || null;
      const lastSession = pkg.last_session_date ? new Date(pkg.last_session_date) : null;
      const daysInactive = lastSession ? differenceInDays(now, lastSession) : 999;
      const remaining = pkg.remaining_sessions ?? 0;
      const churnScore = pred?.churn_score ?? (h?.churn_risk_score ?? 0);
      const healthZone = h?.health_zone ?? (churnScore >= 70 ? "RED" : churnScore >= 40 ? "YELLOW" : "GREEN");
      const revenueAtRisk = pred?.revenue_at_risk ?? pkg.package_value ?? 0;
      const futureBooked = pkg.future_booked ?? 0;

      // Determine if intervention needed
      const issues: string[] = [];
      const actions: string[] = [];
      let priority: "CRITICAL" | "HIGH" | "MEDIUM" | null = null;

      if (healthZone === "RED" && churnScore >= 60) {
        issues.push(`RED zone with ${churnScore}% churn risk`);
        actions.push("Call immediately to discuss concerns and rebook sessions");
        priority = "CRITICAL";
      }
      if (remaining <= 1) {
        issues.push(`Only ${remaining} session remaining`);
        actions.push("Call to discuss renewal package options");
        priority = priority || "CRITICAL";
      }
      if (daysInactive > 21) {
        issues.push(`${daysInactive} days inactive`);
        actions.push("Re-engagement call — check if scheduling issues or motivation drop");
        priority = priority || "HIGH";
      }
      if (futureBooked === 0 && remaining > 1) {
        issues.push("No future sessions booked");
        actions.push("Contact to schedule upcoming sessions");
        priority = priority || (daysInactive > 14 ? "HIGH" : "MEDIUM");
      }
      if (churnScore >= 50 && !priority) {
        issues.push(`High churn risk: ${churnScore}%`);
        actions.push("Proactive check-in call about satisfaction");
        priority = "HIGH";
      }

      if (!priority) continue; // No intervention needed

      items.push({
        id: pkg.client_id || pkg.id,
        client_name: pkg.client_name || pkg.client_id,
        client_email: pkg.client_email || null,
        client_phone: phone,
        coach: pkg.last_coach || "Unassigned",
        health_zone: healthZone,
        churn_score: churnScore,
        remaining_sessions: remaining,
        days_inactive: daysInactive,
        future_booked: futureBooked,
        revenue_at_risk: revenueAtRisk,
        issue: issues.join("; "),
        recommended_action: actions.join(". "),
        priority,
        completed: completedIds.has(pkg.client_id || pkg.id),
      });
    }

    // Sort: CRITICAL first, then HIGH, then MEDIUM; within same priority by revenue
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
    items.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (pDiff !== 0) return pDiff;
      return b.revenue_at_risk - a.revenue_at_risk;
    });

    return items;
  }, [packages, predictions, healthScores, completedIds]);

  // Filter by coach
  const coaches = useMemo(() => {
    const set = new Set(interventions.map(i => i.coach));
    return Array.from(set).sort();
  }, [interventions]);

  const filteredInterventions = useMemo(() => {
    if (coachFilter === "ALL") return interventions;
    return interventions.filter(i => i.coach === coachFilter);
  }, [interventions, coachFilter]);

  const pendingCount = filteredInterventions.filter(i => !i.completed).length;
  const completedCount = filteredInterventions.filter(i => i.completed).length;
  const totalRisk = filteredInterventions.filter(i => !i.completed).reduce((s, i) => s + i.revenue_at_risk, 0);

  const markComplete = (id: string) => {
    setCompletedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    toast.success("Intervention status updated");
  };

  const isLoading = pkgLoading;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold">Alert Center</h1>
            <p className="text-muted-foreground">
              Daily intervention queue — prioritized actions for client retention
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { refetchPkgs(); refetchLegacy(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-red-500/5 border-red-500/20">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-red-400">{pendingCount}</div>
              <div className="text-sm text-muted-foreground">Pending Actions</div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-emerald-400">{completedCount}</div>
              <div className="text-sm text-muted-foreground">Completed Today</div>
            </CardContent>
          </Card>
          <Card className="bg-orange-500/5 border-orange-500/20">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-orange-400">AED {(totalRisk / 1000).toFixed(0)}K</div>
              <div className="text-sm text-muted-foreground">Revenue at Risk</div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">{filteredInterventions.filter(i => i.priority === "CRITICAL" && !i.completed).length}</div>
              <div className="text-sm text-muted-foreground">Critical Actions</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex items-center gap-3">
            <TabsList>
              <TabsTrigger value="interventions">
                Daily Interventions ({interventions.length})
              </TabsTrigger>
              <TabsTrigger value="legacy">
                Depletion Alerts ({legacyAlerts?.length ?? 0})
              </TabsTrigger>
            </TabsList>
            <Select value={coachFilter} onValueChange={setCoachFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by coach" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All coaches</SelectItem>
                {coaches.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Tabs>

        {/* Intervention Queue Table */}
        {tab === "interventions" && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Priority</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Coach</TableHead>
                  <TableHead className="text-center">Health</TableHead>
                  <TableHead className="text-center">Churn</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Recommended Action</TableHead>
                  <TableHead className="text-right">AED at Risk</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      Building intervention queue...
                    </TableCell>
                  </TableRow>
                ) : filteredInterventions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <EmptyState
                        icon={CheckCircle2}
                        title="All clear!"
                        description="No interventions needed right now."
                        compact
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInterventions.map((item) => (
                    <TableRow
                      key={item.id}
                      className={`cursor-pointer hover:bg-muted/30 transition-colors ${item.completed ? "opacity-40 line-through" : ""} ${
                        item.priority === "CRITICAL" && !item.completed ? "bg-red-500/5" : ""
                      }`}
                    >
                      <TableCell>
                        <Badge className={PRIORITY_BADGES[item.priority] ?? ""}>
                          {item.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-semibold text-sm">{item.client_name}</div>
                          <div className="text-xs text-muted-foreground">{item.client_email || "—"}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.client_phone ? (
                          <a href={`tel:${item.client_phone}`} className="text-primary hover:underline text-sm flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {item.client_phone}
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{item.coach}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-xs ${
                          item.health_zone === "RED" ? "bg-red-500 text-white" :
                          item.health_zone === "YELLOW" ? "bg-yellow-500 text-black" :
                          "bg-green-500 text-white"
                        }`}>
                          {item.health_zone}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-semibold ${item.churn_score >= 70 ? "text-red-400" : item.churn_score >= 40 ? "text-yellow-400" : ""}`}>
                          {item.churn_score}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs max-w-[200px]">{item.issue}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs max-w-[250px] text-blue-300">{item.recommended_action}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        AED {item.revenue_at_risk.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant={item.completed ? "default" : "outline"}
                          size="sm"
                          onClick={() => markComplete(item.id)}
                          className={item.completed ? "bg-emerald-600" : ""}
                        >
                          {item.completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : "Done"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Legacy Depletion Alerts */}
        {tab === "legacy" && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Remaining Sessions</TableHead>
                  <TableHead>Last Coach</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {legacyLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">Loading...</TableCell>
                  </TableRow>
                ) : (legacyAlerts || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState icon={AlertTriangle} title="No alerts" description="No depletion alerts found." compact />
                    </TableCell>
                  </TableRow>
                ) : (
                  (legacyAlerts || []).map((alert: any) => (
                    <TableRow key={alert.id} className="cursor-pointer hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <Badge className={PRIORITY_BADGES[alert.priority] ?? "bg-muted"}>
                          {alert.priority ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{alert.client_name ?? "—"}</TableCell>
                      <TableCell>
                        {alert.client_phone ? (
                          <a href={`tel:${alert.client_phone}`} className="text-primary hover:underline">
                            {alert.client_phone}
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{alert.remaining_sessions ?? "—"}</TableCell>
                      <TableCell>{alert.last_coach ?? "—"}</TableCell>
                      <TableCell>
                        <Badge className={
                          alert.alert_status === "pending" ? "bg-yellow-500/20 text-yellow-300" :
                          alert.alert_status === "contacted" ? "bg-blue-500/20 text-blue-300" :
                          alert.alert_status === "renewed" ? "bg-emerald-500/20 text-emerald-300" :
                          "bg-muted"
                        }>
                          {alert.alert_status ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>{alert.created_at ? format(new Date(alert.created_at), "MMM d, yyyy") : "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertCenter;
