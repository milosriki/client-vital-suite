import { EnhancedInterventionTracker } from './EnhancedInterventionTracker';
import { supabase } from '@/integrations/supabase/client';
import { useDedupedQuery } from '@/hooks/useDedupedQuery';
import { QUERY_KEYS } from '@/config/queryKeys';

export function DashboardInterventionTracker() {
  const { data: interventions = [], isLoading } = useDedupedQuery({
    queryKey: QUERY_KEYS.interventions.all,
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intervention_log')
        .select('*')
        .order('priority', { ascending: true })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    staleTime: Infinity,
  });

  return (
    <EnhancedInterventionTracker
      interventions={interventions as any[]}
      isLoading={isLoading}
    />
  );
}
