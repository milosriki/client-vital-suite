import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeHealthScores } from '@/hooks/useRealtimeHealthScores';
import { StatCard } from '@/components/dashboard/StatCard';
import { HealthDistribution } from '@/components/dashboard/HealthDistribution';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { ClientRiskMatrix } from '@/components/dashboard/ClientRiskMatrix';
import { AIAssistantPanel } from '@/components/ai/AIAssistantPanel';
import { FloatingAIButton } from '@/components/FloatingAIButton';
import { ErrorMonitor } from '@/components/dashboard/ErrorMonitor';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Users, DollarSign, AlertTriangle, TrendingUp, Bot, Activity } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function Dashboard() {
  useRealtimeHealthScores();
  const navigate = useNavigate();
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [isRunningBI, setIsRunningBI] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Fetch clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['client-health-scores-dashboard'],
    queryFn: async () => {
      const { data: latestDate } = await supabase
        .from('client_health_scores')
        .select('calculated_on')
        .order('calculated_on', { ascending: false })
        .limit(1)
        .single();

      if (!latestDate?.calculated_on) return [];

      const { data, error } = await supabase
        .from('client_health_scores')
        .select('*')
        .eq('calculated_on', latestDate.calculated_on)
        .order('health_score', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  // Fetch summary
  const { data: summary } = useQuery({
    queryKey: ['daily-summary-dashboard'],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_summary')
        .select('*')
        .order('summary_date', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    refetchInterval: 60000,
  });

  // Compute stats
  const stats = useMemo(() => {
    const allClients = clients || [];
    const atRisk = allClients.filter(c => 
      c.health_zone === 'RED' || c.health_zone === 'YELLOW'
    ).length;
    const totalRevenue = allClients.reduce((sum, c) => 
      sum + (c.package_value_aed || 0), 0
    );
    const avgHealth = allClients.length > 0 
      ? Math.round(allClients.reduce((sum, c) => sum + (c.health_score || 0), 0) / allClients.length)
      : 0;

    return {
      totalClients: allClients.length,
      atRiskClients: atRisk,
      totalRevenue,
      avgHealth,
    };
  }, [clients]);

  // Mock revenue data for chart
  const revenueData = useMemo(() => {
    const days = 30;
    const data = [];
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: Math.floor(Math.random() * 50000) + 20000,
      });
    }
    return data;
  }, []);

  // Mock activities
  const activities = useMemo(() => [
    { id: '1', type: 'sync' as const, title: 'HubSpot Synced', description: 'Latest contacts imported', timestamp: new Date(Date.now() - 1000 * 60 * 5) },
    { id: '2', type: 'payment' as const, title: 'New Payment', description: 'AED 5,000 collected', timestamp: new Date(Date.now() - 1000 * 60 * 30) },
    { id: '3', type: 'intervention' as const, title: 'Intervention Triggered', description: 'Client at risk detected', timestamp: new Date(Date.now() - 1000 * 60 * 60) },
  ], []);

  // Handlers
  const runBusinessIntelligence = async () => {
    setIsRunningBI(true);
    try {
      const { data, error } = await supabase.functions.invoke('business-intelligence');
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
      const { data, error } = await supabase.functions.invoke('sync-hubspot-to-supabase');
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
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="animate-fade-up">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            PTD Intelligence Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time business health monitoring
          </p>
        </div>

        {/* Error Monitor */}
        <ErrorMonitor />

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Clients"
            value={stats.totalClients}
            icon={Users}
            trend={{ value: 12, isPositive: true }}
            variant="default"
            delay={0}
          />
          <StatCard
            label="At Risk"
            value={stats.atRiskClients}
            icon={AlertTriangle}
            variant={stats.atRiskClients > 5 ? "danger" : "warning"}
            pulse={stats.atRiskClients > 10}
            subtitle={stats.atRiskClients > 0 ? "Needs attention" : "All healthy!"}
            delay={50}
          />
          <StatCard
            label="Portfolio Value"
            value={`AED ${(stats.totalRevenue / 1000).toFixed(0)}K`}
            icon={DollarSign}
            trend={{ value: 8, isPositive: true }}
            variant="success"
            delay={100}
          />
          <StatCard
            label="Avg Health Score"
            value={stats.avgHealth}
            icon={Activity}
            variant={stats.avgHealth >= 70 ? "success" : stats.avgHealth >= 50 ? "warning" : "danger"}
            delay={150}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <HealthDistribution 
            clients={clients || []} 
            onZoneClick={(zone) => navigate(`/clients?zone=${zone}`)}
          />
          <RevenueChart data={revenueData} isLoading={clientsLoading} />
        </div>

        {/* Quick Actions */}
        <QuickActions
          onRunBI={runBusinessIntelligence}
          onSyncHubSpot={syncHubSpot}
          onOpenAI={() => setShowAIPanel(true)}
          isRunningBI={isRunningBI}
          isSyncing={isSyncing}
        />

        {/* Activity & Risk Matrix */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ActivityFeed activities={activities} />
          <div className="lg:col-span-2">
            <ClientRiskMatrix clients={clients || []} isLoading={clientsLoading} />
          </div>
        </div>
      </div>

      {/* Floating AI Button */}
      <FloatingAIButton onOpen={() => setShowAIPanel(true)} />

      {/* AI Panel Sheet */}
      <Sheet open={showAIPanel} onOpenChange={setShowAIPanel}>
        <SheetContent side="right" className="w-full sm:w-[450px] p-0">
          <AIAssistantPanel />
        </SheetContent>
      </Sheet>
    </div>
  );
}
