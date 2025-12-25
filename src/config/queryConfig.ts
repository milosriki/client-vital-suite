/**
 * Standardized Query Configuration
 * 
 * IMPORTANT: Living Being Architecture
 * =====================================
 * This application uses REAL-TIME WebSocket subscriptions via Supabase
 * instead of polling. The `useVitalState` hook manages global subscriptions
 * and automatically invalidates React Query cache when database changes occur.
 * 
 * DO NOT ADD `refetchInterval` TO QUERIES.
 * 
 * Instead, use `staleTime: Infinity` and let the real-time subscriptions
 * handle cache invalidation. This reduces database load and provides
 * instant UI updates when data changes.
 *
 * For query keys documentation, see /src/config/queryKeys.ts
 */

// Re-export QUERY_KEYS for convenience (import from either file)
export { QUERY_KEYS } from './queryKeys';

/**
 * @deprecated - DO NOT USE POLLING INTERVALS
 * 
 * These intervals are kept for backwards compatibility only.
 * New code should use `staleTime: Infinity` and rely on
 * real-time subscriptions via `useVitalState`.
 */
export const QUERY_INTERVALS = {
  // DEPRECATED: Use staleTime: Infinity instead
  CRITICAL: 30000,
  STANDARD: 120000,
  ANALYTICAL: 300000,
  
  // Use this for all queries - real-time handles updates
  STATIC: Infinity,
} as const;

/**
 * @deprecated - DO NOT USE QUERY MODES WITH POLLING
 * 
 * These helpers are kept for backwards compatibility only.
 * New code should use `staleTime: Infinity` directly.
 */
export const queryMode = {
  /**
   * @deprecated Use staleTime: Infinity instead
   */
  critical: (_enabled = true) => ({
    staleTime: Infinity, // Real-time subscriptions handle updates
  }),

  /**
   * @deprecated Use staleTime: Infinity instead
   */
  standard: (_enabled = true) => ({
    staleTime: Infinity, // Real-time subscriptions handle updates
  }),

  /**
   * @deprecated Use staleTime: Infinity instead
   */
  analytical: (_enabled = true) => ({
    staleTime: Infinity, // Real-time subscriptions handle updates
  }),

  /**
   * Recommended: Static mode with real-time updates
   */
  static: () => ({
    staleTime: Infinity, // Real-time subscriptions handle updates
  }),
};

/**
 * Usage examples (Living Being Architecture):
 *
 * // Using standardized query keys from @/config/queryKeys
 * import { QUERY_KEYS } from '@/config/queryKeys';
 *
 * // Dashboard health scores (real-time updates via useVitalState)
 * useDedupedQuery({
 *   queryKey: QUERY_KEYS.clients.healthScoresDashboard,
 *   queryFn: fetchHealthScores,
 *   staleTime: Infinity, // Real-time subscriptions handle updates
 * });
 *
 * // Filtered client health scores
 * useDedupedQuery({
 *   queryKey: QUERY_KEYS.clients.healthScores({ healthZone: 'RED', coach: 'John' }),
 *   queryFn: fetchFilteredHealthScores,
 *   staleTime: Infinity, // Real-time subscriptions handle updates
 * });
 *
 * // Invalidating queries (matches all client queries)
 * queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clients.all });
 *
 * // Revenue data (real-time updates)
 * useDedupedQuery({
 *   queryKey: QUERY_KEYS.revenue.monthly,
 *   queryFn: fetchMonthlyRevenue,
 *   staleTime: Infinity, // Real-time subscriptions handle updates
 * });
 *
 * // Static data (no polling needed)
 * useDedupedQuery({
 *   queryKey: ['settings'],
 *   queryFn: fetchSettings,
 *   staleTime: Infinity,
 * });
 */
