import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_INTERVALS } from '@/config/queryConfig';

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
  return useQuery({
    queryKey: ['latest-calculation-date'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_health_scores')
        .select('calculated_on')
        .order('calculated_on', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('Error fetching latest calculation date:', error);
        return null;
      }

      return data?.calculated_on || null;
    },
    refetchInterval: QUERY_INTERVALS.STANDARD, // Refresh every 2 minutes
    staleTime: 30000, // Data stays fresh for 30 seconds
  });
}
