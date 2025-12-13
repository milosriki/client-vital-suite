import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeHealthScores } from '@/hooks/useRealtimeHealthScores';
import { ClientRiskMatrix } from '@/components/dashboard/ClientRiskMatrix';
import { PredictiveAlerts } from '@/components/dashboard/PredictiveAlerts';
import { CoachPerformanceTable } from '@/components/dashboard/CoachPerformanceTable';
import { InterventionTracker } from '@/components/dashboard/InterventionTracker';
import { PatternInsights } from '@/components/dashboard/PatternInsights';
import { FilterControls } from '@/components/dashboard/FilterControls';
import { AIAssistantPanel, AIAssistantButton } from '@/components/ai/AIAssistantPanel';
import { ExecutiveBriefing } from '@/components/dashboard/ExecutiveBriefing';
import { LeakDetector } from '@/components/dashboard/LeakDetector';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Command, Activity, Settings, Zap, TrendingUp, Database, Bot, BrainCircuit, RefreshCw, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SyncStatusBadge } from '@/components/dashboard/SyncStatusBadge';
import { ErrorMonitor } from '@/components/dashboard/ErrorMonitor';
import { ErrorMonitorPanel } from '@/components/dashboard/ErrorMonitorPanel';
import { HubSpotSyncStatus } from '@/components/dashboard/HubSpotSyncStatus';

export default function Dashboard() {
  useRealtimeHealthScores();
  const navigate = useNavigate();
  const [filterMode, setFilterMode] = useState<'all' | 'high-risk' | 'early-warning'>('all');
  const [selectedCoach, setSelectedCoach] = useState('all');
  const [selectedZone, setSelectedZone] = useState('all');
  const [showAIPanel, setShowAIPanel] = useState(true);
  const [isRunningBI, setIsRunningBI] = useState(false);

  // Trigger Business Intelligence Agent
  const runBusinessIntelligence = async () => {
    setIsRunningBI(true);
    try {
      const { data, error } = await supabase.functions.invoke('business-intelligence');
      if (error) throw error;
      toast({
        title: 'BI Agent Complete',
        description: data?.analysis?.executive_summary || 'Analysis updated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'BI Agent Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsRunningBI(false);
    }
  };

  // Setup realtime subscription for new data notifications
  useEffect(() => {
    const channel = supabase
      .channel('health_scores_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_health_scores'
        },
        (payload) => {
          const newClients = Array.isArray(payload.new) ? payload.new : [payload.new];
          const highRiskCount = newClients.filter((c: any) =>
            c.risk_category === 'HIGH' || c.risk_category === 'CRITICAL'
          ).length;

          if (highRiskCount > 0) {
            toast({
              title: 'Health Scores Updated',
              description: `${highRiskCount} new high-risk client${highRiskCount > 1 ? 's' : ''} detected`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['client-health-scores'],
    queryFn: async () => {
      const { data: latestDate } = await supabase
        .from('client_health_scores')
        .select('calculated_on')
        .order('calculated_on', { ascending: false })
        .limit(1)
        .single();

      if (!latestDate?.calculated_on) return [];

      let query = supabase
        .from('client_health_scores')
        .select('*')
        .eq('calculated_on', latestDate.calculated_on);

      // Apply filters - using explicit any cast to avoid TypeScript recursion depth issues
      if (filterMode === 'high-risk') {
        query = (query as any).in('risk_category', ['HIGH', 'CRITICAL']);
      } else if (filterMode === 'early-warning') {
        query = (query as any).eq('early_warning_flag', true);
      }

      if (selectedCoach !== 'all') {
        query = (query as any).eq('assigned_coach', selectedCoach);
      }

      if (selectedZone !== 'all') {
        query = (query as any).eq('health_zone', selectedZone);
      }

      query = (query as any).order('predictive_risk_score', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data as any[] || [];
    },
    refetchInterval: 60000,
  });

  const { data: coaches, isLoading: coachesLoading } = useQuery({
    queryKey: ['coach-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coach_performance')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const { data: interventions, isLoading: interventionsLoading } = useQuery({
    queryKey: ['interventions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intervention_log')
        .select('*')
        .order('triggered_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const { data: summary } = useQuery({
    queryKey: ['daily-summary'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('daily_summary')
          .select('*')
          .order('summary_date', { ascending: false })
          .limit(1);

        if (error) {
          console.log('daily_summary query issue:', error.message);
          return null;
        }
        return data?.[0] || null;
      } catch {
        return null;
      }
    },
    refetchInterval: 60000,
  });

  const { data: patterns } = useQuery({
    queryKey: ['weekly-patterns'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('weekly_patterns')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.log('weekly_patterns not available:', error.message);
          return null;
        }
        return data?.[0] || null;
      } catch {
        return null;
      }
    },
    refetchInterval: 60000,
  });

  const isLoading = clientsLoading || coachesLoading || interventionsLoading;

  // Extract unique coaches for filter
  const uniqueCoaches = Array.from(
    new Set((clients || []).map((c) => c.assigned_coach).filter(Boolean))
  ) as string[];

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 p-4 sm:p-6 min-h-screen">
      {/* Main Dashboard Content */}
      <div className={`space-y-4 sm:space-y-6 flex-1 ${showAIPanel ? 'lg:max-w-[calc(100%-424px)]' : 'w-full'}`}>
        
        {/* Page Header - Clean alignment */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
              Client Health Intelligence Dashboard
            </h1>
            
            {/* Action Buttons Row - Properly aligned */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={runBusinessIntelligence}
                disabled={isRunningBI}
                className="gap-2 h-9 text-xs sm:text-sm"
              >
                <BrainCircuit className={`h-4 w-4 ${isRunningBI ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isRunningBI ? "Running..." : "Run BI Agent"}</span>
                <span className="sm:hidden">{isRunningBI ? "..." : "BI"}</span>
              </Button>
              
              <SyncStatusBadge />
              <HubSpotSyncStatus />
              
              <Button
                variant={showAIPanel ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAIPanel(!showAIPanel)}
                className="gap-2 h-9 text-xs sm:text-sm"
              >
                <Bot className="h-4 w-4" />
                <span className="hidden sm:inline">{showAIPanel ? "Hide AI" : "Show AI"}</span>
                <span className="sm:hidden">AI</span>
              </Button>
            </div>
          </div>
          
          {/* Subtitle */}
          <p className="text-xs sm:text-sm text-muted-foreground">
            Predictive Analytics • Real-time Updates
          </p>
        </div>

        {/* Error Monitor at top */}
        <ErrorMonitor />

        {/* Executive Briefing Component */}
        <ExecutiveBriefing summary={summary as any} />

        {/* Leak Detector - Shows hidden problems */}
        <LeakDetector />

        {/* Error Monitor Panel */}
        <ErrorMonitorPanel />

        {/* Quick Access to PTD Control Panel Features */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Command className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">PTD Control Panel</CardTitle>
                  <CardDescription className="text-xs">
                    Quick access to conversion tracking, automation & settings
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Button
                variant="outline"
                className="h-14 sm:h-16 flex flex-col gap-1 text-xs hover:bg-primary/5 hover:border-primary/30"
                onClick={() => navigate('/ptd-control')}
              >
                <Command className="h-4 w-4" />
                <span className="truncate">Control Panel</span>
              </Button>
              <Button
                variant="outline"
                className="h-14 sm:h-16 flex flex-col gap-1 text-xs hover:bg-primary/5 hover:border-primary/30"
                onClick={() => navigate('/meta-dashboard')}
              >
                <Activity className="h-4 w-4" />
                <span className="truncate">CAPI Events</span>
              </Button>
              <Button
                variant="outline"
                className="h-14 sm:h-16 flex flex-col gap-1 text-xs hover:bg-primary/5 hover:border-primary/30"
                onClick={() => navigate('/analytics')}
              >
                <TrendingUp className="h-4 w-4" />
                <span className="truncate">Analytics</span>
              </Button>
              <Button
                variant="outline"
                className="h-14 sm:h-16 flex flex-col gap-1 text-xs hover:bg-primary/5 hover:border-primary/30"
                onClick={() => navigate('/hubspot-live')}
              >
                <Zap className="h-4 w-4" />
                <span className="truncate">HubSpot Sync</span>
              </Button>
              <Button
                variant="outline"
                className="h-14 sm:h-16 flex flex-col gap-1 text-xs hover:bg-primary/5 hover:border-primary/30"
                onClick={() => navigate('/ptd-control?tab=settings')}
              >
                <Settings className="h-4 w-4" />
                <span className="truncate">Settings</span>
              </Button>
              <Button
                variant="outline"
                className="h-14 sm:h-16 flex flex-col gap-1 text-xs hover:bg-primary/5 hover:border-primary/30"
                onClick={() => window.open('https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds', '_blank')}
              >
                <Database className="h-4 w-4" />
                <span className="truncate">Supabase</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <PredictiveAlerts clients={clients || []} summary={summary} />

        <FilterControls
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          selectedCoach={selectedCoach}
          onCoachChange={setSelectedCoach}
          selectedZone={selectedZone}
          onZoneChange={setSelectedZone}
          coaches={uniqueCoaches}
        />

        <ClientRiskMatrix clients={clients || []} isLoading={isLoading} />

        <CoachPerformanceTable coaches={coaches || []} isLoading={isLoading} />

        <InterventionTracker interventions={interventions || []} isLoading={isLoading} />

        <PatternInsights patterns={patterns} clients={clients || []} />
      </div>

      {/* AI Assistant Panel - Right Sidebar */}
      {showAIPanel && (
        <div className="hidden lg:block w-[400px] shrink-0 sticky top-6 h-[calc(100vh-48px)]">
          <AIAssistantPanel />
        </div>
      )}

      {/* Mobile AI Panel as Sheet */}
      {showAIPanel && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">AI Assistant</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowAIPanel(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              <AIAssistantPanel />
            </div>
          </div>
        </div>
      )}

      {/* Floating AI Button when panel is hidden */}
      {!showAIPanel && (
        <AIAssistantButton onClick={() => setShowAIPanel(true)} />
      )}
    </div>
  );
}
