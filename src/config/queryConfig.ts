/**
 * Standardized Query Configuration
 * Centralizes polling intervals to reduce database load
 */

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
 * // Critical data (30s polling)
 * useQuery({
 *   queryKey: ['capi-events'],
 *   queryFn: fetchCapiEvents,
 *   refetchInterval: QUERY_INTERVALS.CRITICAL,
 * });
 *
 * // Standard dashboard data (2min polling)
 * useQuery({
 *   queryKey: ['health-scores'],
 *   queryFn: fetchHealthScores,
 *   refetchInterval: QUERY_INTERVALS.STANDARD,
 * });
 *
 * // Analytical data (5min polling)
 * useQuery({
 *   queryKey: ['weekly-trends'],
 *   queryFn: fetchWeeklyTrends,
 *   refetchInterval: QUERY_INTERVALS.ANALYTICAL,
 * });
 *
 * // Static data (no polling)
 * useQuery({
 *   queryKey: ['settings'],
 *   queryFn: fetchSettings,
 *   refetchInterval: QUERY_INTERVALS.STATIC,
 * });
 */
