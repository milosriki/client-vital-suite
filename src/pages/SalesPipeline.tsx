import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  ArrowRight
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

export default function SalesPipeline() {
  // Fetch lead funnel data
  const { data: funnelData } = useQuery({
    queryKey: ['lead-funnel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('status, source, created_at');
      
      if (error) throw error;
      
      const statusCounts: Record<string, number> = {};
      const sourceCounts: Record<string, number> = {};
      
      data?.forEach(lead => {
        statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
        if (lead.source) {
          sourceCounts[lead.source] = (sourceCounts[lead.source] || 0) + 1;
        }
      });
      
      return { statusCounts, sourceCounts, total: data?.length || 0 };
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

  // Fetch appointments
  const { data: appointments } = useQuery({
    queryKey: ['appointments-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('scheduled_at', { ascending: false })
        .limit(10);
      
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

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales Pipeline</h1>
        <p className="text-muted-foreground">Lead funnel, deals, and revenue tracking</p>
      </div>

      {/* Top KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Lead Sources */}
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
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {appointments?.appointments?.slice(0, 5).map((apt) => (
                <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {format(new Date(apt.scheduled_at), 'MMM d, yyyy HH:mm')}
                    </span>
                  </div>
                  <Badge variant={apt.status === 'completed' ? 'default' : 'secondary'}>
                    {apt.status}
                  </Badge>
                </div>
              ))}
              {!appointments?.appointments?.length && (
                <p className="text-sm text-muted-foreground text-center py-4">No appointments found</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs & Forecasts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* KPI Tracking */}
        <Card>
          <CardHeader>
            <CardTitle>KPI Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {kpis?.slice(0, 5).map((kpi) => {
                const progress = kpi.target_value ? (kpi.metric_value / kpi.target_value * 100) : 0;
                return (
                  <div key={kpi.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{kpi.metric_name.replace(/_/g, ' ')}</span>
                      <span>
                        {kpi.metric_value.toLocaleString()} / {kpi.target_value?.toLocaleString() || 'N/A'}
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(progress, 100)} 
                      className={`h-2 ${progress >= 100 ? '[&>div]:bg-green-500' : ''}`}
                    />
                  </div>
                );
              })}
              {!kpis?.length && (
                <p className="text-sm text-muted-foreground text-center py-4">No KPIs configured</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Revenue Forecasts */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Forecasts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {forecasts?.map((forecast) => (
                <div key={forecast.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <span className="font-medium">
                      {format(new Date(forecast.period_year, forecast.period_month - 1), 'MMMM yyyy')}
                    </span>
                    <p className="text-xs text-muted-foreground">{forecast.model_used} model</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">
                      {forecast.predicted_value.toLocaleString('en-AE', { 
                        style: 'currency', 
                        currency: 'AED',
                        maximumFractionDigits: 0 
                      })}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {((forecast.confidence_level || 0) * 100).toFixed(0)}% confidence
                    </p>
                  </div>
                </div>
              ))}
              {!forecasts?.length && (
                <p className="text-sm text-muted-foreground text-center py-4">No forecasts available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Deals */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Deals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium">Date</th>
                  <th className="text-left py-3 px-2 text-sm font-medium">Status</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Deal Value</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Collected</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Collection %</th>
                </tr>
              </thead>
              <tbody>
                {dealsData?.deals?.slice(0, 10).map((deal) => (
                  <tr key={deal.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2 text-sm">
                      {format(new Date(deal.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="py-3 px-2">
                      <Badge variant={deal.status === 'closed' ? 'default' : 'secondary'}>
                        {deal.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 text-sm text-right font-medium">
                      {deal.deal_value?.toLocaleString('en-AE', { 
                        style: 'currency', 
                        currency: 'AED',
                        maximumFractionDigits: 0 
                      })}
                    </td>
                    <td className="py-3 px-2 text-sm text-right">
                      {(deal.cash_collected || 0).toLocaleString('en-AE', { 
                        style: 'currency', 
                        currency: 'AED',
                        maximumFractionDigits: 0 
                      })}
                    </td>
                    <td className="py-3 px-2 text-sm text-right">
                      {deal.deal_value ? ((deal.cash_collected || 0) / deal.deal_value * 100).toFixed(0) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!dealsData?.deals?.length && (
              <p className="text-sm text-muted-foreground text-center py-4">No deals found</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
