import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Phone, PhoneIncoming, Clock, Star, Calendar, TrendingUp, 
  Flame, Users, AlertTriangle, Trophy, PhoneMissed, UserX
} from "lucide-react";
import { CallCard } from "@/components/call-tracking/CallCard";
import { CallFilters } from "@/components/call-tracking/CallFilters";
import { CallCardSkeleton } from "@/components/call-tracking/CallCardSkeleton";
import { useDedupedQuery } from "@/hooks/useDedupedQuery";
import { EmptyState } from "@/components/ui/empty-state";
import { useAnnounce } from "@/lib/accessibility";

// Normalize phone number for comparison (remove all non-digits)
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

  // Fetch call records
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

  // Fetch contacts for enrichment
  const { data: contacts, isLoading: loadingContacts } = useDedupedQuery({
    queryKey: ["contacts-for-calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("phone, first_name, last_name, city, location, neighborhood, lifecycle_stage, lead_status, owner_name, latest_traffic_source, call_attempt_count")
        .not("phone", "is", null);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch contacts for additional lead data
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
        lead_score: null,
        ltv_prediction: null,
        campaign_name: c.attributed_campaign_id,
        dubai_area: null,
      }));
    },
  });

  // Fetch lost leads
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

  // Fetch setter daily stats
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

  // Create lookup maps for fast joining
  const contactsMap = useMemo(() => {
    const map = new Map<string, typeof contacts[0]>();
    contacts?.forEach(c => {
      if (c.phone) map.set(normalizePhone(c.phone), c);
    });
    return map;
  }, [contacts]);

  const leadsMap = useMemo(() => {
    const map = new Map<string, typeof enhancedLeads[0]>();
    enhancedLeads?.forEach(l => {
      if (l.phone) map.set(normalizePhone(l.phone), l);
    });
    return map;
  }, [enhancedLeads]);

  // Enrich call records with contact and lead data
  const enrichedCalls = useMemo(() => {
    if (!callRecords) return [];
    
    return callRecords.map(call => {
      const normalizedPhone = normalizePhone(call.caller_number);
      const contact = contactsMap.get(normalizedPhone);
      const lead = leadsMap.get(normalizedPhone);

      return {
        ...call,
        // Contact data
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
        // Lead data
        lead_score: lead?.lead_score || null,
        ltv_prediction: lead?.ltv_prediction || null,
        campaign_name: lead?.campaign_name || null,
        dubai_area: lead?.dubai_area || null,
      };
    });
  }, [callRecords, contactsMap, leadsMap]);

  // Enrich lost leads with contact names
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

  // Get latest stats per setter for leaderboard
  const setterLeaderboard = useMemo(() => {
    if (!setterStats?.length) return [];
    const latestByOwner = new Map<string, typeof setterStats[0]>();
    for (const stat of setterStats) {
      const key = stat.hubspot_owner_id || stat.owner_name;
      if (!latestByOwner.has(key)) latestByOwner.set(key, stat);
    }
    return Array.from(latestByOwner.values()).sort((a, b) => (b.conversion_rate || 0) - (a.conversion_rate || 0));
  }, [setterStats]);

  // Get unique owners and locations for filters
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

  // Apply filters
  const filteredCalls = useMemo(() => {
    return enrichedCalls.filter(call => {
      // Owner filter
      if (filters.owner !== 'all' && call.owner_name !== filters.owner) return false;
      
      // Quality filter
      if (filters.quality !== 'all') {
        const score = call.lead_score || 0;
        if (filters.quality === 'hot' && score < 80) return false;
        if (filters.quality === 'warm' && (score < 60 || score >= 80)) return false;
        if (filters.quality === 'cold' && score >= 60) return false;
      }
      
      // Status filter
      if (filters.status !== 'all') {
        if (filters.status === 'completed' && call.call_status !== 'completed') return false;
        if (filters.status === 'missed' && !['missed', 'no_answer'].includes(call.call_status)) return false;
        if (filters.status === 'initiated' && call.call_status !== 'initiated') return false;
      }
      
      // Location filter
      if (filters.location !== 'all') {
        if (call.city !== filters.location && call.dubai_area !== filters.location) return false;
      }
      
      return true;
    });
  }, [enrichedCalls, filters]);

  // Calculate stats
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
        <div>
          <h1 className="text-3xl font-bold text-foreground">Call Tracking</h1>
          <p className="text-muted-foreground">Monitor call performance with enriched lead data</p>
        </div>

        {/* Stats Grid - Enhanced */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Phone className="h-6 w-6 text-primary" />
                <div>
                  <p className="text-xl font-bold">{stats.totalCalls}</p>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <PhoneIncoming className="h-6 w-6 text-green-500" />
                <div>
                  <p className="text-xl font-bold">{stats.completedCalls}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-6 w-6 text-blue-500" />
                <div>
                  <p className="text-xl font-bold">{Math.floor(stats.avgDuration / 60)}:{String(stats.avgDuration % 60).padStart(2, '0')}</p>
                  <p className="text-xs text-muted-foreground">Avg Duration</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Star className="h-6 w-6 text-yellow-500" />
                <div>
                  <p className="text-xl font-bold">{stats.avgScore}</p>
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-6 w-6 text-purple-500" />
                <div>
                  <p className="text-xl font-bold">{stats.appointmentsSet}</p>
                  <p className="text-xs text-muted-foreground">Appointments</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Flame className="h-6 w-6 text-orange-500" />
                <div>
                  <p className="text-xl font-bold">{stats.hotLeadsCalled}</p>
                  <p className="text-xs text-muted-foreground">Hot Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-emerald-500" />
                <div>
                  <p className="text-xl font-bold">{stats.conversionRate}%</p>
                  <p className="text-xs text-muted-foreground">Conversion</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-sky-500" />
                <div>
                  <p className="text-xl font-bold">{stats.avgLeadScore}</p>
                  <p className="text-xs text-muted-foreground">Avg Lead Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-500/30">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
                <div>
                  <p className="text-xl font-bold text-orange-500">{stats.unworkedLeads}</p>
                  <p className="text-xs text-muted-foreground">Unworked</p>
                </div>
              </div>
            </CardContent>
          </Card>
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

        {/* Tabs: Calls / Lost Leads / Setter Leaderboard */}
        <Tabs defaultValue="calls" className="space-y-4">
          <TabsList>
            <TabsTrigger value="calls" className="gap-2">
              <Phone className="h-4 w-4" /> Calls
              <Badge variant="secondary" className="ml-1">{filteredCalls.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="lost-leads" className="gap-2">
              <UserX className="h-4 w-4" /> Lost Leads
              {enrichedLostLeads.filter(l => l.status === 'new').length > 0 && (
                <Badge variant="destructive" className="ml-1">{enrichedLostLeads.filter(l => l.status === 'new').length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="gap-2">
              <Trophy className="h-4 w-4" /> Setter Leaderboard
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
                  {[...Array(5)].map((_, i) => (
                    <CallCardSkeleton key={i} />
                  ))}
                </div>
              ) : filteredCalls.length > 0 ? (
                <div className="space-y-3">
                  {filteredCalls.map((call) => (
                    <CallCard key={call.id} call={call} />
                  ))}
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
                  {[...Array(3)].map((_, i) => (
                    <CallCardSkeleton key={i} />
                  ))}
                </div>
              ) : enrichedLostLeads.length > 0 ? (
                <div className="space-y-2">
                  {enrichedLostLeads.map((lead) => (
                    <Card key={lead.id} className={lead.status === 'new' ? 'border-red-500/30' : ''}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${lead.lead_score >= 70 ? 'bg-red-100 text-red-600' : lead.lead_score >= 40 ? 'bg-orange-100 text-orange-600' : 'bg-yellow-100 text-yellow-600'}`}>
                              <PhoneMissed className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {lead.contact_name || lead.caller_number}
                              </p>
                              {lead.contact_name && (
                                <p className="text-sm text-muted-foreground">{lead.caller_number}</p>
                              )}
                              <div className="flex gap-2 mt-1">
                                {lead.lifecycle_stage && (
                                  <Badge variant="outline" className="text-xs">{lead.lifecycle_stage}</Badge>
                                )}
                                <Badge variant={lead.status === 'new' ? 'destructive' : lead.status === 'contacted' ? 'default' : 'secondary'} className="text-xs">
                                  {lead.status}
                                </Badge>
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
                            <p className="text-sm text-muted-foreground">
                              {lead.missed_call_count} missed call{lead.missed_call_count !== 1 ? 's' : ''}
                            </p>
                            {lead.assigned_owner && (
                              <p className="text-xs text-muted-foreground">Owner: {lead.assigned_owner}</p>
                            )}
                            {lead.last_missed_at && (
                              <p className="text-xs text-muted-foreground">
                                Last: {new Date(lead.last_missed_at).toLocaleString()}
                              </p>
                            )}
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
                    <p className="text-sm mt-1">Run the lost-lead-detector to scan for missed calls</p>
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
                  {[...Array(3)].map((_, i) => (
                    <CallCardSkeleton key={i} />
                  ))}
                </div>
              ) : setterLeaderboard.length > 0 ? (
                <div className="grid gap-3">
                  {setterLeaderboard.map((setter, idx) => (
                    <Card key={setter.id} className={idx === 0 ? 'border-yellow-500/50' : ''}>
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
                    <p className="text-sm mt-1">Run the setter-performance function to generate stats</p>
                  </div>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}