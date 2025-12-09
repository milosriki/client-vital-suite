import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Lightbulb
} from "lucide-react";
import { format } from "date-fns";

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

export default function SalesPipeline() {
  const queryClient = useQueryClient();

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
    queryKey: ['lead-funnel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*');
      
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
    queryKey: ['enhanced-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enhanced_leads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Fetch contacts
  const { data: contacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // Fetch deals data
  const { data: dealsData } = useQuery({
    queryKey: ['deals-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false });
      
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
    queryKey: ['call-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_records')
        .select('*')
        .order('created_at', { ascending: false });
      
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
    queryKey: ['appointments-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('scheduled_at', { ascending: false });
      
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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales Pipeline</h1>
        <p className="text-muted-foreground">Full visibility: leads, contacts, deals, calls & proactive outreach</p>
      </div>

      {/* Top KPIs */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{funnelData?.total || 0}</div>
            <p className="text-xs text-muted-foreground">In pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Contacts</CardTitle>
            <UserCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contacts?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Total contacts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{callRecords?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {callRecords?.statusCounts?.answered || 0} answered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Closed Deals</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dealsData?.closedCount || 0}</div>
            <p className="text-xs text-muted-foreground">{conversionRate}% conversion</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(dealsData?.totalValue || 0).toLocaleString('en-AE', { 
                style: 'currency', 
                currency: 'AED',
                maximumFractionDigits: 0 
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Collected: {(dealsData?.totalCollected || 0).toLocaleString('en-AE', { 
                style: 'currency', 
                currency: 'AED',
                maximumFractionDigits: 0 
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Deal Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(dealsData?.avgDealValue || 0).toLocaleString('en-AE', { 
                style: 'currency', 
                currency: 'AED',
                maximumFractionDigits: 0 
              })}
            </div>
            <p className="text-xs text-muted-foreground">Per closed deal</p>
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
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="leads">Leads ({funnelData?.total || 0})</TabsTrigger>
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
