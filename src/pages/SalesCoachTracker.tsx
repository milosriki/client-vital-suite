import { supabase } from "@/integrations/supabase/client";
import { DEAL_STAGES } from "@/constants/dealStages";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertCircle,
  Calendar,
  UserCheck,
  Ghost,
  Target,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { getBusinessDate } from "@/lib/date-utils";
import { PageSkeleton } from "@/components/ui/page-skeleton";

const SalesCoachTracker = () => {
  const now = getBusinessDate();
  const currentMonthStart = startOfMonth(now);
  const currentMonthEnd = endOfMonth(now);
  const previousMonthStart = startOfMonth(subMonths(now, 1));
  const previousMonthEnd = endOfMonth(subMonths(now, 1));

  // ── Section 1: Closed Won Deals — current month ──
  const { data: currentDeals, isLoading: loadingCurrent } = useDedupedQuery({
    queryKey: ["closed-won-current", currentMonthStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, deal_name, deal_value, stage, updated_at, contact_id")
        .eq("stage", DEAL_STAGES.CLOSED_WON)
        .gte("updated_at", currentMonthStart.toISOString())
        .lte("updated_at", currentMonthEnd.toISOString())
        .order("deal_value", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ── Section 1: Closed Won Deals — previous month ──
  const { data: previousDeals, isLoading: loadingPrevious } = useDedupedQuery({
    queryKey: ["closed-won-previous", previousMonthStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, deal_name, deal_value, stage, updated_at")
        .eq("stage", DEAL_STAGES.CLOSED_WON)
        .gte("updated_at", previousMonthStart.toISOString())
        .lte("updated_at", previousMonthEnd.toISOString())
        .order("deal_value", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ── Section 3: Setter Funnel Matrix ──
  const { data: setterFunnel, isLoading: loadingSetters } = useDedupedQuery({
    queryKey: ["setter-funnel-matrix"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setter_funnel_matrix")
        .select("setter_name, total_leads, deals_created, booked, held, closed_won, closed_lost, closed_won_value, lead_to_deal_pct, book_to_held_pct, ghost_rate_pct, held_to_close_pct");
      if (error) throw error;
      return data;
    },
  });

  // ── Section 4: No-Shows ──
  const { data: noShows, isLoading: loadingNoShows } = useDedupedQuery({
    queryKey: ["no-shows-tracker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_truth_matrix")
        .select("contact_name, first_name, deal_name, email, coach, assigned_coach, stage_label, deal_stage, stage, truth_status, utm_campaign, source_campaign")
        .in("truth_status", [
          "BOOKED_NOT_ATTENDED",
          "HUBSPOT_ONLY_NO_AWS_PROOF",
        ])
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  // ── Section 5: Coach Performance ──
  const { data: coachPerf, isLoading: loadingCoaches } = useDedupedQuery({
    queryKey: ["coach-performance-latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_performance")
        .select("id, coach_name, total_clients, avg_health_score, clients_improving, clients_declining, trend, report_date")
        .order("report_date", { ascending: false });
      if (error) throw error;
      const seen = new Set<string>();
      return (data || []).filter((c) => {
        if (seen.has(c.coach_name)) return false;
        seen.add(c.coach_name);
        return true;
      });
    },
  });

  // ── Computed KPIs ──
  const currentTotal =
    currentDeals?.reduce((s, d) => s + (d.deal_value || 0), 0) || 0;
  const previousTotal =
    previousDeals?.reduce((s, d) => s + (d.deal_value || 0), 0) || 0;
  const pctChange =
    previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : currentTotal > 0
        ? 100
        : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sales & Coach Activity Tracker</h1>
        <p className="text-muted-foreground">
          Real deals, setter funnels, no-shows & coach performance
        </p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              This Month Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentTotal.toLocaleString()} AED
            </div>
            <p className="text-xs text-muted-foreground">
              {currentDeals?.length || 0} closed-won deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Previous Month
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {previousTotal.toLocaleString()} AED
            </div>
            <p className="text-xs text-muted-foreground">
              {previousDeals?.length || 0} closed-won deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">MoM Change</CardTitle>
            {pctChange >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${pctChange >= 0 ? "text-emerald-500" : "text-destructive"}`}
            >
              {pctChange >= 0 ? "+" : ""}
              {(pctChange ?? 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">vs previous month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No-Shows</CardTitle>
            <Ghost className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {noShows?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">need follow-up</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Top Closed Deals ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Top Closed Deals — {format(currentMonthStart, "MMMM yyyy")}
          </CardTitle>
          <CardDescription>
            All closed-won deals this month, sorted by value
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingCurrent ? (
            <PageSkeleton variant="table" />
          ) : currentDeals && currentDeals.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Deal Name</TableHead>
                  <TableHead className="text-xs">Value (AED)</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentDeals.slice(0, 15).map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell className="font-medium">
                      {deal.deal_name || "Untitled Deal"}
                    </TableCell>
                    <TableCell className="font-bold text-emerald-500">
                      {(deal.deal_value || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {deal.updated_at
                        ? format(new Date(deal.updated_at), "MMM dd")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No closed-won deals this month yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Setter Funnel + No-Shows + Coach (Tabs) ── */}
      <Tabs defaultValue="setters" className="space-y-4">
        <TabsList>
          <TabsTrigger value="setters">
            <UserCheck className="h-4 w-4 mr-1" /> Setter Funnel
          </TabsTrigger>
          <TabsTrigger value="no-shows">
            <Ghost className="h-4 w-4 mr-1" /> No-Shows
          </TabsTrigger>
          <TabsTrigger value="coaches">
            <Users className="h-4 w-4 mr-1" /> Coach Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setters">
          <Card>
            <CardHeader>
              <CardTitle>Setter Funnel Matrix</CardTitle>
              <CardDescription>
                Lead → Book → Held → Close conversion by setter
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSetters ? (
                <PageSkeleton variant="table" />
              ) : setterFunnel && setterFunnel.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Setter</TableHead>
                      <TableHead className="text-xs text-right">Leads</TableHead>
                      <TableHead className="text-xs text-right">Deals</TableHead>
                      <TableHead className="text-xs text-right">Won</TableHead>
                      <TableHead className="text-xs text-right">Lost</TableHead>
                      <TableHead className="text-xs text-right">Revenue (AED)</TableHead>
                      <TableHead className="text-xs text-right">Close %</TableHead>
                      <TableHead className="text-xs text-right">Ghost %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {setterFunnel.map((s: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {s.setter_name || "Unknown"}
                        </TableCell>
                        <TableCell className="text-right">{s.total_leads || 0}</TableCell>
                        <TableCell className="text-right">{s.deals_created || 0}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-400">
                          {s.closed_won || 0}
                        </TableCell>
                        <TableCell className="text-right text-red-400">
                          {s.closed_lost || 0}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {Number(s.closed_won_value || 0) > 0
                            ? Number(s.closed_won_value).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={Number(s.held_to_close_pct || 0) >= 5 ? "default" : "secondary"}>
                            {s.held_to_close_pct != null
                              ? `${Number(s.held_to_close_pct).toFixed(1)}%`
                              : "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              (s.ghost_rate_pct || 0) > 40
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {s.ghost_rate_pct != null
                              ? `${Number(s.ghost_rate_pct).toFixed(0)}%`
                              : "—"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No setter funnel data available.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="no-shows">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                No-Shows & Follow-Up Needed
              </CardTitle>
              <CardDescription>
                Booked assessments not attended — cross-referenced with AWS
                ground truth
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingNoShows ? (
                <PageSkeleton variant="table" />
              ) : noShows && noShows.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs">Coach</TableHead>
                      <TableHead className="text-xs">Stage</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Campaign</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {noShows.map((ns: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {ns.contact_name ||
                            ns.first_name ||
                            ns.deal_name ||
                            "Unknown"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {ns.email || "—"}
                        </TableCell>
                        <TableCell>
                          {ns.coach || ns.assigned_coach || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {ns.stage_label || ns.deal_stage || ns.stage || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-xs">
                            {ns.truth_status === "BOOKED_NOT_ATTENDED"
                              ? "No-Show"
                              : "Unverified"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {ns.utm_campaign || ns.source_campaign || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No no-shows detected. All booked assessments were attended.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coaches">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Coach Performance
              </CardTitle>
              <CardDescription>
                Latest performance data per coach
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCoaches ? (
                <PageSkeleton variant="table" />
              ) : coachPerf && coachPerf.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Coach</TableHead>
                      <TableHead className="text-xs">Total Clients</TableHead>
                      <TableHead className="text-xs">
                        Avg Health Score
                      </TableHead>
                      <TableHead className="text-xs">Improving</TableHead>
                      <TableHead className="text-xs">Declining</TableHead>
                      <TableHead className="text-xs">Trend</TableHead>
                      <TableHead className="text-xs">Report Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coachPerf.map((cp: any) => (
                      <TableRow key={cp.id}>
                        <TableCell className="font-medium">
                          {cp.coach_name}
                        </TableCell>
                        <TableCell>{cp.total_clients || 0}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              (cp.avg_health_score || 0) >= 70
                                ? "bg-emerald-500/10 text-emerald-500"
                                : (cp.avg_health_score || 0) >= 40
                                  ? "bg-yellow-500/10 text-yellow-500"
                                  : "bg-red-500/10 text-red-500"
                            }
                          >
                            {(cp.avg_health_score || 0).toFixed(0)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-emerald-500">
                          {cp.clients_improving || 0}
                        </TableCell>
                        <TableCell className="text-destructive">
                          {cp.clients_declining || 0}
                        </TableCell>
                        <TableCell>
                          <Badge variant={cp.trend === "IMPROVING" ? "secondary" : cp.trend === "DECLINING" ? "destructive" : "outline"}>
                            {cp.trend || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {cp.report_date
                            ? format(new Date(cp.report_date), "MMM dd")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No coach performance data available.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SalesCoachTracker;
