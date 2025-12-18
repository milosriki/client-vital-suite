import { supabase } from '@/integrations/supabase/client';
import type { ClientHealthScore } from '@/types/database';
import { QUERY_KEYS } from '@/config/queryKeys';
import { useDedupedQuery } from '@/hooks/useDedupedQuery';

interface UseClientHealthScoresOptions {
  healthZone?: string;
  segment?: string;
  coach?: string;
  autoRefresh?: boolean;
}

export function useClientHealthScores(options: UseClientHealthScoresOptions = {}) {
  const { healthZone, segment, coach, autoRefresh = true } = options;

  return useDedupedQuery<ClientHealthScore[]>({
    queryKey: QUERY_KEYS.clients.healthScores({ healthZone, segment, coach }),
    dedupeIntervalMs: 1000, // Prevent duplicate calls within 1 second
    queryFn: async () => {
      // Get the most recent calculated_on date
      const { data: latestDate } = await supabase
        .from('client_health_scores')
        .select('calculated_on')
        .order('calculated_on', { ascending: false })
        .limit(1)
        .single();

      if (!latestDate?.calculated_on) {
        return [];
      }

      let query = supabase
        .from('client_health_scores')
        .select('*')
        .eq('calculated_on', latestDate.calculated_on)
        .order('health_score', { ascending: true });

      if (healthZone && healthZone !== 'All') {
        query = query.eq('health_zone', healthZone);
      }
      if (segment && segment !== 'All') {
        query = query.eq('client_segment', segment);
      }
      if (coach && coach !== 'All') {
        query = query.eq('assigned_coach', coach);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data as unknown as ClientHealthScore[]) || [];
    },
    staleTime: Infinity, // Real-time updates via useVitalState
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
  });
}
