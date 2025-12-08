import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { QUERY_CONFIGS } from '@/config/queryConfig';

/**
 * Hook to fetch the most recent calculation date from client_health_scores
 * This ensures all components use the same latest snapshot of data
 * 
 * @returns The latest calculated_on date or null if no data exists
 */
export function useLatestCalculationDate() {
  return useQuery<string | null>({
    queryKey: ['latest-calculation-date'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_health_scores')
        .select('calculated_on')
        .order('calculated_on', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // If no data exists yet, return null instead of throwing
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data?.calculated_on || null;
    },
    ...QUERY_CONFIGS.healthScores,
  });
}
