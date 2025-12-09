import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
        .from('daily_summary')
        .select('calculation_date')
        .order('calculation_date', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.warn('Error fetching latest calculation date:', error);
        return null;
      }

      return data?.calculation_date || null;
    },
    refetchInterval: QUERY_INTERVALS.STANDARD,
    staleTime: 60000, // Consider data fresh for 1 minute
  });
}
