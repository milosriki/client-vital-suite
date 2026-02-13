import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DEAL_STAGES, HUBSPOT_STAGE_IDS, ACTIVE_PIPELINE_STAGES } from "@/constants/dealStages";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DollarSign,
  Users,
  Target,
  TrendingUp,
  Zap,
  Ghost,
  AlertTriangle,
  Calendar,
  Crosshair,
  Activity,
  Layers,
  Palette,
  Search,
} from "lucide-react";
import { subDays } from "date-fns";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { getBusinessDate } from "@/lib/date-utils";
import { PageSkeleton } from "@/components/ui/page-skeleton";

type Period = "7" | "30" | "90";

export default function CommandCenter() {
  const [period, setPeriod] = useState<Period>("30");
  const [journeySearch, setJourneySearch] = useState("");
  const cutoff = useMemo(
    () => subDays(getBusinessDate(), Number(period)).toISOString(),
    [period],
  );

  // ── A: Ad Spend ──
  const { data: adSpendData } = useDedupedQuery({
    queryKey: ["cc-ad-spend", period],
    queryFn: async () => {
      const cutoffDate = subDays(getBusinessDate(), Number(period))
        .toISOString()
        .split("T")[0];
      const { data, error } = await supabase
        .from("facebook_ads_insights")
        .select("spend")
        .gte("date", cutoffDate);
      if (error) throw error;
      return (data || []).reduce((s: number, r) => s + (r.spend || 0), 0);
    },
  });

  // ── A: Leads count ──
  const { data: leadsCount } = useDedupedQuery({
    queryKey: ["cc-leads-count", period],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", cutoff);
      if (error) throw error;
      return count || 0;
    },
  });

  // ── A: Bookings + Closed Won ──
  const { data: dealStats } = useDedupedQuery({
    queryKey: ["cc-deal-stats", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("stage, deal_value")
        .gte("updated_at", cutoff);
      if (error) throw error;
      const bookingStages = new Set<string>(ACTIVE_PIPELINE_STAGES);
      let bookings = 0;
      let closedWon = 0;
      let revenue = 0;
      (data || []).forEach((d) => {
        if (bookingStages.has(d.stage || "")) bookings++;
        if (d.stage === DEAL_STAGES.CLOSED_WON) {
          closedWon++;
          revenue += d.deal_value || 0;
        }
      });
      return { bookings, closedWon, revenue };
    },
  });

  const adSpend = adSpendData || 0;
  const leads = leadsCount || 0;
  const { bookings = 0, closedWon = 0, revenue = 0 } = dealStats || {};
  const roasNum = adSpend > 0 ? revenue / adSpend : 0;
  const roas = adSpend > 0 ? roasNum.toFixed(1) : "N/A";
  const cpl = adSpend > 0 && leads > 0 ? Math.round(adSpend / leads) : 0;

  // ── B: Campaign Full Funnel ──
  const { data: funnelData, isLoading: loadingFunnel } = useDedupedQuery({
    queryKey: ["cc-campaign-funnel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_full_funnel")
        .select("*")
        .order("spend", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ── C1: Setter Funnel ──
  const { data: setterData, isLoading: loadingSetters } = useDedupedQuery({
    queryKey: ["cc-setter-funnel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setter_funnel_matrix")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  // ── C2: Coach Performance ──
  const { data: coachData, isLoading: loadingCoaches } = useDedupedQuery({
    queryKey: ["cc-coach-perf"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_performance")
        .select("*")
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

  // ── D1: No-Shows ──
  const { data: noShows, isLoading: loadingNoShows } = useDedupedQuery({
    queryKey: ["cc-no-shows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessment_truth_matrix")
        .select("*")
        .in("truth_status", [
          "BOOKED_NOT_ATTENDED",
          "HUBSPOT_ONLY_NO_AWS_PROOF",
        ])
        .limit(25);
      if (error) throw error;
      return data;
    },
  });

  // ── D2: Cold Leads ──
  const { data: coldLeads, isLoading: loadingCold } = useDedupedQuery({
    queryKey: ["cc-cold-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cold_leads")
        .select("*")
        .limit(25);
      if (error) throw error;
      return data;
    },
  });

  // ── D3: Churn Risk ──
  const { data: churnRisk, isLoading: loadingChurn } = useDedupedQuery({
    queryKey: ["cc-churn-risk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_health_scores")
        .select(
          "email, firstname, lastname, health_score, health_zone, health_trend, churn_risk_score, outstanding_sessions",
        )
        .in("health_trend", ["DECLINING", "CLIFF_FALL"])
        .order("churn_risk_score", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // ── E: Upcoming Assessments ──
  const { data: upcomingAssessments, isLoading: loadingAssessments } =
    useDedupedQuery({
      queryKey: ["cc-upcoming-assessments"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("upcoming_assessments")
          .select("*")
          .limit(25);
        if (error) throw error;
        return data;
      },
    });

  // ── F: Adset Full Funnel ──
  const { data: adsetData, isLoading: loadingAdsets } = useDedupedQuery({
    queryKey: ["cc-adset-funnel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adset_full_funnel")
        .select("*")
        .order("spend", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ── G: Creative Funnel ──
  const { data: creativeData, isLoading: loadingCreatives } = useDedupedQuery({
    queryKey: ["cc-creative-funnel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ad_creative_funnel")
        .select("*")
        .order("spend", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ── H: Lead Journey Search ──
  const { data: journeyData, isLoading: loadingJourney } = useDedupedQuery({
    queryKey: ["cc-lead-journey", journeySearch],
    queryFn: async () => {
      if (!journeySearch || journeySearch.length < 3) return null;
      const term = journeySearch.trim();
      const isEmail = term.includes("@");
      const isPhone = /^\+?\d{7,}$/.test(term.replace(/[\s-]/g, ""));
      let query = supabase.from("lead_full_journey").select("*");
      if (isEmail) {
        query = query.ilike("email", `%${term}%`);
      } else if (isPhone) {
        query = query.ilike("phone", `%${term}%`);
      } else {
        query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
      }
      const { data, error } = await query.limit(10);
      if (error) throw error;
      return data;
    },
    enabled: journeySearch.length >= 3,
  });

  const verdictBadge = (verdict: string) => {
    switch (verdict) {
      case "SCALE":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            SCALE
          </Badge>
        );
      case "MONITOR":
        return <Badge variant="secondary">MONITOR</Badge>;
      case "LOW_VOLUME":
      case "NO_SPEND":
        return <Badge variant="outline">{verdict}</Badge>;
      default:
        return <Badge variant="destructive">{verdict}</Badge>;
    }
  };

  const urgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "CRITICAL":
        return <Badge variant="destructive">CRITICAL</Badge>;
      case "URGENT":
        return (
          <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">
            URGENT
          </Badge>
        );
      case "WARNING":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            WARNING
          </Badge>
        );
      default:
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            FRESH
          </Badge>
        );
    }
  };

  const creativeBadge = (verdict: string) => {
    switch (verdict) {
      case "WINNER":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            WINNER
          </Badge>
        );
      case "PROFITABLE":
        return <Badge variant="secondary">PROFITABLE</Badge>;
      case "LOW_VOLUME":
      case "NO_SPEND":
        return <Badge variant="outline">{verdict}</Badge>;
      default:
        return <Badge variant="destructive">{verdict}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header + Period Selector ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Command Center</h1>
          <p className="text-muted-foreground">
            Full-chain visibility: Ad Spend → Lead → Call → Book → Close
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Section A: Money Chain KPIs ── */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Ad Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {adSpend.toLocaleString()} <span className="text-xs">AED</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{leads.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{bookings}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">Closed Won</CardTitle>
            <Target className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-emerald-500">
              {revenue.toLocaleString()} <span className="text-xs">AED</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">True ROAS</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{roas === "N/A" ? roas : `${roas}x`}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">CPL</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {cpl.toLocaleString()} <span className="text-xs">AED</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Section B: Campaign Funnel Breakdown ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5" />
            Campaign Full Funnel
          </CardTitle>
          <CardDescription>
            FB Spend → Leads → Booked → Held → Closed with auto-verdict
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingFunnel ? (
            <PageSkeleton variant="table" />
          ) : funnelData && funnelData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Campaign</TableHead>
                    <TableHead className="text-xs text-right">Spend</TableHead>
                    <TableHead className="text-xs text-right">Leads</TableHead>
                    <TableHead className="text-xs text-right">Booked</TableHead>
                    <TableHead className="text-xs text-right">Held</TableHead>
                    <TableHead className="text-xs text-right">Closed</TableHead>
                    <TableHead className="text-xs text-right">Revenue</TableHead>
                    <TableHead className="text-xs text-right">ROAS</TableHead>
                    <TableHead className="text-xs">Verdict</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {funnelData
                    .filter(
                      (r: Record<string, unknown>) =>
                        (Number(r.spend) || 0) > 0 ||
                        (Number(r.db_leads) || 0) > 0,
                    )
                    .map((r: Record<string, unknown>, i: number) => (
                      <TableRow
                        key={i}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {String(r.campaign || "Unknown")}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(r.spend || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(r.db_leads || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(r.booked || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(r.held || 0)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {Number(r.closed_won || 0)}
                        </TableCell>
                        <TableCell className="text-right text-emerald-500 font-bold">
                          {Number(r.revenue || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(r.roas || 0).toFixed(1)}x
                        </TableCell>
                        <TableCell>
                          {verdictBadge(String(r.verdict || ""))}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No campaign funnel data. Deploy the migration first.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Section B2: Attribution Breakdown (Adset + Creative) ── */}
      <Tabs defaultValue="adsets" className="space-y-4">
        <TabsList>
          <TabsTrigger value="adsets">
            <Layers className="h-4 w-4 mr-1" /> Adset Breakdown
          </TabsTrigger>
          <TabsTrigger value="creatives">
            <Palette className="h-4 w-4 mr-1" /> Creative Performance
          </TabsTrigger>
          <TabsTrigger value="journey">
            <Search className="h-4 w-4 mr-1" /> Lead Journey
          </TabsTrigger>
        </TabsList>

        <TabsContent value="adsets">
          <Card>
            <CardHeader>
              <CardTitle>Adset Full Funnel</CardTitle>
              <CardDescription>
                Per ad set: spend → leads → booked → closed with verdict
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAdsets ? (
                <PageSkeleton variant="table" />
              ) : adsetData && adsetData.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Campaign</TableHead>
                        <TableHead className="text-xs">Adset</TableHead>
                        <TableHead className="text-xs text-right">Spend</TableHead>
                        <TableHead className="text-xs text-right">Leads</TableHead>
                        <TableHead className="text-xs text-right">Booked</TableHead>
                        <TableHead className="text-xs text-right">Held</TableHead>
                        <TableHead className="text-xs text-right">Closed</TableHead>
                        <TableHead className="text-xs text-right">Revenue</TableHead>
                        <TableHead className="text-xs text-right">ROAS</TableHead>
                        <TableHead className="text-xs">Verdict</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adsetData.map((r: Record<string, unknown>, i: number) => (
                        <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="text-sm max-w-[150px] truncate">{String(r.campaign_name || "—")}</TableCell>
                          <TableCell className="font-medium max-w-[180px] truncate">{String(r.adset_name || "Unknown")}</TableCell>
                          <TableCell className="text-right">{Number(r.spend || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{Number(r.db_leads || 0)}</TableCell>
                          <TableCell className="text-right">{Number(r.booked || 0)}</TableCell>
                          <TableCell className="text-right">{Number(r.held || 0)}</TableCell>
                          <TableCell className="text-right font-bold">{Number(r.closed_won || 0)}</TableCell>
                          <TableCell className="text-right text-emerald-500 font-bold">{Number(r.revenue || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{Number(r.roas || 0).toFixed(1)}x</TableCell>
                          <TableCell>{verdictBadge(String(r.verdict || ""))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No adset data. Deploy the attribution migration first.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="creatives">
          <Card>
            <CardHeader>
              <CardTitle>Creative / Ad Performance</CardTitle>
              <CardDescription>
                Per ad creative: spend, leads, revenue, video completion, Meta quality signals
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCreatives ? (
                <PageSkeleton variant="table" />
              ) : creativeData && creativeData.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Ad Name</TableHead>
                        <TableHead className="text-xs">Campaign</TableHead>
                        <TableHead className="text-xs text-right">Spend</TableHead>
                        <TableHead className="text-xs text-right">Leads</TableHead>
                        <TableHead className="text-xs text-right">Closed</TableHead>
                        <TableHead className="text-xs text-right">Revenue</TableHead>
                        <TableHead className="text-xs text-right">ROAS</TableHead>
                        <TableHead className="text-xs text-right">Video %</TableHead>
                        <TableHead className="text-xs">Quality</TableHead>
                        <TableHead className="text-xs">Verdict</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creativeData.map((r: Record<string, unknown>, i: number) => (
                        <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium max-w-[200px] truncate">{String(r.ad_name || "Unknown")}</TableCell>
                          <TableCell className="text-sm max-w-[150px] truncate">{String(r.campaign_name || "—")}</TableCell>
                          <TableCell className="text-right">{Number(r.spend || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{Number(r.db_leads || 0)}</TableCell>
                          <TableCell className="text-right font-bold">{Number(r.closed_won || 0)}</TableCell>
                          <TableCell className="text-right text-emerald-500 font-bold">{Number(r.revenue || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{Number(r.roas || 0).toFixed(1)}x</TableCell>
                          <TableCell className="text-right">{Number(r.video_completion_pct || 0)}%</TableCell>
                          <TableCell className="text-xs">{String(r.quality_ranking || "—")}</TableCell>
                          <TableCell>{creativeBadge(String(r.creative_verdict || ""))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No creative data. Deploy the attribution migration first.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journey">
          <Card>
            <CardHeader>
              <CardTitle>Lead Journey Drill-Down</CardTitle>
              <CardDescription>
                Search by email, name, or phone to trace a lead's full journey: Ad → Call → Book → Close
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by email, name, or phone..."
                  value={journeySearch}
                  onChange={(e) => setJourneySearch(e.target.value)}
                  className="max-w-md"
                />
                {journeySearch && (
                  <Button variant="ghost" size="sm" onClick={() => setJourneySearch("")}>
                    Clear
                  </Button>
                )}
              </div>
              {loadingJourney ? (
                <PageSkeleton variant="cards" count={3} />
              ) : journeyData && journeyData.length > 0 ? (
                <div className="space-y-3">
                  {journeyData.map((l: Record<string, unknown>, i: number) => (
                    <Card key={i} className="border-l-4 border-l-primary/50">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-lg">
                              {[l.first_name, l.last_name].filter(Boolean).join(" ") || String(l.email || "Unknown")}
                            </p>
                            <p className="text-sm text-muted-foreground">{String(l.email || "")} | {String(l.phone || "")}</p>
                          </div>
                          <Badge variant={l.deal_stage === DEAL_STAGES.CLOSED_WON ? "default" : "secondary"}>
                            {String(l.deal_stage_label || "No Deal")}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Campaign:</span>
                            <p className="font-medium truncate">{String(l.attribution_campaign || "—")}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Adset:</span>
                            <p className="font-medium truncate">{String(l.fb_adset_name || "—")}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Ad:</span>
                            <p className="font-medium truncate">{String(l.fb_ad_name || "—")}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Source:</span>
                            <p className="font-medium">{String(l.attribution_source || "—")}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Calls:</span>
                            <p className="font-medium">{Number(l.total_calls || 0)} ({Number(l.completed_calls || 0)} connected)</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Agent:</span>
                            <p className="font-medium">{String(l.latest_agent || "—")}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Coach:</span>
                            <p className="font-medium">{String(l.assigned_coach || "—")}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Deal Value:</span>
                            <p className="font-medium text-emerald-500">{Number(l.deal_value || 0).toLocaleString()} AED</p>
                          </div>
                          {l.health_score != null && (
                            <div>
                              <span className="text-muted-foreground">Health:</span>
                              <p className="font-medium">{Number(l.health_score)} ({String(l.health_zone || "—")})</p>
                            </div>
                          )}
                          {l.speed_to_lead_minutes != null && (
                            <div>
                              <span className="text-muted-foreground">Speed to Lead:</span>
                              <p className="font-medium">{Number(l.speed_to_lead_minutes)} min</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : journeySearch.length >= 3 ? (
                <p className="text-muted-foreground text-center py-4">No leads found for "{journeySearch}"</p>
              ) : (
                <p className="text-muted-foreground text-center py-4">Enter at least 3 characters to search</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Section C: Team Performance ── */}
      <Tabs defaultValue="setters" className="space-y-4">
        <TabsList>
          <TabsTrigger value="setters">Setter Funnel</TabsTrigger>
          <TabsTrigger value="coaches">Coach Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="setters">
          <Card>
            <CardHeader>
              <CardTitle>Setter Funnel Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSetters ? (
                <PageSkeleton variant="table" />
              ) : setterData && setterData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Setter</TableHead>
                      <TableHead className="text-xs text-right">Leads</TableHead>
                      <TableHead className="text-xs text-right">Booked</TableHead>
                      <TableHead className="text-xs text-right">Held</TableHead>
                      <TableHead className="text-xs text-right">Closed</TableHead>
                      <TableHead className="text-xs text-right">Ghost %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {setterData.map((s: Record<string, unknown>, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {String(s.setter_name || "Unknown")}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(s.total_leads || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(s.booked || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(s.held || 0)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {Number(s.closed_won || 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              Number(s.ghost_rate_pct || 0) > 40
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
                  No setter data available.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coaches">
          <Card>
            <CardHeader>
              <CardTitle>Coach Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingCoaches ? (
                <PageSkeleton variant="table" />
              ) : coachData && coachData.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Coach</TableHead>
                      <TableHead className="text-xs text-right">Clients</TableHead>
                      <TableHead className="text-xs text-right">Avg Health</TableHead>
                      <TableHead className="text-xs text-right">Improving</TableHead>
                      <TableHead className="text-xs text-right">Declining</TableHead>
                      <TableHead className="text-xs">Trend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coachData.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.coach_name}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.total_clients || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="secondary"
                            className={
                              (c.avg_health_score || 0) >= 70
                                ? "bg-emerald-500/10 text-emerald-500"
                                : (c.avg_health_score || 0) >= 40
                                  ? "bg-yellow-500/10 text-yellow-500"
                                  : "bg-red-500/10 text-red-500"
                            }
                          >
                            {(c.avg_health_score || 0).toFixed(0)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-emerald-500">
                          {c.clients_improving || 0}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {c.clients_declining || 0}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.trend === "IMPROVING" ? "secondary" : c.trend === "DECLINING" ? "destructive" : "outline"}>
                            {c.trend || "—"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No coach data available.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Section D: Follow-up Queue ── */}
      <Tabs defaultValue="no-shows" className="space-y-4">
        <TabsList>
          <TabsTrigger value="no-shows">
            <Ghost className="h-4 w-4 mr-1" /> No-Shows ({noShows?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="cold">
            <AlertTriangle className="h-4 w-4 mr-1" /> Cold Leads (
            {coldLeads?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="churn">
            <Activity className="h-4 w-4 mr-1" /> Churn Risk (
            {churnRisk?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="no-shows">
          <Card>
            <CardHeader>
              <CardTitle>No-Shows &amp; Follow-Up Needed</CardTitle>
              <CardDescription>
                Booked assessments not attended — cross-referenced with AWS
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {noShows.map((ns: Record<string, unknown>, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {String(ns.contact_name || ns.deal_name || "Unknown")}
                        </TableCell>
                        <TableCell className="text-sm">{String(ns.email || "—")}</TableCell>
                        <TableCell>{String(ns.coach || ns.assigned_coach || "—")}</TableCell>
                        <TableCell className="text-sm">{String(ns.stage_label || ns.stage || "—")}</TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-xs">
                            {ns.truth_status === "BOOKED_NOT_ATTENDED" ? "No-Show" : "Unverified"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">No no-shows detected.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cold">
          <Card>
            <CardHeader>
              <CardTitle>Cold Leads — No Deal Activity</CardTitle>
              <CardDescription>Created in last 7 days, no deal created yet</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCold ? (
                <PageSkeleton variant="table" />
              ) : coldLeads && coldLeads.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Phone</TableHead>
                      <TableHead className="text-xs">Setter</TableHead>
                      <TableHead className="text-xs">Campaign</TableHead>
                      <TableHead className="text-xs text-right">Hours</TableHead>
                      <TableHead className="text-xs">Urgency</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coldLeads.map((l: Record<string, unknown>) => (
                      <TableRow key={String(l.id)}>
                        <TableCell className="font-medium">
                          {[l.first_name, l.last_name].filter(Boolean).join(" ") ||
                            String(l.email || "Unknown")}
                        </TableCell>
                        <TableCell className="text-sm">{String(l.phone || "—")}</TableCell>
                        <TableCell>{String(l.setter || "—")}</TableCell>
                        <TableCell className="text-sm max-w-[150px] truncate">
                          {String(l.source_campaign || "—")}
                        </TableCell>
                        <TableCell className="text-right">
                          {l.hours_since_creation != null ? Math.round(Number(l.hours_since_creation)) : "—"}
                        </TableCell>
                        <TableCell>{urgencyBadge(String(l.urgency || "FRESH"))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No cold leads — all recent contacts have deals.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="churn">
          <Card>
            <CardHeader>
              <CardTitle>Churn Risk — Declining Clients</CardTitle>
              <CardDescription>Clients with declining or cliff-fall health trends</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingChurn ? (
                <PageSkeleton variant="table" />
              ) : churnRisk && churnRisk.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                      <TableHead className="text-xs text-right">Health</TableHead>
                      <TableHead className="text-xs">Zone</TableHead>
                      <TableHead className="text-xs">Trend</TableHead>
                      <TableHead className="text-xs text-right">Churn %</TableHead>
                      <TableHead className="text-xs text-right">Sess Left</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {churnRisk.map((c, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          {[c.firstname, c.lastname].filter(Boolean).join(" ") || "Unknown"}
                        </TableCell>
                        <TableCell className="text-sm">{c.email || "—"}</TableCell>
                        <TableCell className="text-right font-bold">
                          {(c.health_score || 0).toFixed(0)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={c.health_zone === "RED" ? "destructive" : "secondary"}>
                            {c.health_zone}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-xs">{c.health_trend}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {(c.churn_risk_score || 0).toFixed(0)}%
                        </TableCell>
                        <TableCell className="text-right">{c.outstanding_sessions ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">No clients with declining trends.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Section E: Upcoming Assessments ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Assessments (Next 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAssessments ? (
            <PageSkeleton variant="table" />
          ) : upcomingAssessments && upcomingAssessments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Coach</TableHead>
                  <TableHead className="text-xs">Setter</TableHead>
                  <TableHead className="text-xs">Campaign</TableHead>
                  <TableHead className="text-xs text-right">Deal Value</TableHead>
                  <TableHead className="text-xs">Stage</TableHead>
                  <TableHead className="text-xs text-right">Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingAssessments.map((a: Record<string, unknown>, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {[a.first_name, a.last_name].filter(Boolean).join(" ") || String(a.email || "Unknown")}
                    </TableCell>
                    <TableCell className="text-sm">{String(a.assessment_date || "—")}</TableCell>
                    <TableCell>{String(a.coach || "—")}</TableCell>
                    <TableCell>{String(a.setter || "—")}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">
                      {String(a.source_campaign || "—")}
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(a.deal_value || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">{String(a.stage_label || "—")}</TableCell>
                    <TableCell className="text-right font-bold">
                      {a.days_until != null ? Math.round(Number(a.days_until)) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No upcoming assessments in the next 7 days.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
