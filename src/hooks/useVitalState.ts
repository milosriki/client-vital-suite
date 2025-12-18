import { useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/config/queryKeys';
import { useDedupedQuery } from '@/hooks/useDedupedQuery';
import { toast } from '@/hooks/use-toast';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Central state management hook for the "Living Being" architecture.
 * 
 * This hook manages the global pulse of the application, ensuring that
 * when one part updates (e.g., a new Stripe payment, HubSpot sync, or
 * client health change), it instantly reflects across all dashboard
 * components without requiring a hard refresh.
 * 
 * Features:
 * - Real-time subscriptions to critical tables
 * - Automatic cache invalidation on data changes
 * - Circuit breaker alert notifications
 * - Unified system health status
 * - Cross-component state synchronization
 * 
 * Usage:
 * const { systemHealth, invalidateAll, isConnected } = useVitalState();
 */

interface VitalSystemHealth {
  isHealthy: boolean;
  lastSyncTime: string | null;
  activeErrors: number;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  circuitBreakerTripped: boolean;
}

interface VitalStateReturn {
  systemHealth: VitalSystemHealth;
  isLoading: boolean;
  isConnected: boolean;
  invalidateAll: () => void;
  invalidateDashboard: () => void;
  invalidatePipeline: () => void;
  invalidateClients: () => void;
  refreshSystemHealth: () => void;
}

export function useVitalState(): VitalStateReturn {
  const queryClient = useQueryClient();

  // Fetch system health status (no polling - real-time only)
  const { data: healthData, isLoading, refetch: refreshSystemHealth } = useDedupedQuery({
    queryKey: QUERY_KEYS.system.health,
    dedupeIntervalMs: 1000,
    queryFn: async () => {
      // Get last sync time
      const { data: lastSync } = await supabase
        .from('sync_logs')
        .select('completed_at')
        .eq('status', 'success')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

      // Get active error count
      const { count: errorCount } = await supabase
        .from('sync_errors')
        .select('*', { count: 'exact', head: true })
        .is('resolved_at', null);

      // Check for circuit breaker trips
      const { data: circuitBreakerErrors } = await supabase
        .from('sync_errors')
        .select('id')
        .eq('error_type', 'circuit_breaker_trip')
        .is('resolved_at', null)
        .limit(1);

      return {
        lastSyncTime: lastSync?.completed_at || null,
        activeErrors: errorCount || 0,
        circuitBreakerTripped: (circuitBreakerErrors?.length || 0) > 0,
      };
    },
    staleTime: Infinity, // Never stale - rely on real-time updates
  });

  // Set up real-time subscriptions for critical tables
  useEffect(() => {
    const channels: RealtimeChannel[] = [];

    // Subscribe to client_health_scores changes
    const healthScoresChannel = supabase
      .channel('vital-health-scores')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_health_scores' },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clients.all });
          queryClient.invalidateQueries({ queryKey: ['client-health-scores-dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['clients-analytics'] });
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard.batch({}) });
        }
      )
      .subscribe();
    channels.push(healthScoresChannel);

    // Subscribe to deals changes (for revenue updates)
    const dealsChannel = supabase
      .channel('vital-deals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deals' },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.revenue.chart });
          queryClient.invalidateQueries({ queryKey: ['monthly-revenue'] });
          queryClient.invalidateQueries({ queryKey: ['pipeline-value'] });
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipeline.deals.summary() });
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard.batch({}) });
        }
      )
      .subscribe();
    channels.push(dealsChannel);

    // Subscribe to intervention_log changes
    const interventionsChannel = supabase
      .channel('vital-interventions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'intervention_log' },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interventions.all });
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.interventions.dashboard });
        }
      )
      .subscribe();
    channels.push(interventionsChannel);

    // Subscribe to sync_errors changes - CRITICAL for circuit breaker alerts
    const errorsChannel = supabase
      .channel('vital-sync-errors')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sync_errors' },
        (payload) => {
          const newError = payload.new as { error_type?: string; error_message?: string; source?: string };
          
          // Show toast for circuit breaker trips
          if (newError.error_type === 'circuit_breaker_trip') {
            toast({
              title: 'Circuit Breaker Tripped',
              description: `${newError.source || 'HubSpot'} sync has been paused due to repeated failures. ${newError.error_message || ''}`,
              variant: 'destructive',
              duration: 10000,
            });
          }
          
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sync.errors.all });
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.system.health });
        }
      )
      .subscribe();
    channels.push(errorsChannel);

    // Subscribe to sync_logs changes
    const logsChannel = supabase
      .channel('vital-sync-logs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sync_logs' },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sync.logs });
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sync.lastTime });
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.system.health });
        }
      )
      .subscribe();
    channels.push(logsChannel);

    // Subscribe to contacts changes (HubSpot)
    const contactsChannel = supabase
      .channel('vital-contacts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipeline.contacts.all() });
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.hubspot.contacts.latest });
          queryClient.invalidateQueries({ queryKey: ['leads-today'] });
        }
      )
      .subscribe();
    channels.push(contactsChannel);

    // Subscribe to call_records changes
    const callsChannel = supabase
      .channel('vital-calls')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'call_records' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['calls-today'] });
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipeline.calls.records() });
        }
      )
      .subscribe();
    channels.push(callsChannel);

    // Subscribe to daily_summary changes
    const summaryChannel = supabase
      .channel('vital-daily-summary')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_summary' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['daily-summary-briefing'] });
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.summaries.daily });
        }
      )
      .subscribe();
    channels.push(summaryChannel);

    // Cleanup subscriptions on unmount
    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [queryClient]);

  // Compute system health status
  const systemHealth = useMemo<VitalSystemHealth>(() => {
    const isHealthy = (healthData?.activeErrors || 0) === 0 && !healthData?.circuitBreakerTripped;
    
    return {
      isHealthy,
      lastSyncTime: healthData?.lastSyncTime || null,
      activeErrors: healthData?.activeErrors || 0,
      connectionStatus: 'connected',
      circuitBreakerTripped: healthData?.circuitBreakerTripped || false,
    };
  }, [healthData]);

  // Invalidation helpers for targeted cache clearing
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  const invalidateDashboard = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard.batch({}) });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard.alerts });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.summaries.daily });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.summaries.todaySnapshot });
    queryClient.invalidateQueries({ queryKey: ['client-health-scores-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['daily-summary-briefing'] });
    queryClient.invalidateQueries({ queryKey: ['monthly-revenue'] });
    queryClient.invalidateQueries({ queryKey: ['pipeline-value'] });
  }, [queryClient]);

  const invalidatePipeline = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipeline.leads.all() });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipeline.deals.summary() });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipeline.contacts.all() });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipeline.calls.records() });
  }, [queryClient]);

  const invalidateClients = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clients.all });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clients.healthScores() });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clients.healthStats });
    queryClient.invalidateQueries({ queryKey: ['client-health-scores-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['clients-analytics'] });
  }, [queryClient]);

  return {
    systemHealth,
    isLoading,
    isConnected: true,
    invalidateAll,
    invalidateDashboard,
    invalidatePipeline,
    invalidateClients,
    refreshSystemHealth,
  };
}

/**
 * Hook to subscribe to specific table changes with custom handlers.
 * Use this for components that need fine-grained control over real-time updates.
 * 
 * Usage:
 * useVitalSubscription('deals', (payload) => {
 *   console.log('Deal changed:', payload);
 * });
 */
export function useVitalSubscription(
  table: string,
  onUpdate: (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => void
) {
  useEffect(() => {
    const channel = supabase
      .channel(`vital-custom-${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          onUpdate({
            new: payload.new as Record<string, unknown>,
            old: payload.old as Record<string, unknown>,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, onUpdate]);
}
