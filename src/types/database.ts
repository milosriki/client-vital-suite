// Temporary type definitions until Supabase types are regenerated

// Deal type for revenue tracking
export interface Deal {
  id: string;
  deal_name: string | null;
  deal_value: number | null;
  stage: string | null;
  status: 'open' | 'closed' | 'lost' | null;
  close_date: string | null;
  hubspot_deal_id: string | null;
  contact_id: string | null;
  created_at: string;
  updated_at: string;
}

// Sync error type for error monitoring
export interface SyncError {
  id: string;
  source: string;
  error_type: string;
  error_message: string;
  created_at: string;
  resolved_at: string | null;
}

// Sync log type for sync status tracking
export interface SyncLog {
  id: string;
  platform: string;
  sync_type: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  started_at: string;
  completed_at: string | null;
  records_processed: number | null;
  records_failed: number | null;
  error_message: string | null;
  created_at: string;
}

// Contact activity type for live feeds
export interface ContactActivity {
  id: string;
  activity_type: string;
  activity_title: string | null;
  activity_description: string | null;
  occurred_at: string;
  hubspot_contact_id: string | null;
}

// Intervention log type for intervention tracking
export interface InterventionLog {
  id: number;
  client_email: string | null;
  firstname: string | null;
  lastname: string | null;
  intervention_type: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
  ai_recommendation: string | null;
  triggered_at: string | null;
  actioned_at: string | null;
  assigned_to: string | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientHealthScore {
  id: string;
  client_id: string;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
  client_email?: string | null; // Alias for compatibility
  health_score: number;
  health_zone: 'RED' | 'YELLOW' | 'GREEN' | 'PURPLE';
  engagement_score: number | null;
  momentum_score: number | null;
  package_health_score: number | null;
  relationship_score: number | null;
  sessions_last_7d: number;
  sessions_last_30d: number;
  sessions_last_90d: number;
  outstanding_sessions: number;
  purchased_sessions: number;
  days_since_last_session: number | null;
  next_session_booked: boolean;
  client_segment: string | null;
  assigned_coach: string | null;
  calculated_on: string;
  calculated_at: string;
  created_at: string;
  updated_at: string;
  financial_score: number | null;
  churn_risk_score: number | null;
  health_trend: string | null;
  intervention_priority: string | null;
  package_type: string | null;
  package_value_aed: number | null;
  days_until_renewal: number | null;
  hubspot_contact_id: string | null;
  calculation_version: string | null;
}

export interface CoachPerformance {
  id: string;
  coach_name: string;
  report_date: string;
  total_clients: number;
  avg_client_health: number;
  red_clients: number;
  yellow_clients: number;
  green_clients: number;
  purple_clients: number;
  clients_improving: number;
  clients_declining: number;
  trend: 'improving' | 'declining' | 'stable' | null;
  created_at: string;
  updated_at: string;
}

export interface DailySummary {
  id: string;
  summary_date: string;
  total_active_clients: number;
  avg_health_score: number;
  critical_interventions: number;
  at_risk_revenue: number;
  red_clients: number;
  yellow_clients: number;
  green_clients: number;
  purple_clients: number;
  red_percentage: number;
  yellow_percentage: number;
  green_percentage: number;
  purple_percentage: number;
  created_at: string;
  updated_at: string;
}
