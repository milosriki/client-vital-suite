import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Phone, PhoneIncoming, Clock, Star, Calendar, TrendingUp, 
  Flame, Users, AlertTriangle, Trophy, PhoneMissed, UserX, BarChart3,
  PieChart, Grid3X3
} from "lucide-react";
import { CallCard } from "@/components/call-tracking/CallCard";
import { CallFilters } from "@/components/call-tracking/CallFilters";
import { CallCardSkeleton } from "@/components/call-tracking/CallCardSkeleton";
import { CallIntelligenceKPIs } from "@/components/call-tracking/CallIntelligenceKPIs";
import { DailyTrends } from "@/components/call-tracking/DailyTrends";
import { HourlyHeatmap } from "@/components/call-tracking/HourlyHeatmap";
import { OwnerPerformance } from "@/components/call-tracking/OwnerPerformance";
import { OutcomeAnalysis } from "@/components/call-tracking/OutcomeAnalysis";
import { TimeRangeFilter } from "@/components/call-tracking/TimeRangeFilter";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { toast } from "sonner";

const normalizePhone = (phone: string | null) => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

export default function CallTracking() {
  const [filters, setFilters] = useState({
    owner: 'all',
    quality: 'all',
    status: 'all',
    location: 'all',
  });
  const [selectedLostLead, setSelectedLostLead] = useState<any>(null);
  const [selectedSetter, setSelectedSetter] = useState<any>(null);
  const [timeRange, setTimeRange] = useState(30);

  const cutoffDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - timeRange);
    return d.toISOString();
  }, [timeRange]);

  // ── Intelligence queries (time-range filtered) ──
  const { data: intelligenceRecords, isLoading: loadingIntel } = useDedupedQuery({
    queryKey: ["call-intelligence", timeRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_records")
        .select("id, call_status, call_outcome, duration_seconds, created_at, started_at, hubspot_owner_id, caller_number, call_direction, appointment_set")
        .gte("created_at", cutoffDate)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Deals for outcome cross-reference
  const { data: deals } = useDedupedQuery({
    queryKey: ["deals-for-intelligence"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, contact_id, owner_name, status, created_at");
      if (error) throw error;
      return data || [];
    },
  });

  // Contacts for phone→deal linking and owner names
  const { data: contacts, isLoading: loadingContacts } = useDedupedQuery({
    queryKey: ["contacts-for-calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, phone, first_name, last_name, city, location, neighborhood, lifecycle_stage, lead_status, owner_name, latest_traffic_source, call_attempt_count")
        .not("phone", "is", null);
      if (error) throw error;
      return data || [];
    },
  });

  // Full call records for the Calls tab
  const { data: callRecords, isLoading: loadingCalls } = useDedupedQuery({
    queryKey: ["call-records-enriched"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_records")
        .select("id, caller_number, call_status, call_outcome, duration_seconds, call_score, lead_quality, transcription, recording_url, appointment_set, created_at, owner_name, call_type, direction")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Enhanced leads
  const { data: enhancedLeads, isLoading: loadingLeads } = useDedupedQuery({
    queryKey: ["contacts-for-calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("phone, first_name, last_name, attributed_channel, attributed_campaign_id, lifecycle_stage")
        .not("phone", "is", null)
        .neq("status", "MERGED_DUPLICATE");
      if (error) throw error;
      return (data || []).map(c => ({
        ...c,
        lead_score: null as number | null,
        ltv_prediction: null as number | null,
        campaign_name: c.attributed_campaign_id,
        dubai_area: null as string | null,
      }));
    },
  });

  // Lost leads
  const { data: lostLeads, isLoading: loadingLostLeads } = useDedupedQuery({
    queryKey: ["lost-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lost_leads")
        .select("*")
        .order("lead_score", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Setter daily stats
  const { data: setterStats, isLoading: loadingSetterStats } = useDedupedQuery({
    queryKey: ["setter-daily-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("setter_daily_stats")
        .select("*")
        .order("date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = loadingCalls || loadingContacts || loadingLeads;

  // ── Lookup maps ──
  const contactsMap = useMemo(() => {
    const map = new Map<string, (typeof contacts extends (infer T)[] | undefined ? T : never)>();
    contacts?.forEach(c => { if (c.phone) map.set(normalizePhone(c.phone), c); });
    return map;
  }, [contacts]);

  const leadsMap = useMemo(() => {
    const map = new Map<string, (typeof enhancedLeads extends (infer T)[] | undefined ? T : never)>();
    enhancedLeads?.forEach(l => { if (l.phone) map.set(normalizePhone(l.phone), l); });
    return map;
  }, [enhancedLeads]);

  // Contact ID → phone map for deal linking
  const contactIdToPhone = useMemo(() => {
    const map = new Map<string, string>();
    contacts?.forEach(c => { if (c.id && c.phone) map.set(c.id, normalizePhone(c.phone)); });
    return map;
  }, [contacts]);

  // Deal phones set
  const dealPhones = useMemo(() => {
    const s = new Set<string>();
    deals?.forEach(d => {
      if (d.contact_id) {
        const phone = contactIdToPhone.get(d.contact_id);
        if (phone) s.add(phone);
      }
    });
    return s;
  }, [deals, contactIdToPhone]);

  // ── KPI calculations ──
  const kpiData = useMemo(() => {
    const records = intelligenceRecords || [];
    const total = records.length;
    const answered = records.filter(r => r.call_status === "completed" || r.call_status === "answered").length;
    const answeredRecords = records.filter(r => r.call_status === "completed" || r.call_status === "answered");
    const avgDuration = answeredRecords.length > 0
      ? answeredRecords.reduce((s, r) => s + (r.duration_seconds || 0), 0) / answeredRecords.length
      : 0;
    const missed = total - answered;
    // No wait_time column in schema, show 0
    return {
      totalCalls: total,
      answeredRate: total > 0 ? (answered / total) * 100 : 0,
      avgDuration,
      missedCalls: missed,
      avgWaitTime: 0,
    };
  }, [intelligenceRecords]);

  // ── Daily trends ──
  const dailyTrends = useMemo(() => {
    const records = intelligenceRecords || [];
    const byDay = new Map<string, { total: number; answered: number }>();
    records.forEach(r => {
      const date = (r.created_at || "").slice(0, 10);
      if (!date) return;
      const entry = byDay.get(date) || { total: 0, answered: 0 };
      entry.total++;
      if (r.call_status === "completed" || r.call_status === "answered") entry.answered++;
      byDay.set(date, entry);
    });
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        total: d.total,
        answered: d.answered,
        answeredRate: d.total > 0 ? (d.answered / d.total) * 100 : 0,
      }));
  }, [intelligenceRecords]);

  // ── Hourly heatmap ──
  const heatmapData = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
    (intelligenceRecords || []).forEach(r => {
      const dt = r.created_at ? new Date(r.created_at) : null;
      if (!dt) return;
      const dow = (dt.getDay() + 6) % 7; // Mon=0
      const hour = dt.getHours();
      grid[dow][hour]++;
    });
    return grid;
  }, [intelligenceRecords]);

  // ── Owner performance ──
  const ownerPerformance = useMemo(() => {
    const records = intelligenceRecords || [];
    const byOwner = new Map<string, { total: number; answered: number; duration: number; appointments: number }>();
    records.forEach(r => {
      const owner = r.hubspot_owner_id || "Unknown";
      const entry = byOwner.get(owner) || { total: 0, answered: 0, duration: 0, appointments: 0 };
      entry.total++;
      const isAnswered = r.call_status === "completed" || r.call_status === "answered";
      if (isAnswered) {
        entry.answered++;
        entry.duration += r.duration_seconds || 0;
      }
      if (r.appointment_set) entry.appointments++;
      byOwner.set(owner, entry);
    });
    return Array.from(byOwner.entries()).map(([owner, d]) => ({
      owner,
      totalCalls: d.total,
      answered: d.answered,
      missed: d.total - d.answered,
      avgDuration: d.answered > 0 ? d.duration / d.answered : 0,
      conversionRate: d.total > 0 ? (d.appointments / d.total) * 100 : 0,
    }));
  }, [intelligenceRecords]);

  // ── Outcome analysis ──
  const outcomeAnalysis = useMemo(() => {
    const records = intelligenceRecords || [];
    const byOutcome = new Map<string, { count: number; phones: Set<string> }>();
    records.forEach(r => {
      const outcome = r.call_outcome || "Unknown";
      const entry = byOutcome.get(outcome) || { count: 0, phones: new Set<string>() };
      entry.count++;
      if (r.caller_number) entry.phones.add(normalizePhone(r.caller_number));
      byOutcome.set(outcome, entry);
    });
    const total = records.length || 1;
    return Array.from(byOutcome.entries())
      .map(([outcome, d]) => ({
        outcome,
        count: d.count,
        percentage: (d.count / total) * 100,
        dealsLinked: Array.from(d.phones).filter(p => dealPhones.has(p)).length,
      }))
      .sort((a, b) => b.count - a.count);
  }, [intelligenceRecords, dealPhones]);

  // ── Enriched calls for Calls tab ──
  const enrichedCalls = useMemo(() => {
    if (!callRecords) return [];
    return callRecords.map(call => {
      const normalizedPhone = normalizePhone(call.caller_number);
      const contact = contactsMap.get(normalizedPhone);
      const lead = leadsMap.get(normalizedPhone);
      return {
        ...call,
        first_name: contact?.first_name || lead?.first_name || null,
        last_name: contact?.last_name || lead?.last_name || null,
        city: contact?.city || null,
        location: contact?.location || null,
        neighborhood: contact?.neighborhood || null,
        lifecycle_stage: contact?.lifecycle_stage || null,
        lead_status: contact?.lead_status || null,
        owner_name: contact?.owner_name || null,
        latest_traffic_source: contact?.latest_traffic_source || null,
        call_attempt_count: contact?.call_attempt_count || null,
        lead_score: lead?.lead_score || null,
        ltv_prediction: lead?.ltv_prediction || null,
        campaign_name: lead?.campaign_name || null,
        dubai_area: lead?.dubai_area || null,
      };
    });
  }, [callRecords, contactsMap, leadsMap]);

  const enrichedLostLeads = useMemo(() => {
    if (!lostLeads) return [];
    return lostLeads.map(lead => {
      const contact = contactsMap.get(normalizePhone(lead.caller_number));
      return {
        ...lead,
        contact_name: contact ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() : null,
      };
    });
  }, [lostLeads, contactsMap]);

  const setterLeaderboard = useMemo(() => {
    if (!setterStats?.length) return [];
    const latestByOwner = new Map<string, (typeof setterStats)[0]>();
    for (const stat of setterStats) {
      const key = (stat as any).hubspot_owner_id || (stat as any).owner_name;
      if (!latestByOwner.has(key)) latestByOwner.set(key, stat);
    }
    return Array.from(latestByOwner.values()).sort((a, b) => ((b as any).conversion_rate || 0) - ((a as any).conversion_rate || 0));
  }, [setterStats]);

  const uniqueOwners = useMemo(() => {
    const owners = new Set<string>();
    enrichedCalls.forEach(c => { if (c.owner_name) owners.add(c.owner_name); });
    return Array.from(owners).sort();
  }, [enrichedCalls]);

  const uniqueLocations = useMemo(() => {
    const locs = new Set<string>();
    enrichedCalls.forEach(c => { 
      if (c.city) locs.add(c.city);
      if (c.dubai_area) locs.add(c.dubai_area);
    });
    return Array.from(locs).filter(Boolean).sort();
  }, [enrichedCalls]);

  const filteredCalls = useMemo(() => {
    return enrichedCalls.filter(call => {
      if (filters.owner !== 'all' && call.owner_name !== filters.owner) return false;
      if (filters.quality !== 'all') {
        const score = call.lead_score || 0;
        if (filters.quality === 'hot' && score < 80) return false;
        if (filters.quality === 'warm' && (score < 60 || score >= 80)) return false;
        if (filters.quality === 'cold' && score >= 60) return false;
      }
      if (filters.status !== 'all') {
        if (filters.status === 'completed' && call.call_status !== 'completed') return false;
        if (filters.status === 'missed' && !['missed', 'no_answer'].includes(call.call_status)) return false;
        if (filters.status === 'initiated' && call.call_status !== 'initiated') return false;
      }
      if (filters.location !== 'all') {
        if (call.city !== filters.location && call.dubai_area !== filters.location) return false;
      }
      return true;
    });
  }, [enrichedCalls, filters]);

  const getDurationInSeconds = (ms: number | null | undefined) => {
    if (!ms) return 0;
    return ms > 1000 ? Math.round(ms / 1000) : ms;
  };

  const stats = useMemo(() => {
    const calls = filteredCalls;
    const completedCalls = calls.filter(c => c.call_status === "completed");
    const appointmentsSet = calls.filter(c => c.appointment_set).length;
    const hotLeads = calls.filter(c => (c.lead_score || 0) >= 80).length;
    const avgLeadScore = calls.filter(c => c.lead_score).length > 0
      ? Math.round(calls.filter(c => c.lead_score).reduce((sum, c) => sum + (c.lead_score || 0), 0) / calls.filter(c => c.lead_score).length)
      : 0;
    const unworkedLeads = calls.filter(c => !c.call_attempt_count || c.call_attempt_count === 0).length;

    return {
      totalCalls: calls.length,
      completedCalls: completedCalls.length,
      avgDuration: calls.length 
        ? Math.round(calls.reduce((sum, c) => sum + getDurationInSeconds(c.duration_seconds), 0) / calls.length)
        : 0,
      avgScore: calls.filter(c => c.call_score !== null).length
        ? Math.round(calls.filter(c => c.call_score !== null).reduce((sum, c) => sum + (c.call_score || 0), 0) / (calls.filter(c => c.call_score !== null).length || 1))
        : 0,
      appointmentsSet,
      hotLeadsCalled: hotLeads,
      conversionRate: completedCalls.length > 0 ? Math.round((appointmentsSet / completedCalls.length) * 100) : 0,
      avgLeadScore,
      unworkedLeads,
    };
  }, [filteredCalls]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ owner: 'all', quality: 'all', status: 'all', location: 'all' });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with time range */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Call Intelligence</h1>
            <p className="text-muted-foreground">Real-time call analytics & performance insights</p>
          </div>
          <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
        </div>

        {/* KPI Cards */}
        <CallIntelligenceKPIs data={kpiData} isLoading={loadingIntel} />

        {/* Daily Trends + Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DailyTrends data={dailyTrends} isLoading={loadingIntel} />
          <HourlyHeatmap data={heatmapData} isLoading={loadingIntel} />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <CallFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              onClearFilters={handleClearFilters}
              owners={uniqueOwners}
              locations={uniqueLocations}
            />
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="calls" className="space-y-4">
          <TabsList>
            <TabsTrigger value="calls" className="gap-2 cursor-pointer">
              <Phone className="h-4 w-4" /> Calls
              <Badge variant="secondary" className="ml-1">{filteredCalls.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="lost-leads" className="gap-2 cursor-pointer">
              <UserX className="h-4 w-4" /> Lost Leads
              {enrichedLostLeads.filter(l => (l as any).status === 'new').length > 0 && (
                <Badge variant="destructive" className="ml-1">{enrichedLostLeads.filter(l => (l as any).status === 'new').length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-2 cursor-pointer">
              <Trophy className="h-4 w-4" /> Setter Leaderboard
            </TabsTrigger>
            <TabsTrigger value="owner-performance" className="gap-2 cursor-pointer">
              <Users className="h-4 w-4" /> Owner Performance
            </TabsTrigger>
            <TabsTrigger value="outcomes" className="gap-2 cursor-pointer">
              <PieChart className="h-4 w-4" /> Outcomes
            </TabsTrigger>
          </TabsList>

          {/* Calls Tab */}
          <TabsContent value="calls">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Recent Calls
                </h2>
                <Badge variant="outline" className="font-normal">
                  {filteredCalls.length} calls
                </Badge>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => <CallCardSkeleton key={i} />)}
                </div>
              ) : filteredCalls.length > 0 ? (
                <div className="space-y-3">
                  {filteredCalls.slice(0, 50).map((call) => (
                    <CallCard key={call.id} call={call} />
                  ))}
                  {filteredCalls.length > 50 && (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      Showing 50 of {filteredCalls.length} calls
                    </p>
                  )}
                </div>
              ) : (
                <Card className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No call records found</p>
                    {Object.values(filters).some(v => v !== 'all') && (
                      <p className="text-sm mt-1">Try adjusting your filters</p>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Lost Leads Tab */}
          <TabsContent value="lost-leads">
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <UserX className="h-5 w-5 text-red-500" />
                  Lost Leads — Uncontacted Missed Calls
                </h2>
              </div>

              {loadingLostLeads ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <CallCardSkeleton key={i} />)}
                </div>
              ) : enrichedLostLeads.length > 0 ? (
                <div className="space-y-2">
                  {enrichedLostLeads.map((lead: any) => (
                    <Card
                      key={lead.id}
                      className={`cursor-pointer transition-colors duration-200 hover:bg-muted/30 ${lead.status === 'new' ? 'border-red-500/30' : ''}`}
                      onClick={() => { setSelectedLostLead(lead); toast.info(`Viewing lost lead: ${lead.contact_name || lead.caller_number}`); }}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${lead.lead_score >= 70 ? 'bg-red-100 text-red-600' : lead.lead_score >= 40 ? 'bg-orange-100 text-orange-600' : 'bg-yellow-100 text-yellow-600'}`}>
                              <PhoneMissed className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium">{lead.contact_name || lead.caller_number}</p>
                              {lead.contact_name && <p className="text-sm text-muted-foreground">{lead.caller_number}</p>}
                              <div className="flex gap-2 mt-1">
                                {lead.lifecycle_stage && <Badge variant="outline" className="text-xs">{lead.lifecycle_stage}</Badge>}
                                <Badge variant={lead.status === 'new' ? 'destructive' : lead.status === 'contacted' ? 'default' : 'secondary'} className="text-xs">{lead.status}</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Score</span>
                              <span className={`text-lg font-bold ${lead.lead_score >= 70 ? 'text-red-600' : lead.lead_score >= 40 ? 'text-orange-500' : 'text-yellow-500'}`}>
                                {Math.round(lead.lead_score)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{lead.missed_call_count} missed call{lead.missed_call_count !== 1 ? 's' : ''}</p>
                            {lead.assigned_owner && <p className="text-xs text-muted-foreground">Owner: {lead.assigned_owner}</p>}
                            {lead.last_missed_at && <p className="text-xs text-muted-foreground">Last: {new Date(lead.last_missed_at).toLocaleString()}</p>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="py-12">
                  <div className="text-center text-muted-foreground">
                    <PhoneMissed className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No lost leads detected</p>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Setter Leaderboard Tab */}
          <TabsContent value="leaderboard">
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Setter Performance Leaderboard
                </h2>
              </div>

              {loadingSetterStats ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <CallCardSkeleton key={i} />)}
                </div>
              ) : setterLeaderboard.length > 0 ? (
                <div className="grid gap-3">
                  {setterLeaderboard.map((setter: any, idx: number) => (
                    <Card
                      key={setter.id}
                      className={`cursor-pointer transition-colors duration-200 hover:bg-muted/30 ${idx === 0 ? 'border-yellow-500/50' : ''}`}
                      onClick={() => { setSelectedSetter(setter); toast.info(`Viewing setter: ${setter.owner_name || 'Unknown'}`); }}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                              idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                              idx === 1 ? 'bg-gray-100 text-gray-600' :
                              idx === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {idx + 1}
                            </div>
                            <div>
                              <p className="font-medium">{setter.owner_name || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground">{setter.date}</p>
                            </div>
                          </div>
                          <div className="flex gap-6 text-center">
                            <div>
                              <p className="text-lg font-bold">{setter.total_calls}</p>
                              <p className="text-xs text-muted-foreground">Calls</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold text-green-600">
                                {setter.total_calls > 0 ? Math.round((setter.answered_calls / setter.total_calls) * 100) : 0}%
                              </p>
                              <p className="text-xs text-muted-foreground">Answer Rate</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold">
                                {Math.floor((setter.avg_duration || 0) / 60)}:{String(Math.round((setter.avg_duration || 0) % 60)).padStart(2, '0')}
                              </p>
                              <p className="text-xs text-muted-foreground">Avg Duration</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold text-purple-600">{setter.appointments_set}</p>
                              <p className="text-xs text-muted-foreground">Appointments</p>
                            </div>
                            <div>
                              <p className={`text-lg font-bold ${(setter.conversion_rate || 0) >= 20 ? 'text-green-600' : (setter.conversion_rate || 0) >= 10 ? 'text-yellow-600' : 'text-red-500'}`}>
                                {setter.conversion_rate || 0}%
                              </p>
                              <p className="text-xs text-muted-foreground">Conversion</p>
                            </div>
                            <div>
                              <p className="text-lg font-bold text-red-500">{setter.lost_lead_count}</p>
                              <p className="text-xs text-muted-foreground">Lost Leads</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No setter performance data yet</p>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Owner Performance Tab */}
          <TabsContent value="owner-performance">
            <OwnerPerformance data={ownerPerformance} isLoading={loadingIntel} />
          </TabsContent>

          {/* Outcome Analysis Tab */}
          <TabsContent value="outcomes">
            <OutcomeAnalysis data={outcomeAnalysis} isLoading={loadingIntel} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Lost Lead Detail Dialog */}
      <Dialog open={!!selectedLostLead} onOpenChange={(open) => !open && setSelectedLostLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PhoneMissed className="h-5 w-5 text-red-500" />
              Lost Lead Detail
            </DialogTitle>
          </DialogHeader>
          {selectedLostLead && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold">{selectedLostLead.contact_name || selectedLostLead.caller_number}</p>
                  {selectedLostLead.contact_name && (
                    <p className="text-sm text-muted-foreground font-mono">{selectedLostLead.caller_number}</p>
                  )}
                </div>
                <Badge variant={selectedLostLead.status === 'new' ? 'destructive' : 'secondary'}>
                  {selectedLostLead.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Lead Score</p>
                  <p className={`text-2xl font-bold ${selectedLostLead.lead_score >= 70 ? 'text-red-500' : selectedLostLead.lead_score >= 40 ? 'text-orange-500' : 'text-yellow-500'}`}>
                    {Math.round(selectedLostLead.lead_score)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Missed Calls</p>
                  <p className="text-2xl font-bold">{selectedLostLead.missed_call_count}</p>
                </div>
              </div>
              {selectedLostLead.lifecycle_stage && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Lifecycle Stage</p>
                  <Badge variant="outline">{selectedLostLead.lifecycle_stage}</Badge>
                </div>
              )}
              {selectedLostLead.assigned_owner && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Assigned Owner</p>
                  <p className="font-medium">{selectedLostLead.assigned_owner}</p>
                </div>
              )}
              {selectedLostLead.last_missed_at && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Last Missed Call</p>
                  <p className="font-medium">{new Date(selectedLostLead.last_missed_at).toLocaleString()}</p>
                </div>
              )}
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <p className="text-xs text-red-400 mb-1">⚠️ Action Required</p>
                <p className="text-sm font-medium">
                  {selectedLostLead.lead_score >= 70
                    ? "High-value lead — call back within 5 minutes"
                    : selectedLostLead.lead_score >= 40
                    ? "Warm lead — follow up within 1 hour"
                    : "Schedule a callback within 24 hours"}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Setter Detail Dialog */}
      <Dialog open={!!selectedSetter} onOpenChange={(open) => !open && setSelectedSetter(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-yellow-500" />
              {selectedSetter?.owner_name || 'Unknown'} — Performance
            </DialogTitle>
          </DialogHeader>
          {selectedSetter && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Total Calls</p>
                  <p className="text-2xl font-bold">{selectedSetter.total_calls}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Answered</p>
                  <p className="text-2xl font-bold">{selectedSetter.answered_calls}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Answer Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {selectedSetter.total_calls > 0 ? Math.round((selectedSetter.answered_calls / selectedSetter.total_calls) * 100) : 0}%
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Avg Duration</p>
                  <p className="text-2xl font-bold">
                    {Math.floor((selectedSetter.avg_duration || 0) / 60)}:{String(Math.round((selectedSetter.avg_duration || 0) % 60)).padStart(2, '0')}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Appointments Set</p>
                  <p className="text-2xl font-bold text-purple-600">{selectedSetter.appointments_set}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Conversion Rate</p>
                  <p className={`text-2xl font-bold ${(selectedSetter.conversion_rate || 0) >= 20 ? 'text-green-600' : (selectedSetter.conversion_rate || 0) >= 10 ? 'text-yellow-600' : 'text-red-500'}`}>
                    {selectedSetter.conversion_rate || 0}%
                  </p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Lost Leads</p>
                <p className="text-2xl font-bold text-red-500">{selectedSetter.lost_lead_count}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Report Date</p>
                <p className="font-medium">{selectedSetter.date}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
