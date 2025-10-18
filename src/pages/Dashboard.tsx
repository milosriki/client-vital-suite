import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeHealthScores } from '@/hooks/useRealtimeHealthScores';
import { ClientRiskMatrix } from '@/components/dashboard/ClientRiskMatrix';
import { PredictiveAlerts } from '@/components/dashboard/PredictiveAlerts';
import { CoachPerformanceTable } from '@/components/dashboard/CoachPerformanceTable';
import { InterventionTracker } from '@/components/dashboard/InterventionTracker';
import { PatternInsights } from '@/components/dashboard/PatternInsights';
import { useEffect } from 'react';

export default function Dashboard() {
  useRealtimeHealthScores();

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      window.location.reload();
    }, 60000);
    return () => clearInterval(interval);
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

      const { data, error } = await supabase
        .from('client_health_scores')
        .select('*')
        .eq('calculated_on', latestDate.calculated_on)
        .order('churn_risk_score', { ascending: false });

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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Client Health Intelligence Dashboard</h1>
        <div className="text-sm text-muted-foreground">Auto-refreshing every 60s</div>
      </div>

      <PredictiveAlerts clients={clients || []} summary={summary} />

      <ClientRiskMatrix clients={clients || []} isLoading={isLoading} />

      <CoachPerformanceTable coaches={coaches || []} isLoading={isLoading} />

      <InterventionTracker interventions={interventions || []} isLoading={isLoading} />

      <PatternInsights patterns={patterns} clients={clients || []} />
    </div>
  );
}
