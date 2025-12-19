import { supabase } from '@/integrations/supabase/client';
import { QUERY_INTERVALS } from '@/config/queryConfig';
import { QUERY_KEYS } from '@/config/queryKeys';
import { useDedupedQuery } from '@/hooks/useDedupedQuery';

/**
 * Centralized hook to fetch the latest calculation date
 * Eliminates duplicate queries across Dashboard, Overview, and other pages
 *
 * Usage:
 * const { data: latestDate, isLoading } = useLatestCalculationDate();
 *
 * Benefits:
 * - Single source of truth for latest date
 * - Automatic cache sharing across components
 * - Reduced database queries
 */
export function useLatestCalculationDate() {
  return useDedupedQuery({
    queryKey: QUERY_KEYS.calculation.latestDate,
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_health_scores')
        .select('calculated_at')
        .order('calculated_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.warn('Error fetching latest calculation date:', error);
        return null;
      }

      return data?.calculated_at || null;
    },
    staleTime: Infinity, // Real-time updates via useVitalState
  });
}
