import { supabase } from '@/integrations/supabase/client';
import type { ClientHealthScore } from '@/types/database';
import { QUERY_KEYS } from '@/config/queryKeys';
import { useDedupedQuery } from '@/hooks/useDedupedQuery';

interface UseClientHealthScoresOptions {
  healthZone?: string;
  segment?: string;
  coach?: string;
  autoRefresh?: boolean;
  page?: number;
  pageSize?: number;
  searchTerm?: string;
}

export function useClientHealthScores(options: UseClientHealthScoresOptions = {}) {
  const { healthZone, segment, coach, page = 1, pageSize = 20, searchTerm = '', autoRefresh = true } = options;

  return useDedupedQuery<{ data: ClientHealthScore[], count: number }>({
    queryKey: QUERY_KEYS.clients.healthScores({ healthZone, segment, coach, page, pageSize, searchTerm }),
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      // Get the most recent calculated_on date
      const { data: latestDate } = await supabase
        .from('client_health_scores')
        .select('calculated_on')
        .order('calculated_on', { ascending: false })
        .limit(1)
        .single();

      if (!latestDate?.calculated_on) {
        return { data: [], count: 0 };
      }

      let query = supabase
        .from('client_health_scores')
        .select('*', { count: 'exact' })
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
      
      if (searchTerm) {
        // Search across multiple columns
        query = query.or(`firstname.ilike.%${searchTerm}%,lastname.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error, count } = await query.range(from, to);
      
      if (error) throw error;
      return { data: (data as unknown as ClientHealthScore[]) || [], count: count || 0 };
    },
    staleTime: Infinity, // Real-time updates via useVitalState
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
  });
}
