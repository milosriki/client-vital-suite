import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

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
          // Invalidate relevant queries to refetch data
          queryClient.invalidateQueries({ queryKey: ['client-health-scores'] });
          queryClient.invalidateQueries({ queryKey: ['daily-summary'] });
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
          queryClient.invalidateQueries({ queryKey: ['interventions'] });
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
          queryClient.invalidateQueries({ queryKey: ['coach-performance'] });
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
          queryClient.invalidateQueries({ queryKey: ['weekly-patterns'] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [queryClient]);
}
