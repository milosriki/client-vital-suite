import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeHealthScores } from '@/hooks/useRealtimeHealthScores';
import { ClientRiskMatrix } from '@/components/dashboard/ClientRiskMatrix';
import { PredictiveAlerts } from '@/components/dashboard/PredictiveAlerts';
import { CoachPerformanceTable } from '@/components/dashboard/CoachPerformanceTable';
import { InterventionTracker } from '@/components/dashboard/InterventionTracker';
import { PatternInsights } from '@/components/dashboard/PatternInsights';
import { FilterControls } from '@/components/dashboard/FilterControls';
import { toast } from '@/hooks/use-toast';

export default function Dashboard() {
  useRealtimeHealthScores();
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
