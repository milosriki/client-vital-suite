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
 * Query tier classification for database load estimation
 */
export const QUERY_TIERS = {
  // High-load queries that fetch many records or do complex joins
  HIGH_LOAD: {
    examples: ['client-health-scores', 'coach-performance', 'interventions'],
    interval: QUERY_INTERVALS.STANDARD,
    description: 'Health scores, coach performance, interventions',
  },
  // Medium-load queries for daily/summary data
  MEDIUM_LOAD: {
    examples: ['daily-summary', 'weekly-patterns', 'capi-events'],
    interval: QUERY_INTERVALS.STANDARD,
    description: 'Summary data, pattern analysis, CAPI events',
  },
  // Low-load queries for configuration or static data
  LOW_LOAD: {
    examples: ['batch-config', 'batch-jobs'],
    interval: QUERY_INTERVALS.CRITICAL,
    description: 'Configuration and job status',
  },
  // Real-time critical queries
  CRITICAL_LOAD: {
    examples: ['queue-stats', 'pending-events'],
    interval: QUERY_INTERVALS.CRITICAL,
    description: 'Real-time status and queue information',
  },
} as const;

/**
 * Estimated query reduction:
 *
 * Before optimization:
 * - Dashboard: 5 queries at 60s = 5 queries/min = 300 queries/hour
 * - DataEnrichmentTab: 2 queries at 10s = 12 queries/min = 720 queries/hour
 * - AdEventsTab: 1 query at 10s = 6 queries/min = 360 queries/hour
 * - Total critical path: 1380 queries/hour
 *
 * After optimization:
 * - Dashboard: 5 queries at 120s = 2.5 queries/min = 150 queries/hour (50% reduction)
 * - DataEnrichmentTab: 2 queries at 30s = 4 queries/min = 240 queries/hour (67% reduction)
 * - AdEventsTab: 1 query at 30s = 2 queries/min = 120 queries/hour (67% reduction)
 * - Total critical path: 510 queries/hour
 *
 * Overall reduction: (1380 - 510) / 1380 = 63% reduction
 */
