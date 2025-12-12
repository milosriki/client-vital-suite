import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Users, 
  DollarSign,
  Calendar, 
  TrendingUp, 
  Target,
  Phone,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  PhoneCall,
  PhoneOff,
  PhoneMissed,
  UserCheck,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Trash2,
  FileText,
  Play,
  ExternalLink
} from "lucide-react";
import { format, subDays } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STATUS_CONFIG = {
  new: { label: "New Leads", color: "bg-blue-500", icon: Users },
  follow_up: { label: "Follow Up", color: "bg-amber-500", icon: Phone },
  appointment_set: { label: "Appointment Set", color: "bg-purple-500", icon: Calendar },
  pitch_given: { label: "Pitch Given", color: "bg-cyan-500", icon: Target },
  no_show: { label: "No Show", color: "bg-red-500", icon: XCircle },
  closed: { label: "Closed", color: "bg-green-500", icon: CheckCircle },
};

const CALL_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  initiated: { label: "Initiated", color: "bg-gray-500", icon: Phone },
  ringing: { label: "Ringing", color: "bg-blue-500", icon: PhoneCall },
  answered: { label: "Answered", color: "bg-green-500", icon: PhoneCall },
  completed: { label: "Completed", color: "bg-green-600", icon: CheckCircle },
  missed: { label: "Missed", color: "bg-red-500", icon: PhoneMissed },
  voicemail: { label: "Voicemail", color: "bg-amber-500", icon: PhoneOff },
  failed: { label: "Failed", color: "bg-red-600", icon: XCircle },
  busy: { label: "Busy", color: "bg-orange-500", icon: PhoneOff },
};

const DAYS_FILTER_OPTIONS = [
  { value: '1', label: 'Today (24h)' },
  { value: '2', label: 'Last 2 days' },
  { value: '3', label: 'Last 3 days' },
  { value: '5', label: 'Last 5 days' },
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

// AI-powered follow-up insights
const getFollowUpInsights = (
  leads: any[], 
  contacts: any[], 
  calls: any[], 
  deals: any[],
  daysLabel: string
) => {
  const insights: { type: 'urgent' | 'warning' | 'info'; message: string; count: number }[] = [];
  
  // Leads needing follow-up
  const followUpLeads = leads.filter(l => l.status === 'follow_up');
  if (followUpLeads.length > 0) {
    insights.push({ 
      type: 'urgent', 
      message: `${followUpLeads.length} leads marked for follow-up need action`, 
      count: followUpLeads.length 
    });
  }
  
  // No-show appointments
  const noShows = leads.filter(l => l.status === 'no_show');
  if (noShows.length > 0) {
    insights.push({ 
      type: 'urgent', 
      message: `${noShows.length} no-shows to reschedule`, 
      count: noShows.length 
    });
  }
  
  // Missed calls
  const missedCalls = calls.filter(c => c.call_status === 'missed');
  if (missedCalls.length > 0) {
    insights.push({ 
      type: 'warning', 
      message: `${missedCalls.length} missed calls to return`, 
      count: missedCalls.length 
    });
  }
  
  // New leads not contacted
  const newLeads = leads.filter(l => l.status === 'new');
  if (newLeads.length > 0) {
    insights.push({ 
      type: 'warning', 
      message: `${newLeads.length} new leads awaiting first contact`, 
      count: newLeads.length 
    });
  }
  
  // Pending deals
  const pendingDeals = deals.filter(d => d.status === 'pending');
  if (pendingDeals.length > 0) {
    const pendingValue = pendingDeals.reduce((sum, d) => sum + (d.deal_value || 0), 0);
    insights.push({ 
      type: 'info', 
      message: `${pendingDeals.length} pending deals worth ${pendingValue.toLocaleString('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 })}`, 
      count: pendingDeals.length 
    });
  }
  
  // Unworked contacts
  const unworkedContacts = contacts.filter(c => c.contact_unworked === true);
  if (unworkedContacts.length > 0) {
    insights.push({ 
      type: 'warning', 
      message: `${unworkedContacts.length} contacts marked as unworked`, 
      count: unworkedContacts.length 
    });
  }
  
  // Appointments set but not held
  const appointmentSet = leads.filter(l => l.status === 'appointment_set');
  if (appointmentSet.length > 0) {
    insights.push({ 
      type: 'info', 
      message: `${appointmentSet.length} appointments set - prepare for calls`, 
      count: appointmentSet.length 
    });
  }
  
  return insights;
};

export default function SalesPipeline() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [daysFilter, setDaysFilter] = useState<string>('3');
  
  // Calculate date filter
  const getDateFilter = () => {
    if (daysFilter === 'all') return null;
    return subDays(new Date(), parseInt(daysFilter)).toISOString();
  };

  // Sync from HubSpot mutation
  const syncFromHubspot = useMutation({
    mutationFn: async (clearFakeData: boolean) => {
      const { data, error } = await supabase.functions.invoke('sync-hubspot-to-supabase', {
        body: { clear_fake_data: clearFakeData, sync_type: 'all' }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.contacts_synced} contacts, ${data.leads_synced} leads, ${data.deals_synced} deals, ${data.calls_synced} calls`);
      // Refresh all queries
      queryClient.invalidateQueries({ queryKey: ['lead-funnel'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['deals-summary'] });
      queryClient.invalidateQueries({ queryKey: ['call-records'] });
    },
    onError: (error: any) => {
      toast.error('Sync failed: ' + error.message);
    }
  });

  // Real-time subscriptions for live updates
  useEffect(() => {
    const callsChannel = supabase
      .channel('calls-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_records' }, () => {
        queryClient.invalidateQueries({ queryKey: ['call-records'] });
      })
      .subscribe();

    const leadsChannel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        queryClient.invalidateQueries({ queryKey: ['lead-funnel'] });
      })
      .subscribe();

    const dealsChannel = supabase
      .channel('deals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
        queryClient.invalidateQueries({ queryKey: ['deals-summary'] });
      })
      .subscribe();

    const appointmentsChannel = supabase
      .channel('appointments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        queryClient.invalidateQueries({ queryKey: ['appointments-summary'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(callsChannel);
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(dealsChannel);
      supabase.removeChannel(appointmentsChannel);
    };
  }, [queryClient]);

  // Fetch lead funnel data
  const { data: funnelData } = useQuery({
    queryKey: ['lead-funnel', daysFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      let query = supabase.from('leads').select('*');
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const statusCounts: Record<string, number> = {};
      const sourceCounts: Record<string, number> = {};
      
      data?.forEach(lead => {
        statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
        if (lead.source) {
          sourceCounts[lead.source] = (sourceCounts[lead.source] || 0) + 1;
        }
      });
      
      return { leads: data || [], statusCounts, sourceCounts, total: data?.length || 0 };
    },
    refetchInterval: 30000,
  });

  // Fetch enhanced leads
  const { data: enhancedLeads } = useQuery({
    queryKey: ['enhanced-leads', daysFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      let query = supabase.from('enhanced_leads').select('*');
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Fetch contacts
  const { data: contacts } = useQuery({
    queryKey: ['contacts', daysFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      let query = supabase.from('contacts').select('*');
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Fetch deals data
  const { data: dealsData } = useQuery({
    queryKey: ['deals-summary', daysFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      let query = supabase.from('deals').select('*');
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const closedDeals = data?.filter(d => d.status === 'closed') || [];
      const totalValue = closedDeals.reduce((sum, d) => sum + (d.deal_value || 0), 0);
      const totalCollected = closedDeals.reduce((sum, d) => sum + (d.cash_collected || 0), 0);
      
      return {
        deals: data || [],
        closedCount: closedDeals.length,
        totalValue,
        totalCollected,
        avgDealValue: closedDeals.length ? totalValue / closedDeals.length : 0,
      };
    },
    refetchInterval: 30000,
  });

  // Fetch call records
  const { data: callRecords } = useQuery({
    queryKey: ['call-records', daysFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      let query = supabase.from('call_records').select('*');
      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Group by status
      const statusCounts: Record<string, number> = {};
      data?.forEach(call => {
        statusCounts[call.call_status] = (statusCounts[call.call_status] || 0) + 1;
      });
      
      return { calls: data || [], statusCounts, total: data?.length || 0 };
    },
    refetchInterval: 30000,
  });

  // Fetch appointments
  const { data: appointments } = useQuery({
    queryKey: ['appointments-summary', daysFilter],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      let query = supabase.from('appointments').select('*');
      if (dateFilter) {
        query = query.gte('scheduled_at', dateFilter);
      }
      const { data, error } = await query.order('scheduled_at', { ascending: false });
      
      if (error) throw error;
      
      const scheduled = data?.filter(a => a.status === 'scheduled').length || 0;
      const completed = data?.filter(a => a.status === 'completed').length || 0;
      
      return { appointments: data || [], scheduled, completed };
    },
    refetchInterval: 30000,
  });

  // Fetch KPIs
  const { data: kpis } = useQuery({
    queryKey: ['kpi-tracking'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_tracking')
        .select('*')
        .order('period_end', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  // Fetch forecasts
  const { data: forecasts } = useQuery({
    queryKey: ['business-forecasts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_forecasts')
        .select('*')
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })
        .limit(6);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const conversionRate = funnelData?.total 
    ? ((funnelData.statusCounts?.closed || 0) / funnelData.total * 100).toFixed(1)
    : 0;

  const allLeads = [...(funnelData?.leads || []), ...(enhancedLeads || [])];
  
  // Get follow-up insights
  const daysLabel = DAYS_FILTER_OPTIONS.find(o => o.value === daysFilter)?.label || daysFilter;
  const followUpInsights = getFollowUpInsights(
    funnelData?.leads || [],
    contacts || [],
    callRecords?.calls || [],
    dealsData?.deals || [],
    daysLabel
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Sales Pipeline</h1>
          <p className="text-muted-foreground">Full visibility: leads, contacts, deals, calls & proactive outreach</p>
        </div>
        
        {/* Controls - Grouped together */}
        <div className="flex items-center gap-3 bg-card/50 backdrop-blur-sm rounded-lg p-2 border border-border/50">
          {/* Days Filter */}
          <Select value={daysFilter} onValueChange={setDaysFilter}>
            <SelectTrigger className="w-[140px] bg-background border-border/50">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              {DAYS_FILTER_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="h-6 w-px bg-border/50" />
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => syncFromHubspot.mutate(false)}
            disabled={syncFromHubspot.isPending}
            className="bg-background border-border/50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncFromHubspot.isPending ? 'animate-spin' : ''}`} />
            Sync HubSpot
          </Button>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                disabled={syncFromHubspot.isPending}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clear Test Data & Sync</DialogTitle>
                <DialogDescription>
                  This will delete all fake/test data and sync real data from HubSpot. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => {}}>Cancel</Button>
                <Button 
                  variant="destructive" 
                  onClick={() => syncFromHubspot.mutate(true)}
                  disabled={syncFromHubspot.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear & Sync
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Action Required Banner - Compact */}
      {followUpInsights.length > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-red-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2 shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <span className="font-semibold text-amber-400">Action Required</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 overflow-x-auto">
            {followUpInsights.slice(0, 4).map((insight, idx) => (
              <div 
                key={idx}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                  insight.type === 'urgent' 
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                    : insight.type === 'warning'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}
              >
                <span className="font-bold">{insight.count}</span>
                <span className="text-xs opacity-80">{insight.message.replace(`${insight.count} `, '').split(' ').slice(0, 3).join(' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top KPIs - Compact Grid */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Leads</span>
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-bold">{funnelData?.total || 0}</div>
            <p className="text-xs text-muted-foreground">In pipeline</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contacts</span>
              <UserCheck className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold">{contacts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Total synced</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Calls</span>
              <Phone className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold">{callRecords?.total || 0}</div>
            <p className="text-xs text-muted-foreground">{callRecords?.statusCounts?.answered || 0} answered</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Closed</span>
              <CheckCircle className="h-4 w-4 text-green-400" />
            </div>
            <div className="text-2xl font-bold">{dealsData?.closedCount || 0}</div>
            <p className="text-xs text-muted-foreground">{conversionRate}% rate</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-card border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-green-400 uppercase tracking-wide">Revenue</span>
              <DollarSign className="h-4 w-4 text-green-400" />
            </div>
            <div className="text-xl font-bold text-green-400">
              {(dealsData?.totalValue || 0).toLocaleString('en-AE', { 
                style: 'currency', 
                currency: 'AED',
                maximumFractionDigits: 0 
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {(dealsData?.totalCollected || 0).toLocaleString('en-AE', { 
                style: 'currency', 
                currency: 'AED',
                maximumFractionDigits: 0 
              })} collected
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Deal</span>
              <TrendingUp className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-xl font-bold">
              {(dealsData?.avgDealValue || 0).toLocaleString('en-AE', { 
                style: 'currency', 
                currency: 'AED',
                maximumFractionDigits: 0 
              })}
            </div>
            <p className="text-xs text-muted-foreground">Per deal</p>
          </CardContent>
        </Card>
      </div>

      {/* Lead Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Lead Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-4">
            {Object.entries(STATUS_CONFIG).map(([status, config], index) => {
              const count = funnelData?.statusCounts?.[status] || 0;
              const percentage = funnelData?.total ? (count / funnelData.total * 100) : 0;
              const Icon = config.icon;
              
              return (
                <div key={status} className="flex items-center">
                  <div className="flex flex-col items-center min-w-[120px]">
                    <div className={`w-16 h-16 rounded-full ${config.color} flex items-center justify-center text-white mb-2`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-2xl font-bold">{count}</span>
                    <span className="text-xs text-muted-foreground text-center">{config.label}</span>
                    <span className="text-xs text-muted-foreground">{percentage.toFixed(0)}%</span>
                  </div>
                  {index < Object.keys(STATUS_CONFIG).length - 1 && (
                    <ArrowRight className="h-6 w-6 text-muted-foreground mx-2" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Call Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            Call Status Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {Object.entries(CALL_STATUS_CONFIG).map(([status, config]) => {
              const count = callRecords?.statusCounts?.[status] || 0;
              const Icon = config.icon;
              return (
                <div key={status} className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
                  <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center text-white mb-2`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xl font-bold">{count}</span>
                  <span className="text-xs text-muted-foreground">{config.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Data Tabs */}
      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="leads">Leads ({funnelData?.total || 0})</TabsTrigger>
          <TabsTrigger value="enhanced">Ad Leads ({enhancedLeads?.length || 0})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts?.length || 0})</TabsTrigger>
          <TabsTrigger value="deals">Deals ({dealsData?.deals?.length || 0})</TabsTrigger>
          <TabsTrigger value="calls">Calls ({callRecords?.total || 0})</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
        </TabsList>

        {/* Leads Tab */}
        <TabsContent value="leads">
          <Card>
            <CardHeader>
              <CardTitle>All Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funnelData?.leads?.slice(0, 50).map((lead: any) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          {lead.first_name || lead.firstname} {lead.last_name || lead.lastname}
                        </TableCell>
                        <TableCell>{lead.email}</TableCell>
                        <TableCell>{lead.phone}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{lead.source || 'Unknown'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_CONFIG[lead.status as keyof typeof STATUS_CONFIG]?.color || 'bg-gray-500'}>
                            {lead.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(lead.created_at), 'MMM d, HH:mm')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!funnelData?.leads?.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">No leads found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Enhanced Leads with Ad Data Tab */}
        <TabsContent value="enhanced">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Facebook Ad Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Ad</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enhancedLeads?.slice(0, 50).map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">
                          {lead.first_name} {lead.last_name}
                        </TableCell>
                        <TableCell>{lead.email}</TableCell>
                        <TableCell>{lead.phone}</TableCell>
                        <TableCell>
                          {lead.campaign_id ? (
                            <a 
                              href={`https://www.facebook.com/adsmanager/manage/campaigns?act=&selected_campaign_ids=${lead.campaign_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              {lead.campaign_name || lead.campaign_id.slice(0, 10)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lead.ad_id ? (
                            <a 
                              href={`https://www.facebook.com/adsmanager/manage/ads?act=&selected_ad_ids=${lead.ad_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              {lead.ad_name || lead.ad_id.slice(0, 10)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lead.lead_quality && (
                            <Badge variant={lead.lead_quality === 'high' ? 'default' : lead.lead_quality === 'medium' ? 'secondary' : 'outline'}>
                              {lead.lead_quality}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {lead.created_at && format(new Date(lead.created_at), 'MMM d, HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!enhancedLeads?.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">No enhanced leads with ad data found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>All Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts?.slice(0, 50).map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">
                          {contact.first_name} {contact.last_name}
                        </TableCell>
                        <TableCell>{contact.email}</TableCell>
                        <TableCell>{contact.phone}</TableCell>
                        <TableCell>{contact.city || 'Dubai'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{contact.lifecycle_stage || 'lead'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={contact.status === 'active' ? 'default' : 'secondary'}>
                            {contact.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {(contact.total_value || 0).toLocaleString('en-AE', { 
                            style: 'currency', 
                            currency: 'AED',
                            maximumFractionDigits: 0 
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!contacts?.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">No contacts found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deals Tab */}
        <TabsContent value="deals">
          <Card>
            <CardHeader>
              <CardTitle>All Deals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deal Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Pipeline</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Collected</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dealsData?.deals?.map((deal) => (
                      <TableRow key={deal.id}>
                        <TableCell className="font-medium">{deal.deal_name || `Deal ${deal.id.slice(0, 8)}`}</TableCell>
                        <TableCell>{deal.deal_type || '-'}</TableCell>
                        <TableCell>{deal.pipeline || '-'}</TableCell>
                        <TableCell>{deal.stage || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={deal.status === 'closed' ? 'default' : 'secondary'}>
                            {deal.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {deal.deal_value?.toLocaleString('en-AE', { 
                            style: 'currency', 
                            currency: 'AED',
                            maximumFractionDigits: 0 
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          {(deal.cash_collected || 0).toLocaleString('en-AE', { 
                            style: 'currency', 
                            currency: 'AED',
                            maximumFractionDigits: 0 
                          })}
                        </TableCell>
                        <TableCell>{format(new Date(deal.created_at!), 'MMM d, yyyy')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!dealsData?.deals?.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">No deals found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calls Tab */}
        <TabsContent value="calls">
          <Card>
            <CardHeader>
              <CardTitle>All Call Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Caller Number</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Outcome</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Appointment</TableHead>
                      <TableHead>Transcript</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {callRecords?.calls?.map((call) => {
                      const statusConfig = CALL_STATUS_CONFIG[call.call_status] || CALL_STATUS_CONFIG.initiated;
                      return (
                        <TableRow key={call.id}>
                          <TableCell className="font-medium">{call.caller_number}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{call.call_direction || 'inbound'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                          </TableCell>
                          <TableCell>{call.call_outcome || '-'}</TableCell>
                          <TableCell>
                            {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : '-'}
                          </TableCell>
                          <TableCell>
                            {call.lead_quality && (
                              <Badge variant={call.lead_quality === 'high' ? 'default' : 'secondary'}>
                                {call.lead_quality}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {call.appointment_set ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell>
                            {(call.transcription || call.recording_url) ? (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <FileText className="h-4 w-4 text-primary" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                      <Phone className="h-5 w-5" />
                                      Call Details - {call.caller_number}
                                    </DialogTitle>
                                    <DialogDescription>
                                      {call.duration_seconds ? `Duration: ${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : ''} 
                                      {call.created_at ? ` • ${format(new Date(call.created_at), 'MMM d, yyyy HH:mm')}` : ''}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    {call.recording_url && (
                                      <div className="space-y-2">
                                        <h4 className="font-medium flex items-center gap-2">
                                          <Play className="h-4 w-4" /> Recording
                                        </h4>
                                        <audio controls className="w-full">
                                          <source src={call.recording_url} type="audio/mpeg" />
                                          Your browser does not support audio playback.
                                        </audio>
                                      </div>
                                    )}
                                    {call.transcription && (
                                      <div className="space-y-2">
                                        <h4 className="font-medium flex items-center gap-2">
                                          <FileText className="h-4 w-4" /> Transcript
                                        </h4>
                                        <div className="bg-muted p-4 rounded-lg text-sm whitespace-pre-wrap">
                                          {call.transcription}
                                        </div>
                                      </div>
                                    )}
                                    {call.call_outcome && (
                                      <div className="space-y-2">
                                        <h4 className="font-medium">Outcome</h4>
                                        <Badge>{call.call_outcome}</Badge>
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {call.created_at && format(new Date(call.created_at), 'MMM d, HH:mm')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {!callRecords?.calls?.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">No call records found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments">
          <Card>
            <CardHeader>
              <CardTitle>All Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scheduled At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments?.appointments?.map((apt) => (
                      <TableRow key={apt.id}>
                        <TableCell className="font-medium">
                          {format(new Date(apt.scheduled_at), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={apt.status === 'completed' ? 'default' : apt.status === 'cancelled' ? 'destructive' : 'secondary'}>
                            {apt.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{apt.notes || '-'}</TableCell>
                        <TableCell>
                          {apt.created_at && format(new Date(apt.created_at), 'MMM d, HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {!appointments?.appointments?.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">No appointments found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lead Sources & KPIs */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lead Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(funnelData?.sourceCounts || {}).map(([source, count]) => {
              const percentage = funnelData?.total ? (count / funnelData.total * 100) : 0;
              return (
                <div key={source} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{source}</span>
                    <span>{count} ({percentage.toFixed(0)}%)</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
            {Object.keys(funnelData?.sourceCounts || {}).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No source data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Proactive Call Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Show leads that need follow up */}
              {funnelData?.leads?.filter((l: any) => l.status === 'follow_up' || l.status === 'new').slice(0, 5).map((lead: any) => (
                <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium">{lead.first_name || lead.firstname} {lead.last_name || lead.lastname}</p>
                      <p className="text-xs text-muted-foreground">{lead.phone}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{lead.status === 'new' ? 'Call Now' : 'Follow Up'}</Badge>
                </div>
              ))}
              {!funnelData?.leads?.filter((l: any) => l.status === 'follow_up' || l.status === 'new').length && (
                <p className="text-sm text-muted-foreground text-center py-4">All leads contacted</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Forecasts */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Forecasts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {forecasts?.map((forecast) => (
              <div key={forecast.id} className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-sm font-medium">
                  {format(new Date(forecast.period_year, forecast.period_month - 1), 'MMM yyyy')}
                </p>
                <p className="text-xl font-bold mt-2">
                  {forecast.predicted_value.toLocaleString('en-AE', { 
                    style: 'currency', 
                    currency: 'AED',
                    maximumFractionDigits: 0 
                  })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {((forecast.confidence_level || 0) * 100).toFixed(0)}% confidence
                </p>
              </div>
            ))}
          </div>
          {!forecasts?.length && (
            <p className="text-sm text-muted-foreground text-center py-4">No forecasts available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
