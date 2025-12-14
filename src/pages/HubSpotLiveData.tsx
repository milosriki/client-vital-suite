import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  RefreshCw, Activity, Users, Phone, Calendar, DollarSign, 
  TrendingUp, Target, AlertTriangle, CheckCircle, Clock, Zap,
  BarChart3, ArrowUpRight, ArrowDownRight, Trash2
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay, startOfMonth, subMonths, isToday, isYesterday } from "date-fns";
import { toast } from "sonner";

// KPI Formulas
const calculateConversionRate = (converted: number, total: number) => 
  total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";

const calculateConnectRate = (answered: number, total: number) => 
  total > 0 ? ((answered / total) * 100).toFixed(1) : "0.0";

const calculateAvgDealValue = (totalValue: number, dealCount: number) =>
  dealCount > 0 ? (totalValue / dealCount).toFixed(0) : "0";

const calculateRevenuePerLead = (revenue: number, leads: number) =>
  leads > 0 ? (revenue / leads).toFixed(0) : "0";

// Map HubSpot contact lifecycle to lead status
const mapContactToLeadStatus = (contact: any): string => {
  const lifecycle = contact.lifecycle_stage?.toLowerCase();
  const leadStatus = contact.lead_status?.toLowerCase();
  
  if (lifecycle === 'customer' || leadStatus === 'closed_won') return 'closed';
  if (leadStatus === 'appointment_scheduled' || leadStatus === 'appointment_set') return 'appointment_set';
  if (leadStatus === 'no_show') return 'no_show';
  if (lifecycle === 'opportunity' || lifecycle === 'salesqualifiedlead') return 'pitch_given';
  if (leadStatus === 'in_progress' || leadStatus === 'contacted') return 'follow_up';
  return 'new';
};

const HubSpotLiveData = () => {
  const [timeframe, setTimeframe] = useState("all_time");
  const [selectedSetter, setSelectedSetter] = useState("all");

  // Calculate date range
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end = endOfDay(now);

    switch (timeframe) {
      case "today":
        start = startOfDay(now);
        break;
      case "yesterday":
        start = startOfDay(subDays(now, 1));
        end = endOfDay(subDays(now, 1));
        break;
      case "this_month":
        start = startOfMonth(now);
        break;
      case "last_month":
        start = startOfMonth(subMonths(now, 1));
        end = endOfDay(subDays(startOfMonth(now), 1));
        break;
      case "last_7_days":
        start = startOfDay(subDays(now, 7));
        break;
      case "all_time":
      default:
        start = new Date(2020, 0, 1); // Far back in time to get all data
    }
    return { start, end };
  }, [timeframe]);

  // Fetch leads from Supabase (HubSpot stores leads as contacts)
  const { data: leadsData, isLoading: loadingLeads, refetch: refetchLeads } = useQuery({
    queryKey: ["db-leads", timeframe],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Map contacts to lead format for consistency
      return (data || []).map(contact => ({
        ...contact,
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
        status: mapContactToLeadStatus(contact),
        source: contact.latest_traffic_source || contact.first_touch_source || 'direct',
        score: contact.total_value ? Math.min(100, Math.round(contact.total_value / 100)) : 50
      }));
    },
  });

  // Fetch enhanced leads
  const { data: enhancedLeadsData, isLoading: loadingEnhanced, refetch: refetchEnhanced } = useQuery({
    queryKey: ["db-enhanced-leads", timeframe],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enhanced_leads")
        .select("*")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch deals from Supabase (for selected timeframe)
  const { data: dealsData, isLoading: loadingDeals, refetch: refetchDeals } = useQuery({
    queryKey: ["db-deals", timeframe],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch deals for current month (for revenue calculation - always from 1st of month)
  const monthStart = useMemo(() => startOfMonth(new Date()), []);
  const { data: monthlyDealsData, refetch: refetchMonthlyDeals } = useQuery({
    queryKey: ["db-deals-monthly"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .gte("created_at", monthStart.toISOString())
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch call records
  const { data: callsData, isLoading: loadingCalls, refetch: refetchCalls } = useQuery({
    queryKey: ["db-calls", timeframe],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_records")
        .select("*")
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString())
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch staff for setter mapping
  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  // All leads combined
  const allLeads = useMemo(() => {
    const combined = [
      ...(leadsData || []).map(l => ({ 
        ...l, 
        source_type: 'leads',
        display_name: l.name || `${l.first_name || ''} ${l.last_name || ''}`.trim() || 'Unknown',
        lead_quality: l.score ? (l.score > 70 ? 'high' : l.score > 40 ? 'medium' : 'low') : 'pending'
      })),
      ...(enhancedLeadsData || []).map(l => ({ 
        ...l, 
        source_type: 'enhanced',
        display_name: `${l.first_name || ''} ${l.last_name || ''}`.trim() || 'Unknown',
      }))
    ];
    return combined;
  }, [leadsData, enhancedLeadsData]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const leads = allLeads;
    const deals = dealsData || [];
    const calls = callsData || [];
    const monthlyDeals = monthlyDealsData || [];

    // Lead stats
    const totalLeads = leads.length;
    const newLeads = leads.filter((l: any) => l.status === 'new').length;
    const appointmentSet = leads.filter((l: any) => l.status === 'appointment_set').length;
    const closedLeads = leads.filter((l: any) => l.status === 'closed').length;
    const highQualityLeads = leads.filter((l: any) => l.lead_quality === 'high' || l.lead_quality === 'premium').length;

    // Deal stats (for selected timeframe)
    const totalDeals = deals.length;
    const closedDeals = deals.filter(d => d.status === 'closed').length;
    const totalDealValue = deals.reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0);
    
    // Revenue always from first of the month (using monthlyDeals)
    const monthlyClosedDealValue = monthlyDeals.filter(d => d.status === 'closed')
      .reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0);
    const monthlyCashCollected = monthlyDeals.reduce((sum, d) => sum + (Number(d.cash_collected) || 0), 0);

    // Call stats
    const totalCalls = calls.length;
    const completedCalls = calls.filter(c => c.call_status === 'completed').length;
    const totalDuration = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    const avgDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    const appointmentsFromCalls = calls.filter(c => c.appointment_set).length;

    // Formulas (revenue uses monthly data)
    const conversionRate = calculateConversionRate(closedLeads, totalLeads);
    const connectRate = calculateConnectRate(completedCalls, totalCalls);
    const avgDealValue = calculateAvgDealValue(monthlyClosedDealValue, monthlyDeals.filter(d => d.status === 'closed').length);
    const revenuePerLead = calculateRevenuePerLead(monthlyClosedDealValue, totalLeads);
    const appointmentRate = calculateConversionRate(appointmentSet, totalLeads);
    const closeRate = calculateConversionRate(closedDeals, totalDeals);

    return {
      totalLeads,
      newLeads,
      appointmentSet,
      closedLeads,
      highQualityLeads,
      totalDeals,
      closedDeals,
      totalDealValue,
      closedDealValue: monthlyClosedDealValue, // Now always from 1st of month
      cashCollected: monthlyCashCollected, // Now always from 1st of month
      totalCalls,
      completedCalls,
      totalDuration,
      avgDuration,
      appointmentsFromCalls,
      conversionRate,
      connectRate,
      avgDealValue,
      revenuePerLead,
      appointmentRate,
      closeRate,
    };
  }, [allLeads, dealsData, callsData, monthlyDealsData]);

  // Staff lookup
  const getStaffName = (id: string | null) => {
    if (!id || !staffData) return 'Unassigned';
    const staff = staffData.find(s => s.id === id);
    return staff?.name || 'Unknown';
  };

  const handleRefresh = async () => {
    toast.info("Refreshing data from database...");
    await Promise.all([refetchLeads(), refetchEnhanced(), refetchDeals(), refetchCalls(), refetchMonthlyDeals()]);
    toast.success("Data refreshed!");
  };

  const handleClearFakeData = async () => {
    if (!confirm('This will delete all test/fake data (emails ending with @email.com or @example.com) and sync fresh data from HubSpot. Continue?')) {
      return;
    }
    toast.info("Clearing fake data and syncing from HubSpot...");
    try {
      const { data, error } = await supabase.functions.invoke('sync-hubspot-to-supabase', {
        body: { clear_fake_data: true, sync_type: 'all' }
      });
      if (error) throw error;
      toast.success(`Synced ${data.contacts_synced} contacts, ${data.leads_synced} leads, ${data.deals_synced} deals`);
      await Promise.all([refetchLeads(), refetchEnhanced(), refetchDeals(), refetchCalls(), refetchMonthlyDeals()]);
    } catch (err: any) {
      toast.error('Sync failed: ' + err.message);
    }
  };

  const isLoading = loadingLeads || loadingEnhanced || loadingDeals || loadingCalls;

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'closed':
      case 'completed':
        return 'default';
      case 'appointment_set':
      case 'pitch_given':
        return 'secondary';
      case 'new':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getQualityColor = (quality: string) => {
    switch (quality?.toLowerCase()) {
      case 'high':
      case 'premium':
        return 'text-green-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            HubSpot Live Dashboard
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Real-time metrics from your database • Formula-driven KPIs
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={handleRefresh} disabled={isLoading} className="w-full sm:w-auto">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="destructive" onClick={handleClearFakeData} disabled={isLoading} className="w-full sm:w-auto">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Fake & Sync
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={timeframe} onValueChange={setTimeframe}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_time">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="last_7_days">Last 7 Days</SelectItem>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Formula Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalLeads}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-green-500">{kpis.highQualityLeads} high quality</span>
              <span>•</span>
              <span>{kpis.newLeads} new</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.conversionRate}%</div>
            <div className="text-xs text-muted-foreground">
              Formula: (Closed ÷ Total Leads) × 100
            </div>
            <Progress value={parseFloat(kpis.conversionRate)} className="h-1 mt-2" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalCalls}</div>
            <div className="text-xs text-muted-foreground">
              {kpis.connectRate}% connect rate • {Math.floor(kpis.avgDuration / 60)}m avg
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {kpis.closedDealValue.toLocaleString()} AED
            </div>
            <div className="text-xs text-muted-foreground">
              {kpis.cashCollected.toLocaleString()} AED collected
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Appointment Rate</p>
                <p className="text-xl font-bold">{kpis.appointmentRate}%</p>
              </div>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.appointmentSet} appointments set
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Close Rate</p>
                <p className="text-xl font-bold">{kpis.closeRate}%</p>
              </div>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.closedDeals} of {kpis.totalDeals} deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Avg Deal Value</p>
                <p className="text-xl font-bold">{Number(kpis.avgDealValue).toLocaleString()} AED</p>
              </div>
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue ÷ Closed Deals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Revenue per Lead</p>
                <p className="text-xl font-bold">{Number(kpis.revenuePerLead).toLocaleString()} AED</p>
              </div>
              <Zap className="h-5 w-5 text-amber-500" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total Revenue ÷ Total Leads
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="leads">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
          <TabsTrigger value="leads" className="text-xs sm:text-sm">📋 Leads ({kpis.totalLeads})</TabsTrigger>
          <TabsTrigger value="calls" className="text-xs sm:text-sm">📞 Calls ({kpis.totalCalls})</TabsTrigger>
          <TabsTrigger value="deals" className="text-xs sm:text-sm">💰 Deals ({kpis.totalDeals})</TabsTrigger>
          <TabsTrigger value="formulas" className="text-xs sm:text-sm">📊 Formulas</TabsTrigger>
        </TabsList>

        {/* Leads Tab */}
        <TabsContent value="leads">
          <Card>
            <CardHeader>
              <CardTitle>Leads from Database</CardTitle>
              <CardDescription>
                Combined leads + enhanced_leads • {allLeads.length} total
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : allLeads.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">Name</TableHead>
                        <TableHead className="min-w-[180px]">Email</TableHead>
                        <TableHead className="min-w-[120px]">Phone</TableHead>
                        <TableHead className="min-w-[100px]">Source</TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                        <TableHead className="min-w-[80px]">Quality</TableHead>
                        <TableHead className="min-w-[120px]">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {allLeads.slice(0, 50).map((lead: any) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.display_name}</TableCell>
                        <TableCell className="text-sm">{lead.email || '-'}</TableCell>
                        <TableCell className="text-sm">{lead.phone || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {lead.source || lead.source_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(lead.status)}>
                            {lead.status || 'new'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${getQualityColor(lead.lead_quality)}`}>
                            {lead.lead_quality || 'pending'}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {lead.created_at ? format(new Date(lead.created_at), 'MMM dd, HH:mm') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <Alert>
                  <AlertTitle>No Leads Found</AlertTitle>
                  <AlertDescription>No leads for the selected timeframe.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calls Tab */}
        <TabsContent value="calls">
          <Card>
            <CardHeader>
              <CardTitle>Call Records</CardTitle>
              <CardDescription>
                From call_records table • {kpis.completedCalls} completed of {kpis.totalCalls}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingCalls ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (callsData || []).length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[80px]">Time</TableHead>
                        <TableHead className="min-w-[100px]">Direction</TableHead>
                        <TableHead className="min-w-[120px]">Caller</TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                        <TableHead className="min-w-[100px]">Duration</TableHead>
                        <TableHead className="min-w-[80px]">Score</TableHead>
                        <TableHead className="min-w-[100px]">Appointment</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {(callsData || []).map((call: any) => (
                      <TableRow key={call.id}>
                        <TableCell className="text-sm">
                          {call.created_at ? format(new Date(call.created_at), 'HH:mm') : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {call.call_direction || 'inbound'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{call.caller_number}</TableCell>
                        <TableCell>
                          <Badge variant={call.call_status === 'completed' ? 'default' : 'secondary'}>
                            {call.call_status}
                          </Badge>
                        </TableCell>
                        <TableCell>{call.duration_seconds ? `${call.duration_seconds}s` : '-'}</TableCell>
                        <TableCell>
                          <span className={call.call_score >= 70 ? 'text-green-500' : 'text-muted-foreground'}>
                            {call.call_score || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {call.appointment_set ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <Alert>
                  <AlertTitle>No Calls Found</AlertTitle>
                  <AlertDescription>No call records for the selected timeframe.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deals Tab */}
        <TabsContent value="deals">
          <Card>
            <CardHeader>
              <CardTitle>Deals Pipeline</CardTitle>
              <CardDescription>
                From deals table • {kpis.closedDealValue.toLocaleString()} AED total value
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingDeals ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : (dealsData || []).length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">Deal</TableHead>
                        <TableHead className="min-w-[120px]">Value</TableHead>
                        <TableHead className="min-w-[120px]">Cash Collected</TableHead>
                        <TableHead className="min-w-[100px]">Status</TableHead>
                        <TableHead className="min-w-[120px]">Closer</TableHead>
                        <TableHead className="min-w-[120px]">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {(dealsData || []).map((deal: any) => (
                      <TableRow key={deal.id}>
                        <TableCell className="font-medium">
                          {deal.deal_name || `Deal ${deal.id.slice(0, 8)}`}
                        </TableCell>
                        <TableCell className="font-bold text-green-500">
                          {Number(deal.deal_value || 0).toLocaleString()} AED
                        </TableCell>
                        <TableCell>
                          {Number(deal.cash_collected || 0).toLocaleString()} AED
                        </TableCell>
                        <TableCell>
                          <Badge variant={deal.status === 'closed' ? 'default' : 'secondary'}>
                            {deal.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStaffName(deal.closer_id)}</TableCell>
                        <TableCell className="text-sm">
                          {deal.created_at ? format(new Date(deal.created_at), 'MMM dd, yyyy') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              ) : (
                <Alert>
                  <AlertTitle>No Deals Found</AlertTitle>
                  <AlertDescription>No deals for the selected timeframe.</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Formulas Tab */}
        <TabsContent value="formulas">
          <Card>
            <CardHeader>
              <CardTitle>KPI Formulas Reference</CardTitle>
              <CardDescription>How metrics are calculated</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border bg-muted/50">
                  <h4 className="font-semibold mb-2">Conversion Rate</h4>
                  <code className="text-sm bg-background px-2 py-1 rounded">
                    (Closed Leads ÷ Total Leads) × 100
                  </code>
                  <p className="text-sm text-muted-foreground mt-2">
                    Current: {kpis.closedLeads} ÷ {kpis.totalLeads} = <strong>{kpis.conversionRate}%</strong>
                  </p>
                </div>

                <div className="p-4 rounded-lg border bg-muted/50">
                  <h4 className="font-semibold mb-2">Connect Rate</h4>
                  <code className="text-sm bg-background px-2 py-1 rounded">
                    (Completed Calls ÷ Total Calls) × 100
                  </code>
                  <p className="text-sm text-muted-foreground mt-2">
                    Current: {kpis.completedCalls} ÷ {kpis.totalCalls} = <strong>{kpis.connectRate}%</strong>
                  </p>
                </div>

                <div className="p-4 rounded-lg border bg-muted/50">
                  <h4 className="font-semibold mb-2">Average Deal Value</h4>
                  <code className="text-sm bg-background px-2 py-1 rounded">
                    Closed Deal Revenue ÷ Closed Deals Count
                  </code>
                  <p className="text-sm text-muted-foreground mt-2">
                    Current: {kpis.closedDealValue.toLocaleString()} ÷ {kpis.closedDeals} = <strong>{Number(kpis.avgDealValue).toLocaleString()} AED</strong>
                  </p>
                </div>

                <div className="p-4 rounded-lg border bg-muted/50">
                  <h4 className="font-semibold mb-2">Revenue per Lead</h4>
                  <code className="text-sm bg-background px-2 py-1 rounded">
                    Total Revenue ÷ Total Leads
                  </code>
                  <p className="text-sm text-muted-foreground mt-2">
                    Current: {kpis.closedDealValue.toLocaleString()} ÷ {kpis.totalLeads} = <strong>{Number(kpis.revenuePerLead).toLocaleString()} AED</strong>
                  </p>
                </div>

                <div className="p-4 rounded-lg border bg-muted/50">
                  <h4 className="font-semibold mb-2">Appointment Rate</h4>
                  <code className="text-sm bg-background px-2 py-1 rounded">
                    (Appointments Set ÷ Total Leads) × 100
                  </code>
                  <p className="text-sm text-muted-foreground mt-2">
                    Current: {kpis.appointmentSet} ÷ {kpis.totalLeads} = <strong>{kpis.appointmentRate}%</strong>
                  </p>
                </div>

                <div className="p-4 rounded-lg border bg-muted/50">
                  <h4 className="font-semibold mb-2">Close Rate</h4>
                  <code className="text-sm bg-background px-2 py-1 rounded">
                    (Closed Deals ÷ Total Deals) × 100
                  </code>
                  <p className="text-sm text-muted-foreground mt-2">
                    Current: {kpis.closedDeals} ÷ {kpis.totalDeals} = <strong>{kpis.closeRate}%</strong>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Data Source Info */}
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertTitle>Database-Backed Dashboard</AlertTitle>
        <AlertDescription>
          Data from: leads ({leadsData?.length || 0}), enhanced_leads ({enhancedLeadsData?.length || 0}), 
          deals ({dealsData?.length || 0}), call_records ({callsData?.length || 0}).
          Timeframe: {format(dateRange.start, 'MMM dd')} - {format(dateRange.end, 'MMM dd, yyyy')}
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default HubSpotLiveData;
