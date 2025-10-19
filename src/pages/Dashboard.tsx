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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Command, Activity, Settings, Zap, TrendingUp, Database } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function Dashboard() {
  useRealtimeHealthScores();
  const navigate = useNavigate();
  const [filterMode, setFilterMode] = useState<'all' | 'high-risk' | 'early-warning'>('all');
  const [selectedCoach, setSelectedCoach] = useState('all');
  const [selectedZone, setSelectedZone] = useState('all');

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

      // Apply filters
      if (filterMode === 'high-risk') {
        query = query.in('risk_category', ['HIGH', 'CRITICAL']);
      } else if (filterMode === 'early-warning') {
        query = query.eq('early_warning_flag', true);
      }

      if (selectedCoach !== 'all') {
        query = query.eq('assigned_coach', selectedCoach);
      }

      if (selectedZone !== 'all') {
        query = query.eq('health_zone', selectedZone);
      }

      query = query.order('predictive_risk_score', { ascending: false });

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
      const { data, error } = await supabase
        .from('daily_summary')
        .select('*')
        .order('summary_date', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const { data: patterns } = useQuery({
    queryKey: ['weekly-patterns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('weekly_patterns')
        .select('*')
        .order('week_start_date', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });

  const isLoading = clientsLoading || coachesLoading || interventionsLoading;

  // Extract unique coaches for filter
  const uniqueCoaches = Array.from(
    new Set((clients || []).map((c) => c.assigned_coach).filter(Boolean))
  ) as string[];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Client Health Intelligence Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          Predictive Analytics • Real-time Updates
        </div>
      </div>

      {/* Quick Access to PTD Control Panel Features */}
      <Card className="bg-gradient-to-r from-primary/5 via-primary/3 to-background border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            PTD Control Panel
          </CardTitle>
          <CardDescription>
            Quick access to conversion tracking, automation, and system settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2"
              onClick={() => navigate('/ptd-control')}
            >
              <Command className="h-5 w-5" />
              <span className="text-xs">Full Control Panel</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2"
              onClick={() => navigate('/meta-dashboard')}
            >
              <Activity className="h-5 w-5" />
              <span className="text-xs">CAPI Events</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2"
              onClick={() => navigate('/analytics')}
            >
              <TrendingUp className="h-5 w-5" />
              <span className="text-xs">Analytics</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2"
              onClick={() => navigate('/fix-workflows')}
            >
              <Zap className="h-5 w-5" />
              <span className="text-xs">Automation</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2"
              onClick={() => navigate('/ptd-control?tab=settings')}
            >
              <Settings className="h-5 w-5" />
              <span className="text-xs">Settings</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2"
              onClick={() => window.open('https://boowptjtwadxpjkpctna.supabase.co', '_blank')}
            >
              <Database className="h-5 w-5" />
              <span className="text-xs">Supabase</span>
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
  );
}
