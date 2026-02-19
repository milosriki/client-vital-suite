import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Target,
  TrendingUp,
  Download,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Flame,
  BarChart3,
  Filter,
  ChevronRight,
  Phone,
  Mail,
  Calendar,
  Clock,
  Zap,
  Eye,
} from "lucide-react";
import { format, differenceInDays, subDays } from "date-fns";

// ── Types ──
type TimeRange = "7d" | "30d" | "90d" | "all";
type SortDir = "asc" | "desc";

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  lifecycle_stage: string | null;
  lead_source: string | null;
  hs_analytics_source: string | null;
  hs_analytics_source_data_1: string | null;
  hs_analytics_source_data_2: string | null;
  created_at: string | null;
  city: string | null;
  state: string | null;
}

interface EnhancedLead {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  lead_score: number | null;
  engagement_level: string | null;
  recommended_action: string | null;
  phone: string | null;
  lifecycle_stage: string | null;
  created_at: string | null;
}

interface Deal {
  id: string;
  deal_name: string | null;
  deal_stage: string | null;
  amount: number | null;
  close_date: string | null;
  contact_email: string | null;
}

// ── Helpers ──
function getDateCutoff(range: TimeRange): Date | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return subDays(new Date(), days);
}

function filterByDate<T extends { created_at: string | null }>(rows: T[], range: TimeRange): T[] {
  const cutoff = getDateCutoff(range);
  if (!cutoff) return rows;
  return rows.filter((r) => r.created_at && new Date(r.created_at) >= cutoff);
}

function exportCSV(headers: string[], rows: string[][], filename: string) {
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ──
export default function LeadTracking() {
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [activeTab, setActiveTab] = useState("pipeline");

  // Fetch all contacts
  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["lead-tracking-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, lifecycle_stage, lead_source, hs_analytics_source, hs_analytics_source_data_1, hs_analytics_source_data_2, created_at, city, state")
        .limit(15000);
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
    staleTime: 5 * 60_000,
  });

  // Fetch enhanced leads
  const { data: enhancedLeads = [], isLoading: loadingEnhanced } = useQuery({
    queryKey: ["lead-tracking-enhanced"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enhanced_leads")
        .select("*")
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as EnhancedLead[];
    },
    staleTime: 5 * 60_000,
  });

  // Fetch deals
  const { data: deals = [] } = useQuery({
    queryKey: ["lead-tracking-deals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, deal_name, deal_stage, amount, close_date, contact_email")
        .limit(20000);
      if (error) throw error;
      return (data ?? []) as Deal[];
    },
    staleTime: 5 * 60_000,
  });

  const filtered = useMemo(() => filterByDate(contacts, timeRange), [contacts, timeRange]);

  const isLoading = loadingContacts || loadingEnhanced;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Target className="h-8 w-8 text-primary" />
            Lead Tracking
          </h1>
          <p className="text-muted-foreground mt-1">
            {contacts.length.toLocaleString()} contacts · Pipeline, scoring & source analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["7d", "30d", "90d", "all"] as TimeRange[]).map((r) => (
            <Button
              key={r}
              variant={timeRange === r ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange(r)}
              className="cursor-pointer"
            >
              {r === "all" ? "All Time" : r}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pipeline" className="cursor-pointer gap-1">
            <TrendingUp className="h-4 w-4" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="active-leads" className="cursor-pointer gap-1">
            <Users className="h-4 w-4" /> Active Leads
          </TabsTrigger>
          <TabsTrigger value="scoring" className="cursor-pointer gap-1">
            <Flame className="h-4 w-4" /> Lead Scoring
          </TabsTrigger>
          <TabsTrigger value="sources" className="cursor-pointer gap-1">
            <BarChart3 className="h-4 w-4" /> Source Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <PipelineTab contacts={filtered} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="active-leads">
          <ActiveLeadsTab contacts={filtered} deals={deals} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="scoring">
          <ScoringTab leads={enhancedLeads} isLoading={loadingEnhanced} timeRange={timeRange} />
        </TabsContent>
        <TabsContent value="sources">
          <SourceAnalysisTab contacts={filtered} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ════════════════════════════════════════════
// TAB 1: Pipeline
// ════════════════════════════════════════════
function PipelineTab({ contacts, isLoading }: { contacts: Contact[]; isLoading: boolean }) {
  const stages = useMemo(() => {
    const counts: Record<string, number> = { subscriber: 0, lead: 0, opportunity: 0, customer: 0 };
    contacts.forEach((c) => {
      const s = (c.lifecycle_stage ?? "").toLowerCase();
      if (s in counts) counts[s]++;
    });
    return counts;
  }, [contacts]);

  const sourceBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    contacts.forEach((c) => {
      const src = c.hs_analytics_source || "Unknown";
      map[src] = (map[src] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [contacts]);

  const funnelStages = [
    { key: "subscriber", label: "Subscriber", count: stages.subscriber, color: "bg-blue-500" },
    { key: "lead", label: "Lead", count: stages.lead, color: "bg-yellow-500" },
    { key: "opportunity", label: "Opportunity", count: stages.opportunity, color: "bg-orange-500" },
    { key: "customer", label: "Customer", count: stages.customer, color: "bg-green-500" },
  ];

  const maxCount = Math.max(...funnelStages.map((s) => s.count), 1);

  const conversionRate = (from: number, to: number) =>
    from === 0 ? "0%" : `${((to / from) * 100).toFixed(1)}%`;

  const handleExport = () => {
    exportCSV(
      ["Stage", "Count", "Conversion to Next"],
      funnelStages.map((s, i) => [
        s.label,
        String(s.count),
        i < funnelStages.length - 1 ? conversionRate(s.count, funnelStages[i + 1].count) : "—",
      ]),
      "lead-pipeline.csv"
    );
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport} className="cursor-pointer gap-1">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Lead Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {funnelStages.map((stage, i) => {
              const widthPct = Math.max((stage.count / maxCount) * 100, 8);
              return (
                <div key={stage.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{stage.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold">{stage.count.toLocaleString()}</span>
                      {i > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {conversionRate(funnelStages[i - 1].count, stage.count)} from {funnelStages[i - 1].label}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-8 overflow-hidden">
                    <div
                      className={`${stage.color} h-full rounded-full transition-all duration-500 flex items-center justify-end pr-3`}
                      style={{ width: `${widthPct}%` }}
                    >
                      <span className="text-xs font-bold text-white drop-shadow">
                        {stage.count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {i < funnelStages.length - 1 && (
                    <div className="flex justify-center my-1">
                      <ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Source Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Top Sources (hs_analytics_source)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sourceBreakdown.map(([src, count]) => {
              const pct = Math.max((count / maxCount) * 100, 4);
              return (
                <div key={src} className="flex items-center gap-3">
                  <span className="text-sm w-40 truncate">{src}</span>
                  <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono w-16 text-right">{count.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════
// TAB 2: Active Leads
// ════════════════════════════════════════════
function ActiveLeadsTab({ contacts, deals, isLoading }: { contacts: Contact[]; deals: Deal[]; isLoading: boolean }) {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortCol, setSortCol] = useState<"name" | "email" | "created" | "days">("days");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const leads = useMemo(
    () => contacts.filter((c) => (c.lifecycle_stage ?? "").toLowerCase() === "lead"),
    [contacts]
  );

  const sources = useMemo(() => {
    const s = new Set<string>();
    leads.forEach((l) => { if (l.hs_analytics_source) s.add(l.hs_analytics_source); });
    return Array.from(s).sort();
  }, [leads]);

  const now = new Date();

  const displayed = useMemo(() => {
    let rows = [...leads];
    if (sourceFilter !== "all") rows = rows.filter((r) => r.hs_analytics_source === sourceFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.first_name ?? "").toLowerCase().includes(q) ||
          (r.last_name ?? "").toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q) ||
          (r.phone ?? "").includes(q)
      );
    }
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortCol === "name") cmp = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      else if (sortCol === "email") cmp = (a.email ?? "").localeCompare(b.email ?? "");
      else if (sortCol === "created") cmp = (a.created_at ?? "").localeCompare(b.created_at ?? "");
      else cmp = daysSince(a.created_at) - daysSince(b.created_at);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [leads, sourceFilter, search, sortCol, sortDir]);

  function daysSince(d: string | null) {
    return d ? differenceInDays(now, new Date(d)) : 0;
  }

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  const SortIcon = ({ col }: { col: typeof sortCol }) =>
    sortCol === col ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />;

  const contactDeals = useMemo(() => {
    if (!selectedContact?.email) return [];
    return deals.filter((d) => d.contact_email === selectedContact.email);
  }, [selectedContact, deals]);

  const handleExport = () => {
    exportCSV(
      ["Name", "Email", "Phone", "Source", "Created", "Days Since Created"],
      displayed.map((r) => [
        `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
        r.email ?? "",
        r.phone ?? "",
        r.hs_analytics_source ?? "",
        r.created_at ? format(new Date(r.created_at), "yyyy-MM-dd") : "",
        String(daysSince(r.created_at)),
      ]),
      "active-leads.csv"
    );
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[200px] cursor-pointer">
            <Filter className="h-4 w-4 mr-1" />
            <SelectValue placeholder="Filter by source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary">{displayed.length} leads</Badge>
        <Button variant="outline" size="sm" onClick={handleExport} className="cursor-pointer gap-1">
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  {[
                    { col: "name" as const, label: "Name" },
                    { col: "email" as const, label: "Email" },
                    { col: "name" as const, label: "Phone" },
                    { col: "name" as const, label: "Source" },
                    { col: "created" as const, label: "Created" },
                    { col: "days" as const, label: "Days" },
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="text-left p-3 font-medium cursor-pointer hover:bg-muted/80 select-none"
                      onClick={() => i !== 2 && i !== 3 && toggleSort(h.col)}
                    >
                      <span className="flex items-center gap-1">
                        {h.label}
                        {(i === 0 || i === 1 || i === 4 || i === 5) && <SortIcon col={h.col} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.slice(0, 200).map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedContact(c)}
                  >
                    <td className="p-3">{`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"}</td>
                    <td className="p-3 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{c.phone ?? "—"}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">{c.hs_analytics_source ?? "—"}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {c.created_at ? format(new Date(c.created_at), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant={daysSince(c.created_at) > 30 ? "destructive" : "secondary"}>
                        {daysSince(c.created_at)}d
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayed.length > 200 && (
              <p className="text-center text-xs text-muted-foreground py-3">
                Showing 200 of {displayed.length} — use search/filter to narrow
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedContact ? `${selectedContact.first_name ?? ""} ${selectedContact.last_name ?? ""}`.trim() || "Contact" : ""}
            </DialogTitle>
          </DialogHeader>
          {selectedContact && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {selectedContact.email ?? "—"}</div>
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {selectedContact.phone ?? "—"}</div>
                <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted-foreground" /> {selectedContact.hs_analytics_source ?? "—"}</div>
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> {selectedContact.created_at ? format(new Date(selectedContact.created_at), "MMM d, yyyy") : "—"}</div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> {daysSince(selectedContact.created_at)} days old</div>
                <div className="flex items-center gap-2"><Target className="h-4 w-4 text-muted-foreground" /> {selectedContact.lifecycle_stage ?? "—"}</div>
              </div>
              {selectedContact.hs_analytics_source_data_1 && (
                <div className="text-sm text-muted-foreground">
                  Source detail: {selectedContact.hs_analytics_source_data_1}
                  {selectedContact.hs_analytics_source_data_2 && ` · ${selectedContact.hs_analytics_source_data_2}`}
                </div>
              )}
              {contactDeals.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Linked Deals ({contactDeals.length})</h4>
                  <div className="space-y-2">
                    {contactDeals.slice(0, 5).map((d) => (
                      <div key={d.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-2 text-sm">
                        <span>{d.deal_name ?? "Untitled"}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{d.deal_stage ?? "—"}</Badge>
                          {d.amount != null && <span className="font-mono">${d.amount.toLocaleString()}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {contactDeals.length === 0 && (
                <p className="text-sm text-muted-foreground">No linked deals found.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════
// TAB 3: Lead Scoring
// ════════════════════════════════════════════
function ScoringTab({ leads, isLoading, timeRange }: { leads: EnhancedLead[]; isLoading: boolean; timeRange: TimeRange }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let rows = filterByDate(leads, timeRange);
    rows.sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0));
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.first_name ?? "").toLowerCase().includes(q) ||
          (r.last_name ?? "").toLowerCase().includes(q) ||
          (r.email ?? "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [leads, timeRange, search]);

  const handleExport = () => {
    exportCSV(
      ["Name", "Email", "Score", "Engagement", "Recommended Action"],
      filtered.map((r) => [
        `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
        r.email ?? "",
        String(r.lead_score ?? 0),
        r.engagement_level ?? "",
        r.recommended_action ?? "",
      ]),
      "lead-scoring.csv"
    );
  };

  if (isLoading) return <LoadingSkeleton />;

  const engagementColor = (level: string | null) => {
    const l = (level ?? "").toLowerCase();
    if (l.includes("high") || l.includes("hot")) return "bg-red-500/20 text-red-400 border-red-500/30";
    if (l.includes("med")) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  };

  const scoreColor = (score: number | null) => {
    const s = score ?? 0;
    if (s >= 80) return "text-red-400";
    if (s >= 50) return "text-yellow-400";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search scored leads..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Badge variant="secondary">{filtered.length} scored leads</Badge>
        <Button variant="outline" size="sm" onClick={handleExport} className="cursor-pointer gap-1">
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-medium">Rank</th>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Email</th>
                  <th className="text-left p-3 font-medium">Score</th>
                  <th className="text-left p-3 font-medium">Engagement</th>
                  <th className="text-left p-3 font-medium">Recommended Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((lead, i) => (
                  <tr key={lead.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-muted-foreground">{i + 1}</td>
                    <td className="p-3 font-medium">
                      {`${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">{lead.email ?? "—"}</td>
                    <td className="p-3">
                      <span className={`text-lg font-bold ${scoreColor(lead.lead_score)}`}>
                        {lead.lead_score ?? 0}
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={engagementColor(lead.engagement_level)}>
                        {lead.engagement_level ?? "—"}
                      </Badge>
                    </td>
                    <td className="p-3 text-sm max-w-[300px] truncate">{lead.recommended_action ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════
// TAB 4: Source Analysis
// ════════════════════════════════════════════
function SourceAnalysisTab({ contacts, isLoading }: { contacts: Contact[]; isLoading: boolean }) {
  const analysis = useMemo(() => {
    const map: Record<string, { total: number; leads: number; opportunities: number; customers: number }> = {};
    contacts.forEach((c) => {
      const src = c.hs_analytics_source || "Unknown";
      if (!map[src]) map[src] = { total: 0, leads: 0, opportunities: 0, customers: 0 };
      map[src].total++;
      const stage = (c.lifecycle_stage ?? "").toLowerCase();
      if (stage === "lead") map[src].leads++;
      if (stage === "opportunity") map[src].opportunities++;
      if (stage === "customer") map[src].customers++;
    });
    return Object.entries(map)
      .map(([source, d]) => ({
        source,
        ...d,
        oppRate: d.total > 0 ? (d.opportunities / d.total) * 100 : 0,
        custRate: d.total > 0 ? (d.customers / d.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [contacts]);

  const maxTotal = Math.max(...analysis.map((a) => a.total), 1);

  const handleExport = () => {
    exportCSV(
      ["Source", "Total", "Leads", "Opportunities", "Customers", "Opp Rate %", "Customer Rate %"],
      analysis.map((a) => [
        a.source,
        String(a.total),
        String(a.leads),
        String(a.opportunities),
        String(a.customers),
        a.oppRate.toFixed(1),
        a.custRate.toFixed(1),
      ]),
      "source-analysis.csv"
    );
  };

  if (isLoading) return <LoadingSkeleton />;

  const barColors = [
    "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500",
    "bg-cyan-500", "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-orange-500",
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport} className="cursor-pointer gap-1">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Contacts by Source
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.slice(0, 12).map((a, i) => (
              <div key={a.source} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate max-w-[200px]">{a.source}</span>
                  <span className="font-mono">{a.total.toLocaleString()}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-6 overflow-hidden flex">
                  <div
                    className={`${barColors[i % barColors.length]} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${(a.total / maxTotal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle>Conversion Rates by Source</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Source</th>
                  <th className="text-right p-3 font-medium">Total</th>
                  <th className="text-right p-3 font-medium">Leads</th>
                  <th className="text-right p-3 font-medium">Opportunities</th>
                  <th className="text-right p-3 font-medium">Customers</th>
                  <th className="text-right p-3 font-medium">→ Opp %</th>
                  <th className="text-right p-3 font-medium">→ Cust %</th>
                </tr>
              </thead>
              <tbody>
                {analysis.map((a) => (
                  <tr key={a.source} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="p-3 font-medium">{a.source}</td>
                    <td className="p-3 text-right font-mono">{a.total.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono">{a.leads}</td>
                    <td className="p-3 text-right font-mono">{a.opportunities}</td>
                    <td className="p-3 text-right font-mono">{a.customers}</td>
                    <td className="p-3 text-right">
                      <Badge variant={a.oppRate > 5 ? "default" : "secondary"}>{a.oppRate.toFixed(1)}%</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Badge variant={a.custRate > 2 ? "default" : "secondary"}>{a.custRate.toFixed(1)}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Loading Skeleton ──
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="h-4 bg-muted rounded w-1/3 mb-4 animate-pulse" />
            <div className="h-32 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
