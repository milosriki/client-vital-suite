/**
 * Centralized query configuration for React Query
 * Standardizes refetch intervals and stale times across the application
 * to optimize performance and reduce unnecessary database queries
 */

/**
 * Standard refetch intervals in milliseconds
 */
export const REFETCH_INTERVALS = {
  /** 30 seconds - for real-time data that changes frequently */
  REALTIME: 30000,
  
  /** 1 minute - for frequently updated data */
  FREQUENT: 60000,
  
  /** 5 minutes - for moderately changing data */
  MODERATE: 5 * 60 * 1000, // 300000
  
  /** 15 minutes - for slowly changing data */
  SLOW: 15 * 60 * 1000, // 900000
  
  /** Never - for static or manually refreshed data */
  MANUAL: false,
} as const;

/**
 * Standard stale times in milliseconds
 */
export const STALE_TIMES = {
  /** 30 seconds - data becomes stale quickly */
  SHORT: 30000,
  
  /** 1 minute - standard stale time */
  STANDARD: 60000,
  
  /** 5 minutes - data stays fresh longer */
  LONG: 5 * 60 * 1000, // 300000
  
  /** 15 minutes - rarely changing data */
  VERY_LONG: 15 * 60 * 1000, // 900000
} as const;

/**
 * Query configurations for different data types
 */
export const QUERY_CONFIGS = {
  /** Health scores - frequently updated, critical data */
  healthScores: {
    staleTime: STALE_TIMES.STANDARD,
    refetchInterval: REFETCH_INTERVALS.FREQUENT,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
  },
  
  /** Coach performance - moderately updated data */
  coachPerformance: {
    staleTime: STALE_TIMES.LONG,
    refetchInterval: REFETCH_INTERVALS.MODERATE,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  },
  
  /** Interventions - real-time tracking */
  interventions: {
    staleTime: STALE_TIMES.SHORT,
    refetchInterval: REFETCH_INTERVALS.FREQUENT,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
  },
  
  /** Analytics/patterns - slowly changing aggregate data */
  analytics: {
    staleTime: STALE_TIMES.LONG,
    refetchInterval: REFETCH_INTERVALS.MODERATE,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  },
  
  /** HubSpot data - external sync, moderately updated */
  hubspot: {
    staleTime: STALE_TIMES.STANDARD,
    refetchInterval: REFETCH_INTERVALS.FREQUENT,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  },
  
  /** Sales pipeline - real-time for active deals */
  salesPipeline: {
    staleTime: STALE_TIMES.SHORT,
    refetchInterval: REFETCH_INTERVALS.REALTIME,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
  },
  
  /** Daily summaries - updated once per day */
  dailySummary: {
    staleTime: STALE_TIMES.VERY_LONG,
    refetchInterval: REFETCH_INTERVALS.SLOW,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 1,
  },
  
  /** Static data - only refresh manually */
  static: {
    staleTime: Infinity,
    refetchInterval: REFETCH_INTERVALS.MANUAL,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  },
} as const;

/**
 * Helper function to create a query config with overrides
 */
export function createQueryConfig<T extends keyof typeof QUERY_CONFIGS>(
  type: T,
  overrides?: Partial<typeof QUERY_CONFIGS[T]>
) {
  return {
    ...QUERY_CONFIGS[type],
    ...overrides,
  };
}
