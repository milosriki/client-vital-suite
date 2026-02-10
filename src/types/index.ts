/**
 * Enterprise Type Barrel Export
 * Per architecture-patterns skill: "Create barrel exports per domain"
 */

// Client types
export type {
  Client,
  ClientStatus,
  ClientHealthScore,
  HealthFactor,
  ChurnPrediction,
  ChurnFactor,
} from "./client";

// Analytics types
export type {
  DashboardMetric,
  KPISummary,
  DateRange,
  TimeSeriesPoint,
  ChartData,
  ChartSeries,
  ChartConfig,
  CoachPerformance,
  SyncStatus,
  Notification,
} from "./analytics";

// Agent types
export type {
  AgentMessage,
  ToolCall,
  ConversationContext,
  AgentConfig,
  AgentLearning,
  BiasCheckResult,
} from "./agent";

// Integration types
export type {
  HubSpotContact,
  HubSpotDeal,
  StripeSubscription,
  StripePayment,
  StripeMRRData,
  CallRecord,
  FacebookAdInsight,
  MarketingAttribution,
} from "./integrations";

// Re-export existing types
export type * from "./ceo";
export type * from "./database";
