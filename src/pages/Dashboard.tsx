import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeHealthScores } from '@/hooks/useRealtimeHealthScores';
import { useNotifications } from '@/hooks/useNotifications';
import { HeroStatCard } from '@/components/dashboard/HeroStatCard';
import { GreetingBar } from '@/components/dashboard/GreetingBar';
import { LiveHealthDistribution } from '@/components/dashboard/LiveHealthDistribution';
import { LiveQuickActions } from '@/components/dashboard/LiveQuickActions';
import { LiveActivityFeed } from '@/components/dashboard/LiveActivityFeed';
import { LiveRevenueChart } from '@/components/dashboard/LiveRevenueChart';
import { TodaySnapshot } from '@/components/dashboard/TodaySnapshot';
import { CoachLeaderboard } from '@/components/dashboard/CoachLeaderboard';
import { AlertsBar } from '@/components/dashboard/AlertsBar';
import { ExecutiveBriefing } from '@/components/dashboard/ExecutiveBriefing';
import { PredictiveAlerts } from '@/components/dashboard/PredictiveAlerts';
import { PatternInsights } from '@/components/dashboard/PatternInsights';
import { AIAssistantPanel } from '@/components/ai/AIAssistantPanel';
import { MetricDrilldownModal } from '@/components/dashboard/MetricDrilldownModal';
import { FunctionStatusChecker } from '@/components/FunctionStatusChecker';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Users, DollarSign, AlertTriangle, TrendingUp, Phone, Calendar, Target } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export default function Dashboard() {
  useRealtimeHealthScores();
  useNotifications();
  const navigate = useNavigate();
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [isRunningBI, setIsRunningBI] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [drilldownMetric, setDrilldownMetric] = useState<{ title: string; value: string | number; type: "revenue" | "clients" | "pipeline" | "attention" } | null>(null);

  // Fetch clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['client-health-scores-dashboard'],
    queryFn: async () => {
      // Get latest calculated_on date - use maybeSingle to avoid error when no rows
      const { data: latestDateRows } = await supabase
        .from('client_health_scores')
        .select('calculated_on')
        .order('calculated_on', { ascending: false })
        .limit(1);

      const latestDate = latestDateRows?.[0]?.calculated_on;
      
      // If no calculated_on, just get all clients
      let query = supabase
        .from('client_health_scores')
        .select('*')
        .order('health_score', { ascending: true });

      if (latestDate) {
        query = query.eq('calculated_on', latestDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  // Fetch daily summary for Executive Briefing
  const { data: dailySummary } = useQuery({
    queryKey: ['daily-summary-briefing'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('daily_summary')
        .select('*')
        .eq('summary_date', today)
        .single();

      if (error) return null;
      return data;
    },
    refetchInterval: 300000,
  });

  // Fetch weekly patterns
  const { data: weeklyPatterns } = useQuery({
    queryKey: ['weekly-patterns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_patterns')
        .select('*')
        .order('week_start', { ascending: false })
        .limit(1)
        .single();

      if (error) return null;
      return data;
    },
  });

  // Fetch revenue this month
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['monthly-revenue'],
    queryFn: async () => {
      const now = new Date();
      const thisMonthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const thisMonthEnd = format(endOfMonth(now), 'yyyy-MM-dd');
      const lastMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
      const lastMonthEnd = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');

      const [thisMonth, lastMonth] = await Promise.all([
        (supabase as any)
          .from('deals')
          .select('deal_value')
          .eq('status', 'closed')
          .gte('close_date', thisMonthStart)
          .lte('close_date', thisMonthEnd),
        (supabase as any)
          .from('deals')
          .select('deal_value')
          .eq('status', 'closed')
          .gte('close_date', lastMonthStart)
          .lte('close_date', lastMonthEnd),
      ]);

      const thisTotal = thisMonth.data?.reduce((s: number, d: any) => s + (d.deal_value || 0), 0) || 0;
      const lastTotal = lastMonth.data?.reduce((s: number, d: any) => s + (d.deal_value || 0), 0) || 0;
      const trend = lastTotal > 0 ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : 0;

      return { total: thisTotal, trend, isPositive: trend >= 0 };
    },
    refetchInterval: 120000,
  });

  // Fetch pipeline value
  const { data: pipelineData } = useQuery({
    queryKey: ['pipeline-value'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('deals')
        .select('deal_value')
        .not('status', 'in', '("closed","lost")');

      if (error) return { total: 0, count: 0 };
      const total = data?.reduce((s: number, d: any) => s + (d.deal_value || 0), 0) || 0;
      return { total, count: data?.length || 0 };
    },
  });

  // Fetch today's leads count (HubSpot stores leads as contacts)
  const { data: leadsToday } = useQuery({
    queryKey: ['leads-today'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { count, error } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

      if (error) return 0;
      return count || 0;
    },
  });

  // Fetch today's calls count
  const { data: callsToday } = useQuery({
    queryKey: ['calls-today'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { count, error } = await supabase
        .from('call_records')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

      if (error) return 0;
      return count || 0;
    },
  });

  // Compute stats
  const stats = useMemo(() => {
    const allClients = clients || [];
    const atRisk = allClients.filter(c => 
      c.health_zone === 'RED' || c.health_zone === 'YELLOW'
    ).length;

    return {
      totalClients: allClients.length,
      atRiskClients: atRisk,
    };
  }, [clients]);

  // Build executive summary object
  const executiveSummary = useMemo(() => {
    const atRiskRevenue = (clients || [])
      .filter(c => c.health_zone === 'RED' || c.health_zone === 'YELLOW')
      .reduce((sum, c) => sum + (c.package_value_aed || 0), 0);

    return {
      executive_briefing: dailySummary?.patterns_detected 
        ? `${stats.totalClients} active clients tracked. ${stats.atRiskClients} require immediate attention with AED ${atRiskRevenue.toLocaleString()} at risk.`
        : `Monitoring ${stats.totalClients} clients. ${stats.atRiskClients} in warning/critical zones.`,
      max_utilization_rate: stats.totalClients > 0 
        ? Math.round(((stats.totalClients - stats.atRiskClients) / stats.totalClients) * 100) 
        : 0,
      system_health_status: stats.atRiskClients > 10 ? 'Attention Required' : 'Healthy',
      action_plan: stats.atRiskClients > 0 
        ? [`Review ${stats.atRiskClients} at-risk clients`, 'Schedule intervention calls', 'Update client engagement scores']
        : [],
      sla_breach_count: dailySummary?.critical_interventions || 0,
    };
  }, [clients, dailySummary, stats]);

  // Handlers
  const runBusinessIntelligence = async () => {
    setIsRunningBI(true);
    try {
      const { error } = await supabase.functions.invoke('business-intelligence');
      if (error) throw error;
      toast({ title: 'BI Agent Complete', description: 'Analysis updated successfully' });
    } catch (error: any) {
      toast({ title: 'BI Agent Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsRunningBI(false);
    }
  };

  const syncHubSpot = async () => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-hubspot-to-supabase');
      if (error) throw error;
      toast({ title: 'Sync Complete', description: 'HubSpot data synchronized' });
    } catch (error: any) {
      toast({ title: 'Sync Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Greeting Bar */}
        <GreetingBar />

        {/* Executive Briefing - AI Summary */}
        <ExecutiveBriefing summary={executiveSummary} />

        {/* Key Metrics Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-border via-border/50 to-transparent" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Key Metrics</span>
            <div className="h-px flex-1 bg-gradient-to-l from-border via-border/50 to-transparent" />
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            <HeroStatCard
              label="Revenue This Month"
              value={`AED ${(revenueData?.total || 0).toLocaleString()}`}
              icon={DollarSign}
              trend={revenueData?.total ? { value: Math.abs(revenueData.trend), isPositive: revenueData.isPositive } : undefined}
              variant="success"
              delay={0}
              href="/analytics"
              emptyMessage="No revenue yet"
              isLoading={revenueLoading}
            />
            <HeroStatCard
              label="Active Clients"
              value={stats.totalClients}
              icon={Users}
              variant="default"
              delay={50}
              href="/clients"
              emptyMessage="No clients yet"
              isLoading={clientsLoading}
            />
            <HeroStatCard
              label="Needs Attention"
              value={stats.atRiskClients}
              icon={AlertTriangle}
              variant={stats.atRiskClients > 5 ? "danger" : "warning"}
              pulse={stats.atRiskClients > 10}
              delay={100}
              href="/clients?zone=RED"
              subtitle={stats.atRiskClients === 0 ? "All healthy! 🎉" : undefined}
              isLoading={clientsLoading}
            />
            <HeroStatCard
              label="Pipeline Value"
              value={`AED ${(pipelineData?.total || 0).toLocaleString()}`}
              icon={TrendingUp}
              variant="default"
              delay={150}
              href="/sales-pipeline"
              subtitle={pipelineData?.count ? `from ${pipelineData.count} deals` : undefined}
              emptyMessage="No active deals"
            />
          </div>
        </section>

        {/* Today's Activity Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-border via-border/50 to-transparent" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Today's Activity</span>
            <div className="h-px flex-1 bg-gradient-to-l from-border via-border/50 to-transparent" />
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            <HeroStatCard
              label="Leads Today"
              value={leadsToday || 0}
              icon={Target}
              variant="default"
              delay={200}
              href="/clients"
            />
            <HeroStatCard
              label="Calls Today"
              value={callsToday || 0}
              icon={Phone}
              variant="default"
              delay={250}
              href="/call-tracking"
            />
            <HeroStatCard
              label="Appointments Set"
              value={dailySummary?.interventions_recommended || 0}
              icon={Calendar}
              variant="success"
              delay={300}
              href="/interventions"
            />
            <HeroStatCard
              label="Critical Alerts"
              value={dailySummary?.critical_interventions || 0}
              icon={AlertTriangle}
              variant={(dailySummary?.critical_interventions || 0) > 0 ? "danger" : "default"}
              delay={350}
              href="/interventions"
            />
          </div>
        </section>

        {/* Predictive Alerts */}
        <PredictiveAlerts clients={clients || []} summary={dailySummary} />

        {/* Analytics Section */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-border via-border/50 to-transparent" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">Analytics & Insights</span>
            <div className="h-px flex-1 bg-gradient-to-l from-border via-border/50 to-transparent" />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - 2/3 */}
            <div className="lg:col-span-2 space-y-6">
              <LiveHealthDistribution clients={clients || []} isLoading={clientsLoading} />
              <LiveRevenueChart />
              <PatternInsights patterns={weeklyPatterns} clients={clients || []} />
              <LiveActivityFeed />
            </div>

            {/* Right Column - 1/3 */}
            <div className="space-y-6">
              <LiveQuickActions
                onRunBI={runBusinessIntelligence}
                onSyncHubSpot={syncHubSpot}
                onOpenAI={() => setShowAIPanel(true)}
                isRunningBI={isRunningBI}
                isSyncing={isSyncing}
              />
              <TodaySnapshot />
              <CoachLeaderboard />
            </div>
          </div>
        </section>

        {/* Alerts Bar */}
        <AlertsBar />

        {/* Function Status Checker - Debug Tool (Development Only) */}
        {import.meta.env.DEV && (
          <FunctionStatusChecker />
        )}
      </div>

      {/* AI Panel Sheet */}
      <Sheet open={showAIPanel} onOpenChange={setShowAIPanel}>
        <SheetContent side="right" className="w-full sm:w-[450px] p-0">
          <AIAssistantPanel />
        </SheetContent>
      </Sheet>

      {/* Metric Drilldown Modal */}
      <MetricDrilldownModal
        open={!!drilldownMetric}
        onClose={() => setDrilldownMetric(null)}
        metric={drilldownMetric}
      />
    </div>
  );
}
