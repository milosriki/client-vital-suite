import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RefreshCw, AlertTriangle, Flame, Users, Phone, ArrowUpDown,
  ChevronUp, ChevronDown, UserX, FileX, PhoneOff, Snowflake,
} from "lucide-react";
import { CHART_COLORS } from "@/lib/chartColors";
import { useQueryClient } from "@tanstack/react-query";

// ── Types ──────────────────────────────────────────────────────────────
interface LeadFollowUpRow {
  id: string;
  hubspot_contact_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  setter_name: string | null;
  lifecycle_stage: string | null;
  lead_source: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  contact_created: string | null;
  days_since_created: number | null;
  last_call_status: string | null;
  last_call_outcome: string | null;
  last_call_date: string | null;
  last_call_agent: string | null;
  total_calls: number;
  answered_calls: number;
  last_activity_date: string | null;
  days_since_last_contact: number | null;
  has_deal: boolean;
  deal_name: string | null;
  deal_stage: string | null;
  deal_value: number | null;
  close_date: string | null;
  deal_created: string | null;
  days_in_deal_stage: number | null;
  assigned_coach: string | null;
  missing_coach: boolean;
  missing_deal: boolean;
  no_calls_made: boolean;
  going_cold: boolean;
  priority_number: number;
  attributed_ad_id: string | null;
  attribution_source: string | null;
}

type SortKey = keyof LeadFollowUpRow;
type SortDir = "asc" | "desc";

// ── Helpers ────────────────────────────────────────────────────────────
const priorityLabel = (p: number) =>
  p === 1 ? "High" : p === 2 ? "Medium" : "Low";

const priorityColor = (p: number) =>
  p === 1 ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
    : p === 2 ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
    : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";

const rowBorder = (p: number) =>
  p === 1 ? "border-l-4 border-l-rose-500"
    : p === 2 ? "border-l-4 border-l-amber-500"
    : "border-l-4 border-l-emerald-500";

const daysBadge = (d: number | null) => {
  if (d == null) return "bg-white/10 text-white/60";
  if (d < 3) return "bg-emerald-500/20 text-emerald-400";
  if (d <= 7) return "bg-amber-500/20 text-amber-400";
  return "bg-rose-500/20 text-rose-400";
};

const formatAED = (v: number | null) =>
  v == null ? "—" : `AED ${Number(v).toLocaleString()}`;

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AE", { day: "numeric", month: "short" });
};

const stageLabels: Record<string, string> = {
  lead: "Lead",
  marketingqualifiedlead: "MQL",
  salesqualifiedlead: "SQL",
  opportunity: "Opportunity",
  customer: "Customer",
};

// ── Component ──────────────────────────────────────────────────────────
export default function LeadFollowUp() {
  const queryClient = useQueryClient();
  const [setterFilter, setSetterFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("priority_number");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data, isLoading } = useDedupedQuery({
    queryKey: ["lead-follow-up", setterFilter, priorityFilter, stageFilter, search],
    queryFn: async () => {
      let query = supabase.from("view_lead_follow_up" as any).select("*");
      if (setterFilter !== "all") query = query.eq("setter_name", setterFilter);
      if (priorityFilter !== "all") query = query.eq("priority_number", Number(priorityFilter));
      if (stageFilter !== "all") query = query.eq("lifecycle_stage", stageFilter);
      if (search)
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`,
        );
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data || []) as LeadFollowUpRow[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const leads = data ?? [];

  // Derived KPIs
  const kpis = useMemo(() => {
    const high = leads.filter((l) => l.priority_number === 1).length;
    const medium = leads.filter((l) => l.priority_number === 2).length;
    const low = leads.filter((l) => l.priority_number === 3).length;
    const cold = leads.filter((l) => l.going_cold).length;
    const noCoach = leads.filter((l) => l.missing_coach).length;
    return { high, medium, low, total: leads.length, cold, noCoach };
  }, [leads]);

  // Unique setters for filter
  const setters = useMemo(
    () => [...new Set(leads.map((l) => l.setter_name).filter(Boolean))].sort() as string[],
    [leads],
  );

  // Sort
  const sorted = useMemo(() => {
    const copy = [...leads];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number")
        return sortDir === "asc" ? av - bv : bv - av;
      const sa = String(av).toLowerCase();
      const sb = String(bv).toLowerCase();
      return sortDir === "asc" ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
    return copy;
  }, [leads, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />
      : <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-30" />;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["lead-follow-up"] });

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Lead Follow-Up</h1>
        <Button variant="outline" size="sm" onClick={refresh} className="border-white/10">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "High Priority", value: kpis.high, color: CHART_COLORS.danger, icon: Flame },
          { label: "Medium", value: kpis.medium, color: CHART_COLORS.revenue, icon: AlertTriangle },
          { label: "Low", value: kpis.low, color: CHART_COLORS.growth, icon: Users },
          { label: "Total Leads", value: kpis.total, color: "#8B5CF6", icon: Users },
          { label: "Going Cold", value: kpis.cold, color: "#3B82F6", icon: Snowflake },
          { label: "Missing Coach", value: kpis.noCoach, color: "#EC4899", icon: UserX },
        ].map((k) => (
          <Card key={k.label} className="bg-black/40 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-white/60 flex items-center gap-1">
                <k.icon className="w-3 h-3" style={{ color: k.color }} />
                {k.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" style={{ color: k.color }}>
                {isLoading ? "…" : k.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={setterFilter}
          onChange={(e) => setSetterFilter(e.target.value)}
          className="bg-black/40 border border-white/10 text-white text-sm rounded-md px-3 py-2"
        >
          <option value="all">All Setters</option>
          {setters.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-black/40 border border-white/10 text-white text-sm rounded-md px-3 py-2"
        >
          <option value="all">All Priorities</option>
          <option value="1">High</option>
          <option value="2">Medium</option>
          <option value="3">Low</option>
        </select>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="bg-black/40 border border-white/10 text-white text-sm rounded-md px-3 py-2"
        >
          <option value="all">All Stages</option>
          {Object.entries(stageLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Input
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs bg-black/40 border-white/10 text-white"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm text-white">
          <thead className="bg-white/5 text-white/60 text-xs uppercase">
            <tr>
              {([
                ["priority_number", "Priority"],
                ["last_name", "Name"],
                ["phone", "Phone"],
                ["setter_name", "Setter"],
                ["lifecycle_stage", "Stage"],
                ["days_since_created", "Days Created"],
                ["last_call_date", "Last Call"],
                ["days_since_last_contact", "Days Since Contact"],
                ["total_calls", "Calls"],
                ["deal_stage", "Deal Stage"],
                ["deal_value", "Deal Value"],
              ] as [SortKey, string][]).map(([key, label]) => (
                <th
                  key={key}
                  className="px-3 py-2 text-left cursor-pointer hover:text-white whitespace-nowrap"
                  onClick={() => toggleSort(key)}
                >
                  {label}
                  <SortIcon col={key} />
                </th>
              ))}
              <th className="px-3 py-2 text-left">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              <tr><td colSpan={12} className="text-center py-12 text-white/40">Loading…</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={12} className="text-center py-12 text-white/40">No leads found</td></tr>
            ) : (
              sorted.map((lead) => (
                <tr key={lead.id} className={`${rowBorder(lead.priority_number)} hover:bg-white/5 transition-colors`}>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={priorityColor(lead.priority_number)}>
                      {priorityLabel(lead.priority_number)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {lead.hubspot_contact_id ? (
                      <a
                        href={`https://app.hubspot.com/contacts/46aborrar/contact/${lead.hubspot_contact_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        {lead.first_name} {lead.last_name}
                      </a>
                    ) : (
                      <span>{lead.first_name} {lead.last_name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {lead.phone ? (
                      <a href={`tel:${lead.phone}`} className="text-blue-400 hover:underline flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {lead.phone}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{lead.setter_name || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="border-white/20 text-white/80">
                      {stageLabels[lead.lifecycle_stage || ""] || lead.lifecycle_stage}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center">{lead.days_since_created ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(lead.last_call_date)}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant="outline" className={daysBadge(lead.days_since_last_contact)}>
                      {lead.days_since_last_contact ?? "—"}d
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center">{lead.total_calls}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{lead.deal_stage || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatAED(lead.deal_value)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {lead.going_cold && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-[10px]">
                          <Snowflake className="w-2.5 h-2.5 mr-0.5" /> Cold
                        </Badge>
                      )}
                      {lead.no_calls_made && (
                        <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/40 text-[10px]">
                          <PhoneOff className="w-2.5 h-2.5 mr-0.5" /> No Calls
                        </Badge>
                      )}
                      {lead.missing_coach && (
                        <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/40 text-[10px]">
                          <UserX className="w-2.5 h-2.5 mr-0.5" /> No Coach
                        </Badge>
                      )}
                      {lead.missing_deal && (
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px]">
                          <FileX className="w-2.5 h-2.5 mr-0.5" /> No Deal
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && (
        <p className="text-xs text-white/40 text-right">
          Showing {sorted.length} leads
        </p>
      )}
    </div>
  );
}
