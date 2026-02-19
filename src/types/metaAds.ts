// ═══════════════════════════════════════════════════════════
// PTD META ADS — Type Definitions
// ═══════════════════════════════════════════════════════════

export interface CampaignData {
  campaign_id: string;
  campaign_name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED';
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  cpa: number;
  daily_budget?: number;
  reach?: number;
  frequency?: number;
  link_clicks?: number;
  landing_page_views?: number;
  lead_form_submissions?: number;
  messaging_conversations?: number;
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
}

export interface AdSetData {
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  status: string;
  spend: number;
  impressions?: number;
  clicks?: number;
  conversions: number;
  cpa: number;
  roas: number;
  ctr?: number;
  daily_budget: number;
  reach: number;
  frequency: number;
  link_clicks: number;
  landing_page_views: number;
  lead_form_submissions: number;
  messaging_conversations: number;
  quality_ranking: string;
  engagement_rate_ranking: string;
  conversion_rate_ranking: string;
  raw_actions: Record<string, unknown>[];
}

export interface AdData {
  ad_id: string;
  ad_name: string;
  adset_id?: string;
  adset_name: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpa: number;
  roas: number;
}

export interface PerformanceAlert {
  campaign_id: string;
  campaign_name: string;
  alert_type: 'high_cpa' | 'low_roas' | 'high_spend_low_conv' | 'budget_exhausted' | 'improving' | 'declining' | 'high_frequency' | 'low_quality' | 'budget_pacing';
  severity: 'critical' | 'warning' | 'info';
  metric: string;
  value: number;
  threshold: number;
  recommendation: string;
}

export interface BudgetRecommendation {
  campaign_id: string;
  campaign_name: string;
  current_daily_budget: number;
  recommended_daily_budget: number;
  reason: string;
  expected_roas_change: number;
}

export interface AudienceBreakdown {
  by_age: Array<{ range: string; spend: number; conversions: number; cpa: number }>;
  by_gender: Array<{ gender: string; spend: number; conversions: number; cpa: number }>;
  by_placement: Array<{ placement: string; spend: number; conversions: number; cpa: number }>;
}

export interface CrossValidationMetrics {
  meta_reported: {
    spend: number;
    conversions: number;
    cpa: number;
    roas: number;
  };
  real: {
    hubspot_new_contacts: number;
    stripe_revenue: number;
    real_cpl: number;
    real_roas: number;
  };
  discrepancy: {
    cpa_diff_percent: number;
    roas_diff_percent: number;
  };
}

export interface MetricThreshold {
  good: number;
  warning: number;
  label: string;
  format: 'currency' | 'percentage' | 'number' | 'ranking';
  direction: 'lower-is-better' | 'higher-is-better';
}

export interface AlertConfig {
  metric: string;
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
  action: string;
}

export interface EntityMapping {
  entity_type: string;
  entity_name: string;
  meta_id: string;
  brand: 'ptd_fitness' | 'personal_trainers_dubai';
}

export interface UsageStats {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface TokenCost {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  model: string;
}

export interface StreamEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'message_complete' | 'error';
  text?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  usage?: UsageStats;
  stopReason?: string;
  content?: ContentBlock[];
  error?: string;
}

export interface ContentBlock {
  type: 'text' | 'mcp_tool_use' | 'mcp_tool_result';
  text?: string;
  id?: string;
  name?: string;
  server_name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  is_error?: boolean;
  content?: Array<{ type: string; text: string }>;
}

export interface MetaAdsResponse {
  text: string;
  toolResults: Array<{
    toolUseId: string;
    isError: boolean;
    content: unknown;
  }>;
  usage: UsageStats;
  stopReason: string;
}

export type TimeRange =
  | 'today'
  | 'yesterday'
  | 'last_7d'
  | 'last_14d'
  | 'last_30d'
  | 'last_90d'
  | 'this_month'
  | 'last_month';

export type TaskType =
  | 'data_fetch'
  | 'campaign_list'
  | 'performance_alerts'
  | 'budget_optimization'
  | 'creative_analysis'
  | 'audience_insights'
  | 'chat'
  | 'strategic_planning';

export type ToolProfile = 'dashboard' | 'management' | 'creative' | 'targeting' | 'full';

export interface CreateCampaignParams {
  name: string;
  objective: string;
  daily_budget: number;
  status?: 'ACTIVE' | 'PAUSED';
  account_id?: string;
}

export type BrandFilter = 'all' | 'ptd_fitness' | 'personal_trainers_dubai';
