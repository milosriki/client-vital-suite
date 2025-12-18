import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/config/queryKeys';

export function useRealtimeHealthScores() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('health_scores_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'client_health_scores'
        },
        (payload) => {
          console.log('Health scores changed:', payload);
          // Invalidate ALL client health score queries (all filters)
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clients.all });
          // Invalidate daily summary
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.summaries.daily });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'intervention_log'
        },
        (payload) => {
          console.log('Interventions changed:', payload);
          // Invalidate ALL intervention queries
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interventions.all });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coach_performance'
        },
        (payload) => {
          console.log('Coach performance changed:', payload);
          // Invalidate ALL coach queries
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.coaches.all });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'weekly_patterns'
        },
        (payload) => {
          console.log('Weekly patterns changed:', payload);
          // Invalidate ALL pattern queries
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.patterns.weekly });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
