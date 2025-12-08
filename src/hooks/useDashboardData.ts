import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { QUERY_CONFIGS } from '@/config/queryConfig';
import { useLatestCalculationDate } from './useLatestCalculationDate';

/**
 * Centralized hook for fetching all dashboard-related data
 * Uses the latest calculation date to ensure data consistency
 */
export function useDashboardData(filters?: {
  healthZone?: string;
  segment?: string;
  coach?: string;
  filterMode?: 'all' | 'high-risk' | 'early-warning';
}) {
  const { data: latestDate } = useLatestCalculationDate();

  // Client health scores with filters
  const clientsQuery = useQuery({
    queryKey: ['dashboard-clients', latestDate, filters],
    queryFn: async () => {
      if (!latestDate) return [];

      let query = supabase
        .from('client_health_scores')
        .select('*')
        .eq('calculated_on', latestDate);

      // Apply filters
      if (filters?.filterMode === 'high-risk') {
        query = query.in('risk_category', ['HIGH', 'CRITICAL']);
      } else if (filters?.filterMode === 'early-warning') {
        query = query.eq('early_warning_flag', true);
      }

      if (filters?.coach && filters.coach !== 'all') {
        query = query.eq('assigned_coach', filters.coach);
      }

      if (filters?.healthZone && filters.healthZone !== 'all') {
        query = query.eq('health_zone', filters.healthZone);
      }

      if (filters?.segment && filters.segment !== 'All') {
        query = query.eq('client_segment', filters.segment);
      }

      query = query.order('predictive_risk_score', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    ...QUERY_CONFIGS.healthScores,
    enabled: !!latestDate,
  });

  // Coach performance data
  const coachesQuery = useQuery({
    queryKey: ['dashboard-coaches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coach_performance')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    ...QUERY_CONFIGS.coachPerformance,
  });

  // Recent interventions
  const interventionsQuery = useQuery({
    queryKey: ['dashboard-interventions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intervention_log')
        .select('*')
        .order('triggered_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    ...QUERY_CONFIGS.interventions,
  });

  // Daily summary
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
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
    ...QUERY_CONFIGS.dailySummary,
  });

  // Weekly patterns
  const patternsQuery = useQuery({
    queryKey: ['dashboard-patterns'],
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
    ...QUERY_CONFIGS.analytics,
  });

  return {
    clients: clientsQuery.data || [],
    coaches: coachesQuery.data || [],
    interventions: interventionsQuery.data || [],
    summary: summaryQuery.data,
    patterns: patternsQuery.data,
    isLoading:
      clientsQuery.isLoading ||
      coachesQuery.isLoading ||
      interventionsQuery.isLoading,
    isError:
      clientsQuery.isError ||
      coachesQuery.isError ||
      interventionsQuery.isError,
    latestDate,
  };
}
