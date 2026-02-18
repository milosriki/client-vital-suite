import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  BarChart3,
  Mail,
  Activity,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { getBusinessDate } from "@/lib/date-utils";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { toast } from "sonner";

const SalesCoachTracker = () => {
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [selectedSetter, setSelectedSetter] = useState<any>(null);
  const [selectedNoShow, setSelectedNoShow] = useState<any>(null);
  const [selectedCoach, setSelectedCoach] = useState<any>(null);

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
                  <TableRow
                    key={deal.id}
                    className="cursor-pointer transition-colors duration-200 hover:bg-muted/30"
                    onClick={() => { setSelectedDeal(deal); toast.info(`Viewing deal: ${deal.deal_name || 'Untitled'}`); }}
                  >
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
                      <TableRow
                        key={i}
                        className="cursor-pointer transition-colors duration-200 hover:bg-muted/30"
                        onClick={() => { setSelectedSetter(s); toast.info(`Viewing setter: ${s.setter_name || 'Unknown'}`); }}
                      >
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
                      <TableRow
                        key={i}
                        className="cursor-pointer transition-colors duration-200 hover:bg-muted/30"
                        onClick={() => { setSelectedNoShow(ns); toast.info(`Viewing no-show: ${ns.contact_name || ns.first_name || 'Unknown'}`); }}
                      >
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
                      <TableRow
                        key={cp.id}
                        className="cursor-pointer transition-colors duration-200 hover:bg-muted/30"
                        onClick={() => { setSelectedCoach(cp); toast.info(`Viewing coach: ${cp.coach_name}`); }}
                      >
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

      {/* Deal Detail Dialog */}
      <Dialog open={!!selectedDeal} onOpenChange={(open) => !open && setSelectedDeal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-500" />
              Deal Detail
            </DialogTitle>
          </DialogHeader>
          {selectedDeal && (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-bold">{selectedDeal.deal_name || "Untitled Deal"}</p>
                <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 mt-1">Closed Won</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Deal Value</p>
                  <p className="text-2xl font-bold text-emerald-500">{(selectedDeal.deal_value || 0).toLocaleString()} AED</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Closed Date</p>
                  <p className="text-lg font-medium">
                    {selectedDeal.updated_at ? format(new Date(selectedDeal.updated_at), "MMM dd, yyyy") : "—"}
                  </p>
                </div>
              </div>
              {selectedDeal.contact_id && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Contact ID</p>
                  <p className="font-mono text-sm">{selectedDeal.contact_id}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Setter Funnel Detail Dialog */}
      <Dialog open={!!selectedSetter} onOpenChange={(open) => !open && setSelectedSetter(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {selectedSetter?.setter_name || "Unknown"} — Funnel Detail
            </DialogTitle>
          </DialogHeader>
          {selectedSetter && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Total Leads</p>
                  <p className="text-2xl font-bold">{selectedSetter.total_leads || 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Deals Created</p>
                  <p className="text-2xl font-bold">{selectedSetter.deals_created || 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Booked</p>
                  <p className="text-2xl font-bold">{selectedSetter.booked || 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Held</p>
                  <p className="text-2xl font-bold">{selectedSetter.held || 0}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-xs text-emerald-400 mb-1">Closed Won</p>
                  <p className="text-2xl font-bold text-emerald-500">{selectedSetter.closed_won || 0}</p>
                  <p className="text-sm text-muted-foreground">
                    {Number(selectedSetter.closed_won_value || 0) > 0 ? `${Number(selectedSetter.closed_won_value).toLocaleString()} AED` : "—"}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <p className="text-xs text-red-400 mb-1">Closed Lost</p>
                  <p className="text-2xl font-bold text-red-500">{selectedSetter.closed_lost || 0}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Lead→Deal</p>
                  <p className="font-bold">{selectedSetter.lead_to_deal_pct != null ? `${Number(selectedSetter.lead_to_deal_pct).toFixed(1)}%` : "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Book→Held</p>
                  <p className="font-bold">{selectedSetter.book_to_held_pct != null ? `${Number(selectedSetter.book_to_held_pct).toFixed(1)}%` : "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Held→Close</p>
                  <p className="font-bold">{selectedSetter.held_to_close_pct != null ? `${Number(selectedSetter.held_to_close_pct).toFixed(1)}%` : "—"}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Ghost Rate</p>
                <Badge variant={(selectedSetter.ghost_rate_pct || 0) > 40 ? "destructive" : "secondary"}>
                  {selectedSetter.ghost_rate_pct != null ? `${Number(selectedSetter.ghost_rate_pct).toFixed(0)}%` : "—"}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* No-Show Detail Dialog */}
      <Dialog open={!!selectedNoShow} onOpenChange={(open) => !open && setSelectedNoShow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ghost className="h-5 w-5 text-destructive" />
              No-Show Detail
            </DialogTitle>
          </DialogHeader>
          {selectedNoShow && (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-bold">
                  {selectedNoShow.contact_name || selectedNoShow.first_name || selectedNoShow.deal_name || "Unknown"}
                </p>
                <Badge variant="destructive" className="mt-1">
                  {selectedNoShow.truth_status === "BOOKED_NOT_ATTENDED" ? "No-Show" : "Unverified"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {selectedNoShow.email && (
                  <div className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </div>
                    <p className="font-medium">{selectedNoShow.email}</p>
                  </div>
                )}
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Coach</p>
                  <p className="font-medium">{selectedNoShow.coach || selectedNoShow.assigned_coach || "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Stage</p>
                  <p className="font-medium">{selectedNoShow.stage_label || selectedNoShow.deal_stage || selectedNoShow.stage || "—"}</p>
                </div>
                {(selectedNoShow.utm_campaign || selectedNoShow.source_campaign) && (
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-1">Campaign</p>
                    <p className="font-medium">{selectedNoShow.utm_campaign || selectedNoShow.source_campaign}</p>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <p className="text-xs text-red-400 mb-1">⚠️ Follow-Up Required</p>
                <p className="text-sm font-medium">Reach out to reschedule assessment. Check if there were booking issues or if lead has gone cold.</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Coach Detail Dialog */}
      <Dialog open={!!selectedCoach} onOpenChange={(open) => !open && setSelectedCoach(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {selectedCoach?.coach_name} — Performance
            </DialogTitle>
          </DialogHeader>
          {selectedCoach && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Total Clients</p>
                  <p className="text-2xl font-bold">{selectedCoach.total_clients || 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Avg Health Score</p>
                  <p className={`text-2xl font-bold ${(selectedCoach.avg_health_score || 0) >= 70 ? "text-emerald-500" : (selectedCoach.avg_health_score || 0) >= 40 ? "text-yellow-500" : "text-red-500"}`}>
                    {(selectedCoach.avg_health_score || 0).toFixed(0)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <p className="text-xs text-emerald-400 mb-1">Clients Improving</p>
                  <p className="text-2xl font-bold text-emerald-500">{selectedCoach.clients_improving || 0}</p>
                </div>
                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <p className="text-xs text-red-400 mb-1">Clients Declining</p>
                  <p className="text-2xl font-bold text-red-500">{selectedCoach.clients_declining || 0}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Trend</p>
                <Badge variant={selectedCoach.trend === "IMPROVING" ? "secondary" : selectedCoach.trend === "DECLINING" ? "destructive" : "outline"} className="text-sm">
                  {selectedCoach.trend || "—"}
                </Badge>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Report Date</p>
                <p className="font-medium">
                  {selectedCoach.report_date ? format(new Date(selectedCoach.report_date), "MMM dd, yyyy") : "—"}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs text-primary mb-1">📊 Insight</p>
                <p className="text-sm font-medium">
                  {(selectedCoach.clients_declining || 0) > (selectedCoach.clients_improving || 0)
                    ? "More clients declining than improving — review coaching approach"
                    : (selectedCoach.avg_health_score || 0) >= 70
                    ? "Strong performance — clients are healthy and engaged"
                    : "Mixed results — focus on at-risk clients"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesCoachTracker;
