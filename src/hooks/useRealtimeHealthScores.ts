import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/config/queryKeys';

// Debounce time to batch rapid changes (ms)
// Optimized for instant feel while preventing overwhelming updates
const DEBOUNCE_MS = 300;

// Type for client health score record
interface ClientHealthScore {
  id?: string;
  email?: string;
  health_zone?: string;
  health_score?: number;
  [key: string]: unknown;
}

/**
 * Optimized real-time subscription hook
 * 
 * FIXES:
 * 1. Selective cache updates instead of full invalidation
 * 2. Debounced updates to batch rapid changes
 * 3. Direct cache updates for better performance
 */
export function useRealtimeHealthScores() {
  const queryClient = useQueryClient();
  const pendingUpdates = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    // Debounced invalidation to batch rapid changes
    const debouncedInvalidate = (key: readonly unknown[], debounceKey: string) => {
      const existing = pendingUpdates.current.get(debounceKey);
      if (existing) {
        clearTimeout(existing);
      }
      
      const timeout = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: key });
        pendingUpdates.current.delete(debounceKey);
      }, DEBOUNCE_MS);
      
      pendingUpdates.current.set(debounceKey, timeout);
    };

    // Update single client in cache without full refetch
    const updateClientInCache = (payload: { new: ClientHealthScore; old?: ClientHealthScore; eventType: string }) => {
      const newData = payload.new;
      const email = newData?.email;
      
      if (!email) {
        // Fallback to invalidation if no email
        debouncedInvalidate(QUERY_KEYS.clients.all, 'clients');
        return;
      }

      // Update specific client detail cache
      queryClient.setQueryData(
        QUERY_KEYS.clients.detail(email),
        (old: ClientHealthScore | undefined) => old ? { ...old, ...newData } : newData
      );

      // Update client in list caches (selective update)
      const updateListCache = (oldData: ClientHealthScore[] | undefined) => {
        if (!oldData || !Array.isArray(oldData)) return oldData;
        
        const index = oldData.findIndex((c: ClientHealthScore) => c.email === email);
        if (index === -1) {
          // New client - add to list
          return payload.eventType === 'INSERT' ? [...oldData, newData] : oldData;
        }
        
        if (payload.eventType === 'DELETE') {
          return oldData.filter((c: ClientHealthScore) => c.email !== email);
        }
        
        // Update existing client
        const updated = [...oldData];
        updated[index] = { ...updated[index], ...newData };
        return updated;
      };

      // Update dashboard cache
      queryClient.setQueryData(
        QUERY_KEYS.clients.healthScoresDashboard,
        updateListCache
      );

      // Only invalidate filtered queries if zone changed
      if (payload.old?.health_zone !== newData.health_zone) {
        // Zone changed - need to refetch filtered views
        debouncedInvalidate(QUERY_KEYS.clients.healthScores(), 'clients-filtered');
      }
    };

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
          console.log('Health scores changed:', payload.eventType, payload.new);
          
          // Use selective cache update instead of full invalidation
          updateClientInCache({
            new: payload.new as ClientHealthScore,
            old: payload.old as ClientHealthScore,
            eventType: payload.eventType
          });
          
          // Debounced daily summary update
          debouncedInvalidate(QUERY_KEYS.summaries.daily, 'daily-summary');
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
          console.log('Interventions changed:', payload.eventType);
          // Debounced invalidation for interventions
          debouncedInvalidate(QUERY_KEYS.interventions.all, 'interventions');
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
          console.log('Coach performance changed:', payload.eventType);
          // Debounced invalidation for coaches
          debouncedInvalidate(QUERY_KEYS.coaches.all, 'coaches');
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
          console.log('Weekly patterns changed:', payload.eventType);
          // Debounced invalidation for patterns
          debouncedInvalidate(QUERY_KEYS.patterns.weekly, 'patterns');
        }
      )
      .subscribe();

    return () => {
      // Clear all pending timeouts
      pendingUpdates.current.forEach((timeout) => clearTimeout(timeout));
      pendingUpdates.current.clear();
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
