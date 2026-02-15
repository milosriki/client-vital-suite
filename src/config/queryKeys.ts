/**
 * Centralized Query Keys Configuration
 *
 * This file defines all React Query keys used throughout the application.
 * Using consistent query keys ensures proper cache invalidation and prevents data duplication.
 *
 * Query Key Structure:
 * - Base keys: ['entity'] for all items
 * - Filtered keys: ['entity', filter1, filter2, ...] for filtered/parameterized queries
 * - Detail keys: ['entity', 'detail', id] for single items
 *
 * Benefits:
 * 1. Single source of truth for all query keys
 * 2. Type-safe query key generation
 * 3. Easier cache invalidation (invalidate all client queries with ['clients'])
 * 4. Prevents duplicate cache entries for the same data
 */

export const QUERY_KEYS = {
  // Client Health & Scores
  clients: {
    all: ['clients'] as const,
    healthScores: (filters?: {
      healthZone?: string;
      segment?: string;
      coach?: string;
    }) => ['clients', 'health-scores', filters] as const,
    healthScoresDashboard: ['clients', 'health-scores-dashboard'] as const,
    healthStats: ['clients', 'health-stats'] as const,
    critical: ['clients', 'critical'] as const,
    detail: (email: string) => ['clients', 'detail', email] as const,
    analytics: ['clients', 'analytics'] as const,
  },

  // Coaches
  coaches: {
    all: ['coaches'] as const,
    performance: ['coaches', 'performance'] as const,
    leaderboard: ['coaches', 'leaderboard'] as const,
    clients: (coachId: string) => ['coaches', 'clients', coachId] as const,
    reviews: ['coaches', 'reviews'] as const,
    inactive: ['coaches', 'inactive'] as const,
  },

  // Interventions
  interventions: {
    all: ['interventions'] as const,
    filtered: (statusFilter?: string) => ['interventions', 'all', statusFilter] as const,
    byClient: (email: string) => ['interventions', 'by-client', email] as const,
    dashboard: ['interventions', 'dashboard'] as const,
  },

  // Daily & Weekly Summaries
  summaries: {
    daily: ['summaries', 'daily'] as const,
    dailyBriefing: ['summaries', 'daily-briefing'] as const,
    weekly: ['summaries', 'weekly'] as const,
    todaySnapshot: ['summaries', 'today-snapshot'] as const,
  },

  // Weekly Patterns
  patterns: {
    weekly: ['patterns', 'weekly'] as const,
    analytics: ['patterns', 'weekly-analytics'] as const,
  },

  // Sales Pipeline - HubSpot
  pipeline: {
    // Leads
    leads: {
      all: (days?: number) => ['pipeline', 'leads', days] as const,
      funnel: (days?: number) => ['pipeline', 'lead-funnel', days] as const,
      enhanced: (days?: number) => ['pipeline', 'enhanced-leads', days] as const,
      warRoom: ['pipeline', 'war-room-leads'] as const,
      db: (timeframe?: string) => ['pipeline', 'db-leads', timeframe] as const,
      dbEnhanced: (timeframe?: string) => ['pipeline', 'db-enhanced-leads', timeframe] as const,
      today: ['pipeline', 'leads-today'] as const,
      forCalls: ['pipeline', 'enhanced-leads-for-calls'] as const,
    },

    // Contacts
    contacts: {
      all: (days?: number) => ['pipeline', 'contacts', days] as const,
      forCalls: ['pipeline', 'contacts-for-calls'] as const,
    },

    // Deals
    deals: {
      summary: (days?: number) => ['pipeline', 'deals-summary', days] as const,
      warRoom: ['pipeline', 'war-room-deals'] as const,
      db: (timeframe?: string) => ['pipeline', 'db-deals', timeframe] as const,
      dbMonthly: ['pipeline', 'db-deals-monthly'] as const,
      forOwners: ['pipeline', 'hubspot-deals-for-owners'] as const,
      forPipelines: ['pipeline', 'hubspot-deals-for-pipelines'] as const,
    },

    // Calls
    calls: {
      records: (days?: number) => ['pipeline', 'call-records', days] as const,
      recordsEnriched: ['pipeline', 'call-records-enriched'] as const,
      db: (timeframe?: string) => ['pipeline', 'db-calls', timeframe] as const,
      today: ['pipeline', 'calls-today'] as const,
      teamToday: (owner?: string) => ['pipeline', 'team-calls-today', owner] as const,
    },

    // Appointments
    appointments: {
      summary: (days?: number) => ['pipeline', 'appointments-summary', days] as const,
    },

    // KPIs & Forecasts
    kpi: {
      tracking: ['pipeline', 'kpi-tracking'] as const,
    },
    forecasts: {
      business: ['pipeline', 'business-forecasts'] as const,
    },

    // Pipeline Value
    value: ['pipeline', 'value'] as const,
  },

  // HubSpot
  hubspot: {
    staff: ['hubspot', 'staff'] as const,
    owners: {
      all: ['hubspot', 'owners'] as const,
      forFilter: ['hubspot', 'owners-filter'] as const,
      forActions: ['hubspot', 'owners-actions'] as const,
      grid: ['hubspot', 'owners-grid'] as const,
      management: ['hubspot', 'owners-management'] as const,
    },
    contacts: {
      forOwners: ['hubspot', 'contacts-for-owners'] as const,
      latest: ['hubspot', 'latest-contacts-alerts'] as const,
    },
    commandCenter: {
      overview: (mode?: string) => ['hubspot', 'command-center', 'overview', mode] as const,
      userDetail: (userId?: string) => ['hubspot', 'command-center', 'user-detail', userId] as const,
      riskyContacts: (mode?: string) => ['hubspot', 'command-center', 'risky-contacts', mode] as const,
    },
    conversations: {
      feed: (status?: string) => ['hubspot', 'conversations-feed', status] as const,
      alerts: ['hubspot', 'conversations-alerts'] as const,
    },
    pipelines: {
      health: ['hubspot', 'pipelines-health'] as const,
    },
    activity: {
      today: (owner?: string, source?: string, location?: string) =>
        ['hubspot', 'today-activity', owner, source, location] as const,
      ticker: ['hubspot', 'ticker-activities'] as const,
    },
    alerts: {
      critical: ['hubspot', 'critical-alerts'] as const,
    },
    sync: {
      last: ['hubspot', 'last-sync'] as const,
    },
    reassignment: {
      log: ['hubspot', 'reassignment-log'] as const,
    },
  },

  // Stripe
  stripe: {
    dashboard: (filters?: { from?: string; to?: string; status?: string }) =>
      ['stripe', 'dashboard-data', filters?.from, filters?.to, filters?.status] as const,
    dashboardMode: (mode?: string) => ['stripe', 'dashboard-data', mode] as const,
    forensics: ['stripe', 'forensics'] as const,
    forensicsMode: (mode?: string) => ['stripe', 'forensics', mode] as const,
    completeIntelligence: (mode?: string, days?: number) =>
      ['stripe', 'complete-intelligence', mode, days] as const,
    moneyFlow: (mode?: string, days?: number) =>
      ['stripe', 'money-flow', mode, days] as const,
    payouts: {
      data: (mode?: string) => ['stripe', 'payouts-data', mode] as const,
      settings: (mode?: string) => ['stripe', 'payout-settings', mode] as const,
    },
  },

  // Revenue
  revenue: {
    monthly: ['revenue', 'monthly'] as const,
    chart: ['revenue', 'chart-data'] as const,
  },

  // War Room
  warRoom: {
    deals: ['war-room', 'deals'] as const,
    leads: ['war-room', 'leads'] as const,
    clients: ['war-room', 'clients'] as const,
  },

  // Currency
  currency: {
    base: ['currency', 'base'] as const,
  },

  // Bookings
  bookings: {
    yesterday: ['bookings', 'yesterday'] as const,
    teamToday: (owner?: string) => ['bookings', 'team-today', owner] as const,
  },

  // Sales
  sales: {
    currentMonth: ['sales', 'current-month'] as const,
    previousMonth: ['sales', 'previous-month'] as const,
    coachTracker: ['sales', 'coach-tracker'] as const,
  },

  // AI
  ai: {
    decisions: (statusFilter?: string) => ['ai', 'decisions', statusFilter] as const,
    patterns: ['ai', 'patterns'] as const,
    knowledge: (categoryFilter?: string) => ['ai', 'knowledge', categoryFilter] as const,
    knowledgeStats: ['ai', 'knowledge-stats'] as const,
    insights: {
      proactive: ['ai', 'proactive-insights'] as const,
      count: ['ai', 'proactive-insights-count'] as const,
    },
    messages: (sessionId?: string) => ['ai', 'agent-messages', sessionId] as const,
    actions: {
      prepared: ['ai', 'prepared-actions'] as const,
      pending: ['ai', 'pending-actions'] as const,
      executed: ['ai', 'executed-actions'] as const,
    },
    goals: {
      business: ['ai', 'business-goals'] as const,
    },
    calibration: {
      business: ['ai', 'business-calibration'] as const,
    },
    intelligence: {
      business: ['ai', 'business-intelligence'] as const,
    },
  },

  // CEO Dashboard
  ceo: {
    revenue: ['ceo', 'revenue-metrics'] as const,
    clientHealth: ['ceo', 'client-health'] as const,
    integrationStatus: ['ceo', 'integration-status'] as const,
    churnAlerts: ['ceo', 'churn-alerts'] as const,
  },

  // Audit Trail
  audit: {
    trail: (searchTrigger?: string) => ['audit', 'trail', searchTrigger] as const,
  },

  // Dashboard
  dashboard: {
    batch: (filters?: Record<string, unknown>) => ['dashboard', 'batch', filters] as const,
    alerts: ['dashboard', 'alerts'] as const,
    features: {
      apiUsage: ['dashboard', 'api-usage-metrics'] as const,
      workflow: ['dashboard', 'workflow-status'] as const,
      tickerFeed: ['dashboard', 'ticker-feed-activities'] as const,
    },
  },

  // Meta/Facebook Ads
  meta: {
    adsInsights: ['meta', 'facebook-ads-insights'] as const,
  },

  // CAPI Events
  capi: {
    events: (mode?: string) => ['capi', 'events', mode] as const,
  },

  // Data Enrichment
  enrichment: {
    queueStats: (mode?: string) => ['enrichment', 'queue-stats', mode] as const,
    batchJobs: (mode?: string) => ['enrichment', 'batch-jobs', mode] as const,
    batchConfig: ['enrichment', 'batch-config'] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
  },

  // Sync & System
  sync: {
    errors: {
      check: ['sync', 'errors-check'] as const,
      monitor: ['sync', 'errors-monitor'] as const,
      all: ['sync', 'errors'] as const,
    },
    lastTime: ['sync', 'last-sync-time'] as const,
    lastStatus: ['sync', 'last-sync-status'] as const,
    logs: ['sync', 'logs'] as const,
    systemLogs: ['sync', 'system-logs'] as const,
  },

  // System
  system: {
    status: ['system', 'status'] as const,
    health: ['system', 'health'] as const,
  },

  // Metrics
  metrics: {
    contributors: (type?: string) => ['metrics', 'contributors', type] as const,
    trend: (type?: string) => ['metrics', 'trend', type] as const,
  },

  // Calculation
  calculation: {
    latestDate: ['calculation', 'latest-date'] as const,
  },

  // Activity
  activity: {
    liveFeed: ['activity', 'live-feed'] as const,
  },

  // Leak Detection
  leaks: {
    detector: ['leaks', 'detector'] as const,
  },

  // Marketing
  marketing: {
    stressTest: ['marketing', 'stress-test'] as const,
  },

  // Automation
  automation: {
    syncLogs: ['automation', 'sync-logs'] as const,
  },

  // Contact Owners
  contactOwners: {
    all: ['contact-owners'] as const,
  },

  // Enterprise — Truth Genome & Strategy
  enterprise: {
    truthGenome: ['enterprise', 'truth-genome'] as const,
    segmentCapacity: ['enterprise', 'segment-capacity'] as const,
    coachCapacity: (zone?: string) => ['enterprise', 'coach-capacity', zone] as const,
    revenueShadow: ['enterprise', 'revenue-shadow'] as const,
  },

  // Enterprise — Call Analytics
  callAnalytics: {
    metrics: (days: number) => ['call-analytics', 'metrics', days] as const,
    log: (days: number) => ['call-analytics', 'log', days] as const,
    topSetters: ['call-analytics', 'top-setters'] as const,
  },

  // Enterprise — AI Advisor
  aiAdvisor: {
    queue: ['ai-advisor', 'queue'] as const,
    revenueAtRisk: ['ai-advisor', 'revenue-at-risk'] as const,
  },

  // Enterprise — System Observability
  systemObservability: {
    functions: (timeRange: string) => ['system-observability', 'functions', timeRange] as const,
    alerts: ['system-observability', 'alerts'] as const,
    syncCycle: ['system-observability', 'sync-cycle'] as const,
  },

  // Enterprise — Client X-Ray
  clientXRay: {
    list: (search?: string) => ['client-xray', 'list', search] as const,
    detail: (id: string) => ['client-xray', 'detail', id] as const,
    timeline: (id: string) => ['client-xray', 'timeline', id] as const,
  },

  // Enterprise — Coach Command
  coachCommand: {
    load: (zone?: string) => ['coach-command', 'load', zone] as const,
    segmentHud: ['coach-command', 'segment-hud'] as const,
    predictions: ['coach-command', 'predictions'] as const,
  },

  // Enterprise — Knowledge Search
  knowledgeSearch: {
    results: (query: string, category?: string) => ['knowledge-search', query, category] as const,
    stats: ['knowledge-search', 'stats'] as const,
  },
} as const;

/**
 * Type helper to extract query key types
 */
export type QueryKey = typeof QUERY_KEYS;

/**
 * Helper function to invalidate all queries for a specific entity
 *
 * Example:
 * invalidateEntity(queryClient, QUERY_KEYS.clients.all)
 * This will invalidate ALL client-related queries
 */
export function getEntityKey<T extends readonly unknown[]>(key: T): T {
  return key;
}
