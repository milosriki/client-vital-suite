/**
 * Standardized Query Configuration
 * Centralizes polling intervals and query keys to reduce database load
 *
 * For query keys documentation, see /src/config/queryKeys.ts
 */

// Re-export QUERY_KEYS for convenience (import from either file)
export { QUERY_KEYS } from './queryKeys';

export const QUERY_INTERVALS = {
  // Critical: Real-time data that needs frequent updates (30 seconds)
  CRITICAL: 30000,

  // Standard: Health scores and dashboard data (2 minutes)
  STANDARD: 120000,

  // Analytical: Analytics and trend data (5 minutes)
  ANALYTICAL: 300000,

  // Static: Data that doesn't change often or no auto-refresh
  STATIC: Infinity,
} as const;

/**
 * Query mode helpers
 */
export const queryMode = {
  critical: (enabled = true) => ({
    refetchInterval: enabled ? QUERY_INTERVALS.CRITICAL : false,
  }),

  standard: (enabled = true) => ({
    refetchInterval: enabled ? QUERY_INTERVALS.STANDARD : false,
  }),

  analytical: (enabled = true) => ({
    refetchInterval: enabled ? QUERY_INTERVALS.ANALYTICAL : false,
  }),

  static: () => ({
    refetchInterval: false,
  }),
};

/**
 * Usage examples:
 *
 * // Using standardized query keys from @/config/queryKeys with intervals
 * import { QUERY_KEYS } from '@/config/queryKeys';
 *
 * // Dashboard health scores (2min polling)
 * useQuery({
 *   queryKey: QUERY_KEYS.clients.healthScoresDashboard,
 *   queryFn: fetchHealthScores,
 *   refetchInterval: QUERY_INTERVALS.STANDARD,
 * });
 *
 * // Filtered client health scores
 * useQuery({
 *   queryKey: QUERY_KEYS.clients.healthScores({ healthZone: 'RED', coach: 'John' }),
 *   queryFn: fetchFilteredHealthScores,
 *   refetchInterval: QUERY_INTERVALS.STANDARD,
 * });
 *
 * // Invalidating queries (matches all client queries)
 * queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clients.all });
 *
 * // Revenue data with analytical polling (5min)
 * useQuery({
 *   queryKey: QUERY_KEYS.revenue.monthly,
 *   queryFn: fetchMonthlyRevenue,
 *   refetchInterval: QUERY_INTERVALS.ANALYTICAL,
 * });
 *
 * // Critical data (30s polling)
 * useQuery({
 *   queryKey: QUERY_KEYS.capi.events('live'),
 *   queryFn: fetchCapiEvents,
 *   refetchInterval: QUERY_INTERVALS.CRITICAL,
 * });
 *
 * // Static data (no polling)
 * useQuery({
 *   queryKey: ['settings'],
 *   queryFn: fetchSettings,
 *   refetchInterval: QUERY_INTERVALS.STATIC,
 * });
 */
