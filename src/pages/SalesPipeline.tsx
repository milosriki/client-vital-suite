import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MetricCard } from '@/components/MetricCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, Users, DollarSign, Calendar, TrendingUp, Target, CheckCircle, Clock, Filter, Search } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, startOfWeek, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;
type Deal = Tables<'deals'>;
type Appointment = Tables<'appointments'>;

export default function SalesPipeline() {
  const [activeTab, setActiveTab] = useState('leads');
  const [leadStatusFilter, setLeadStatusFilter] = useState('all');
  const [leadSourceFilter, setLeadSourceFilter] = useState('all');
  const [dealStageFilter, setDealStageFilter] = useState('all');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Query leads
  const { data: leads, isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Lead[];
    },
  });

  // Query deals
  const { data: deals, isLoading: dealsLoading, refetch: refetchDeals } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Deal[];
    },
  });

  // Query appointments
  const { data: appointments, isLoading: appointmentsLoading, refetch: refetchAppointments } = useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('scheduled_at', { ascending: false });

      if (error) throw error;
      return data as Appointment[];
    },
  });

  // Filter and search leads
  const filteredLeads = (leads || []).filter(lead => {
    const matchesStatus = leadStatusFilter === 'all' || lead.status === leadStatusFilter;
    const matchesSource = leadSourceFilter === 'all' || lead.source === leadSourceFilter;
    const matchesSearch = !searchQuery ||
      lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSource && matchesSearch;
  });

  // Filter deals
  const filteredDeals = (deals || []).filter(deal => {
    const matchesStage = dealStageFilter === 'all' || deal.stage === dealStageFilter;
    const matchesSearch = !searchQuery ||
      deal.deal_name?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStage && matchesSearch;
  });

  // Filter appointments
  const filteredAppointments = (appointments || []).filter(appointment => {
    const matchesStatus = appointmentStatusFilter === 'all' || appointment.status === appointmentStatusFilter;

    return matchesStatus;
  });

  // Calculate leads metrics
  const leadsMetrics = {
    total: leads?.length || 0,
    thisWeek: leads?.filter(l => l.created_at && isAfter(parseISO(l.created_at), startOfWeek(new Date()))).length || 0,
    converted: leads?.filter(l => l.status === 'closed').length || 0,
    topSource: calculateTopSource(leads || []),
    conversionRate: leads?.length ? ((leads.filter(l => l.status === 'closed').length / leads.length) * 100).toFixed(1) : '0',
  };

  // Calculate deals metrics
  const dealsMetrics = {
    total: deals?.length || 0,
    totalValue: deals?.reduce((sum, d) => sum + (d.deal_value || 0), 0) || 0,
    avgDealSize: deals?.length ? (deals.reduce((sum, d) => sum + (d.deal_value || 0), 0) / deals.length).toFixed(0) : '0',
    closedDeals: deals?.filter(d => d.status === 'closed').length || 0,
    pendingDeals: deals?.filter(d => d.status === 'pending').length || 0,
    winRate: deals?.length ? ((deals.filter(d => d.status === 'closed').length / deals.length) * 100).toFixed(1) : '0',
  };

  // Calculate appointments metrics
  const appointmentsMetrics = {
    total: appointments?.length || 0,
    thisWeek: appointments?.filter(a => a.scheduled_at && isAfter(parseISO(a.scheduled_at), startOfWeek(new Date()))).length || 0,
    completed: appointments?.filter(a => a.status === 'completed').length || 0,
    scheduled: appointments?.filter(a => a.status === 'scheduled').length || 0,
    showRate: appointments?.length ? ((appointments.filter(a => a.status === 'completed').length / appointments.length) * 100).toFixed(1) : '0',
    avgPerDay: appointments?.length ? (appointments.length / 30).toFixed(1) : '0',
  };

  // Get unique values for filters
  const uniqueSources = Array.from(new Set(leads?.map(l => l.source).filter(Boolean))) as string[];
  const uniqueStages = Array.from(new Set(deals?.map(d => d.stage).filter(Boolean))) as string[];
  const uniqueStatuses = Array.from(new Set(appointments?.map(a => a.status).filter(Boolean))) as string[];

  // Pagination
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedDeals = filteredDeals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedAppointments = filteredAppointments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleRefresh = async () => {
    try {
      await Promise.all([refetchLeads(), refetchDeals(), refetchAppointments()]);
      toast({
        title: 'Data refreshed',
        description: 'Sales pipeline data has been updated.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to refresh data.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Pipeline</h1>
          <p className="text-muted-foreground">Track leads, deals, and appointments</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value); setCurrentPage(1); setSearchQuery(''); }}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="leads" className="gap-2">
            <Users className="h-4 w-4" />
            Leads ({leads?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="deals" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Deals ({deals?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="appointments" className="gap-2">
            <Calendar className="h-4 w-4" />
            Appointments ({appointments?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* LEADS TAB */}
        <TabsContent value="leads" className="space-y-6">
          {/* Leads Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Leads"
              value={leadsMetrics.total}
              icon={Users}
              iconColor="text-blue-500"
              iconBg="bg-blue-50"
            />
            <MetricCard
              title="Leads This Week"
              value={leadsMetrics.thisWeek}
              icon={TrendingUp}
              iconColor="text-green-500"
              iconBg="bg-green-50"
            />
            <MetricCard
              title="Conversion Rate"
              value={`${leadsMetrics.conversionRate}%`}
              icon={Target}
              iconColor="text-purple-500"
              iconBg="bg-purple-50"
            />
            <MetricCard
              title="Top Source"
              value={leadsMetrics.topSource}
              icon={TrendingUp}
              iconColor="text-orange-500"
              iconBg="bg-orange-50"
            />
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={leadStatusFilter} onValueChange={setLeadStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="appointment_set">Appointment Set</SelectItem>
                  <SelectItem value="appointment_held">Appointment Held</SelectItem>
                  <SelectItem value="pitch_given">Pitch Given</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                  <SelectItem value="rescheduled">Rescheduled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={leadSourceFilter} onValueChange={setLeadSourceFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {uniqueSources.map(source => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Leads Table */}
          <Card>
            <CardHeader>
              <CardTitle>Leads ({filteredLeads.length})</CardTitle>
              <CardDescription>All leads from various sources</CardDescription>
            </CardHeader>
            <CardContent>
              {leadsLoading ? (
                <LoadingTable />
              ) : filteredLeads.length === 0 ? (
                <EmptyState message="No leads yet. Sync from HubSpot or add manually." />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLeads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.name}</TableCell>
                          <TableCell>{lead.email || '-'}</TableCell>
                          <TableCell>{lead.phone || '-'}</TableCell>
                          <TableCell>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                              {lead.source || 'Unknown'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={lead.status || 'new'} type="lead" />
                          </TableCell>
                          <TableCell>{lead.score || '-'}</TableCell>
                          <TableCell>
                            {lead.created_at ? format(parseISO(lead.created_at), 'MMM d, yyyy') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredLeads.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DEALS TAB */}
        <TabsContent value="deals" className="space-y-6">
          {/* Deals Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Pipeline Value"
              value={`$${dealsMetrics.totalValue.toLocaleString()}`}
              icon={DollarSign}
              iconColor="text-green-500"
              iconBg="bg-green-50"
            />
            <MetricCard
              title="Number of Deals"
              value={dealsMetrics.total}
              icon={Target}
              iconColor="text-blue-500"
              iconBg="bg-blue-50"
            />
            <MetricCard
              title="Average Deal Size"
              value={`$${dealsMetrics.avgDealSize}`}
              icon={TrendingUp}
              iconColor="text-purple-500"
              iconBg="bg-purple-50"
            />
            <MetricCard
              title="Win Rate"
              value={`${dealsMetrics.winRate}%`}
              icon={CheckCircle}
              iconColor="text-orange-500"
              iconBg="bg-orange-50"
            />
          </div>

          {/* Stage Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-700">{dealsMetrics.pendingDeals}</div>
                  <div className="text-sm text-yellow-600">Pending</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">{dealsMetrics.closedDeals}</div>
                  <div className="text-sm text-green-600">Closed</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-700">
                    {deals?.filter(d => d.status === 'cancelled').length || 0}
                  </div>
                  <div className="text-sm text-gray-600">Cancelled</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search by deal name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={dealStageFilter} onValueChange={setDealStageFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {uniqueStages.map(stage => (
                    <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Deals Table */}
          <Card>
            <CardHeader>
              <CardTitle>Deals ({filteredDeals.length})</CardTitle>
              <CardDescription>All deals in the pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              {dealsLoading ? (
                <LoadingTable />
              ) : filteredDeals.length === 0 ? (
                <EmptyState message="No deals yet. Create deals from qualified leads." />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Deal Name</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Close Date</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedDeals.map((deal) => (
                        <TableRow key={deal.id}>
                          <TableCell className="font-medium">{deal.deal_name || 'Unnamed Deal'}</TableCell>
                          <TableCell className="font-semibold text-green-600">
                            ${deal.deal_value?.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                              {deal.stage || 'Unknown'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={deal.status || 'pending'} type="deal" />
                          </TableCell>
                          <TableCell>
                            {deal.close_date ? format(parseISO(deal.close_date), 'MMM d, yyyy') : '-'}
                          </TableCell>
                          <TableCell>
                            {deal.created_at ? format(parseISO(deal.created_at), 'MMM d, yyyy') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredDeals.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* APPOINTMENTS TAB */}
        <TabsContent value="appointments" className="space-y-6">
          {/* Appointments Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Appointments"
              value={appointmentsMetrics.total}
              icon={Calendar}
              iconColor="text-blue-500"
              iconBg="bg-blue-50"
            />
            <MetricCard
              title="This Week"
              value={appointmentsMetrics.thisWeek}
              icon={Clock}
              iconColor="text-green-500"
              iconBg="bg-green-50"
            />
            <MetricCard
              title="Show Rate"
              value={`${appointmentsMetrics.showRate}%`}
              icon={CheckCircle}
              iconColor="text-purple-500"
              iconBg="bg-purple-50"
            />
            <MetricCard
              title="Avg Per Day"
              value={appointmentsMetrics.avgPerDay}
              icon={TrendingUp}
              iconColor="text-orange-500"
              iconBg="bg-orange-50"
            />
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Select value={appointmentStatusFilter} onValueChange={setAppointmentStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {uniqueStatuses.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Appointments Table */}
          <Card>
            <CardHeader>
              <CardTitle>Appointments ({filteredAppointments.length})</CardTitle>
              <CardDescription>All scheduled appointments</CardDescription>
            </CardHeader>
            <CardContent>
              {appointmentsLoading ? (
                <LoadingTable />
              ) : filteredAppointments.length === 0 ? (
                <EmptyState message="No appointments yet. Schedule appointments with your leads." />
              ) : (
                <>
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
                      {paginatedAppointments.map((appointment) => (
                        <TableRow key={appointment.id}>
                          <TableCell className="font-medium">
                            {format(parseISO(appointment.scheduled_at), 'MMM d, yyyy h:mm a')}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={appointment.status || 'scheduled'} type="appointment" />
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {appointment.notes || '-'}
                          </TableCell>
                          <TableCell>
                            {appointment.created_at ? format(parseISO(appointment.created_at), 'MMM d, yyyy') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredAppointments.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper function to calculate top source
function calculateTopSource(leads: Lead[]): string {
  if (!leads || leads.length === 0) return 'N/A';

  const sourceCounts = leads.reduce((acc, lead) => {
    const source = lead.source || 'Unknown';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];
  return topSource ? topSource[0] : 'N/A';
}

// Status Badge Component
function StatusBadge({ status, type }: { status: string; type: 'lead' | 'deal' | 'appointment' }) {
  const getStatusColor = () => {
    if (type === 'lead') {
      const colors: Record<string, string> = {
        new: 'bg-blue-100 text-blue-800',
        appointment_set: 'bg-purple-100 text-purple-800',
        appointment_held: 'bg-indigo-100 text-indigo-800',
        pitch_given: 'bg-yellow-100 text-yellow-800',
        closed: 'bg-green-100 text-green-800',
        no_show: 'bg-red-100 text-red-800',
        follow_up: 'bg-orange-100 text-orange-800',
        rescheduled: 'bg-gray-100 text-gray-800',
      };
      return colors[status] || 'bg-gray-100 text-gray-800';
    }

    if (type === 'deal') {
      const colors: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800',
        closed: 'bg-green-100 text-green-800',
        cancelled: 'bg-red-100 text-red-800',
      };
      return colors[status] || 'bg-gray-100 text-gray-800';
    }

    // appointment
    return 'bg-blue-100 text-blue-800';
  };

  const formatStatus = (s: string) => {
    return s.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor()}`}>
      {formatStatus(status)}
    </span>
  );
}

// Empty State Component
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Search className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Data Found</h3>
      <p className="text-muted-foreground max-w-md">{message}</p>
    </div>
  );
}

// Loading Table Component
function LoadingTable() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

// Pagination Component
function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange
}: {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-muted-foreground">
        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Previous
        </Button>
        <div className="flex items-center gap-1">
          {[...Array(totalPages)].map((_, i) => {
            const page = i + 1;
            if (
              page === 1 ||
              page === totalPages ||
              (page >= currentPage - 1 && page <= currentPage + 1)
            ) {
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </Button>
              );
            }
            if (page === currentPage - 2 || page === currentPage + 2) {
              return <span key={page} className="px-2">...</span>;
            }
            return null;
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
