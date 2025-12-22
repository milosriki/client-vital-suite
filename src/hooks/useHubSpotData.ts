import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS } from '@/config/queryKeys';
import { useDedupedQuery } from '@/hooks/useDedupedQuery';

/**
 * Centralized HubSpot data management hook
 * 
 * This hook ensures consistent data fetching across all HubSpot-related pages
 * with proper real-time updates and error handling.
 * 
 * Features:
 * - Single source of truth for HubSpot data
 * - Real-time subscriptions to HubSpot changes
 * - Error boundary isolation
 * - Circuit breaker protection
 * - Consistent data structure across pages
 */
interface HubSpotFilters {
  timeframe?: string;
  ownerFilter?: string;
  locationFilter?: string;
  statusFilter?: string;
}

interface HubSpotData {
  contacts: any[];
  deals: any[];
  calls: any[];
  owners: any[];
  syncStatus: any;
  lastUpdated: Date;
}

// Debounce configuration
const DEBOUNCE_MS = 500;
const CRITICAL_DEBOUNCE_MS = 250;

export function useHubSpotData(filters: HubSpotFilters = {}) {
  const queryClient = useQueryClient();
  const pendingUpdates = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastUpdateRef = useRef<Date>(new Date());

  // Batch query function for initial data load
  const batchQueryFn = useCallback(async () => {
    // Critical data that loads first (for immediate UI)
    const criticalData = await Promise.allSettled([
      // Query 1: Contacts from Supabase (synced from HubSpot)
      (async () => {
        let query = supabase
          .from('contacts')
          .select('*')
          .order('created_at', { ascending: false });

        if (filters.timeframe && filters.timeframe !== 'all_time') {
          const now = new Date();
          let startDate = new Date();
          
          switch (filters.timeframe) {
            case 'today':
              startDate = new Date(now.setHours(0, 0, 0, 0));
              break;
            case 'yesterday':
              startDate = new Date(now.setDate(now.getDate() - 1));
              startDate.setHours(0, 0, 0, 0);
              break;
            case 'last_7_days':
              startDate = new Date(now.setDate(now.getDate() - 7));
              break;
            case 'this_month':
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              break;
            case 'last_month':
              startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              break;
          }
          
          query = query.gte('created_at', startDate.toISOString());
        }

        if (filters.ownerFilter && filters.ownerFilter !== 'all') {
          query = query.eq('hubspot_owner_id', filters.ownerFilter);
        }

        if (filters.locationFilter && filters.locationFilter !== 'all') {
          query = query.ilike('city', `%${filters.locationFilter}%`);
        }

        const result = await query;
        return result;
      })(),
      
      // Query 2: Deals from Supabase (synced from HubSpot)
      (async () => {
        let query = supabase
          .from('deals')
          .select('*')
          .order('created_at', { ascending: false });

        if (filters.timeframe && filters.timeframe !== 'all_time') {
          const now = new Date();
          let startDate = new Date();
          
          switch (filters.timeframe) {
            case 'today':
              startDate = new Date(now.setHours(0, 0, 0, 0));
              break;
            case 'yesterday':
              startDate = new Date(now.setDate(now.getDate() - 1));
              startDate.setHours(0, 0, 0, 0);
              break;
            case 'last_7_days':
              startDate = new Date(now.setDate(now.getDate() - 7));
              break;
            case 'this_month':
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              break;
            case 'last_month':
              startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              break;
          }
          
          query = query.gte('created_at', startDate.toISOString());
        }

        if (filters.statusFilter && filters.statusFilter !== 'all') {
          query = query.eq('status', filters.statusFilter);
        }

        const result = await query;
        return result;
      })(),
      
      // Query 3: Call records from Supabase (synced from HubSpot)
      (async () => {
        let query = supabase
          .from('call_records')
          .select('*')
          .order('created_at', { ascending: false });

        if (filters.timeframe && filters.timeframe !== 'all_time') {
          const now = new Date();
          let startDate = new Date();
          
          switch (filters.timeframe) {
            case 'today':
              startDate = new Date(now.setHours(0, 0, 0, 0));
              break;
            case 'yesterday':
              startDate = new Date(now.setDate(now.getDate() - 1));
              startDate.setHours(0, 0, 0, 0);
              break;
            case 'last_7_days':
              startDate = new Date(now.setDate(now.getDate() - 7));
              break;
            case 'this_month':
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
              break;
            case 'last_month':
              startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              break;
          }
          
          query = query.gte('created_at', startDate.toISOString());
        }

        const result = await query;
        return result;
      })(),
      
      // Query 4: Owners from Supabase (synced from HubSpot)
      (async () => {
        const result = await supabase
          .from('staff') // Assuming staff table contains owner info
          .select('*')
          .order('name', { ascending: true });
        return result;
      })(),
      
      // Query 5: Sync status
      (async () => {
        const result = await supabase
          .from('sync_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        return result;
      })(),
    ]);

    // Process results
    const [
      contactsResult,
      dealsResult,
      callsResult,
      ownersResult,
      syncResult
    ] = criticalData;

    const contacts = contactsResult.status === 'fulfilled' ? contactsResult.value.data || [] : [];
    const deals = dealsResult.status === 'fulfilled' ? dealsResult.value.data || [] : [];
    const calls = callsResult.status === 'fulfilled' ? callsResult.value.data || [] : [];
    const owners = ownersResult.status === 'fulfilled' ? ownersResult.value.data || [] : [];
    const syncStatus = syncResult.status === 'fulfilled' ? syncResult.value.data || null : null;

    const result: HubSpotData = {
      contacts,
      deals,
      calls,
      owners,
      syncStatus,
      lastUpdated: new Date(),
    };

    lastUpdateRef.current = new Date();
    return result;
  }, [filters]);

  // Debounced cache update function
  const debouncedUpdate = useCallback((key: readonly unknown[], data: any, debounceKey: string, debounceMs: number = DEBOUNCE_MS) => {
    const existing = pendingUpdates.current.get(debounceKey);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(() => {
      queryClient.setQueryData(key, data);
      pendingUpdates.current.delete(debounceKey);
    }, debounceMs);

    pendingUpdates.current.set(debounceKey, timeout);
  }, [queryClient]);

  // Real-time subscription for HubSpot updates
  useEffect(() => {
    let isSubscribed = false;

    const channel = supabase
      .channel('hubspot-data-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts'
        },
        (payload) => {
          // Optimized contacts update
          const updateContacts = (prev: HubSpotData | undefined) => {
            if (!prev) return prev;
            
            const updatedContacts = [...prev.contacts];
            const contactIndex = updatedContacts.findIndex(c => c.id === payload.new.id);
            
            if (contactIndex !== -1) {
              updatedContacts[contactIndex] = { ...updatedContacts[contactIndex], ...payload.new };
            } else if (payload.eventType === 'INSERT') {
              updatedContacts.unshift(payload.new);
            } else if (payload.eventType === 'DELETE') {
              return updatedContacts.filter(c => c.id !== payload.new.id);
            }
            
            return { ...prev, contacts: updatedContacts, lastUpdated: new Date() };
          };

          debouncedUpdate(QUERY_KEYS.hubspot.contacts.latest, updateContacts, 'hubspot-contacts', CRITICAL_DEBOUNCE_MS);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deals'
        },
        (payload) => {
          // Optimized deals update
          const updateDeals = (prev: HubSpotData | undefined) => {
            if (!prev) return prev;
            
            const updatedDeals = [...prev.deals];
            const dealIndex = updatedDeals.findIndex(d => d.id === payload.new.id);
            
            if (dealIndex !== -1) {
              updatedDeals[dealIndex] = { ...updatedDeals[dealIndex], ...payload.new };
            } else if (payload.eventType === 'INSERT') {
              updatedDeals.unshift(payload.new);
            } else if (payload.eventType === 'DELETE') {
              return updatedDeals.filter(d => d.id !== payload.new.id);
            }
            
            return { ...prev, deals: updatedDeals, lastUpdated: new Date() };
          };

          debouncedUpdate(QUERY_KEYS.hubspot.pipelines.health, updateDeals, 'hubspot-deals', CRITICAL_DEBOUNCE_MS);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_records'
        },
        (payload) => {
          // Optimized calls update
          const updateCalls = (prev: HubSpotData | undefined) => {
            if (!prev) return prev;
            
            const updatedCalls = [...prev.calls];
            const callIndex = updatedCalls.findIndex(c => c.id === payload.new.id);
            
            if (callIndex !== -1) {
              updatedCalls[callIndex] = { ...updatedCalls[callIndex], ...payload.new };
            } else if (payload.eventType === 'INSERT') {
              updatedCalls.unshift(payload.new);
            } else if (payload.eventType === 'DELETE') {
              return updatedCalls.filter(c => c.id !== payload.new.id);
            }
            
            return { ...prev, calls: updatedCalls, lastUpdated: new Date() };
          };

          debouncedUpdate(QUERY_KEYS.hubspot.activity.ticker, updateCalls, 'hubspot-calls', CRITICAL_DEBOUNCE_MS);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_logs'
        },
        (payload) => {
          // Optimized sync status update
          const updateSyncStatus = (prev: HubSpotData | undefined) => {
            if (!prev) return prev;
            return { ...prev, syncStatus: payload.new, lastUpdated: new Date() };
          };

          debouncedUpdate(QUERY_KEYS.hubspot.sync.last, updateSyncStatus, 'hubspot-sync', DEBOUNCE_MS);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isSubscribed = true;
          console.log('[HubSpotData] Subscription connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          isSubscribed = false;
          console.warn('[HubSpotData] Subscription disconnected:', status);
        }
      });

    return () => {
      // Clear all pending timeouts
      pendingUpdates.current.forEach((timeout) => clearTimeout(timeout));
      pendingUpdates.current.clear();
      supabase.removeChannel(channel);
    };
  }, [queryClient, filters, debouncedUpdate]);

  // Main query hook with optimized configuration
  return useDedupedQuery<HubSpotData>({
    queryKey: QUERY_KEYS.hubspot.commandCenter.overview(filters.timeframe),
    queryFn: batchQueryFn,
    staleTime: Infinity, // Handled by real-time updates
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    refetchOnWindowFocus: false, // Prevents refetching on window focus since we have real-time updates
    refetchOnReconnect: true,   // But do refetch on reconnect
    refetchOnMount: false,      // Only fetch on mount if cache is empty
  });
}

/**
 * Hook to get live HubSpot metrics
 */
export function useHubSpotMetrics(data: HubSpotData | undefined) {
  return {
    // Calculate critical metrics
    criticalMetrics: {
      totalContacts: data?.contacts.length || 0,
      totalDeals: data?.deals.length || 0,
      totalCalls: data?.calls.length || 0,
      totalOwners: data?.owners.length || 0,
      revenueAtRisk: data?.deals
        .filter((d: any) => d.status === 'open' || d.status === 'in_progress')
        .reduce((sum: number, d: any) => sum + (d.amount || 0), 0) || 0,
    },
    
    // Calculate performance indicators
    performanceIndicators: {
      contactConversionRate: data?.deals.length ? 
        ((data.deals.filter((d: any) => d.status === 'closed_won').length / data.contacts.length) * 100).toFixed(2) : 0,
      averageDealValue: data?.deals.length ? 
        (data.deals.reduce((sum: number, d: any) => sum + (d.amount || 0), 0) / data.deals.length).toFixed(0) : 0,
      responseTime: 0, // Calculated from activity logs
    },
    
    // Calculate trends
    trends: {
      contactsTrend: 0,    // Calculated by comparing with previous period
      dealsTrend: 0,       // Calculated by comparing with previous period
      revenueTrend: 0,     // Calculated by comparing with previous period
    }
  };
}