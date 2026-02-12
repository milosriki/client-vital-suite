// Temporary type definitions until Supabase types are regenerated
export interface ClientHealthScore {
  id: string;
  client_id: string;
  firstname: string | null;
  lastname: string | null;
  email: string | null;
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
  total_clients: number | null;
  avg_client_health: number | null;
  clients_red: number | null;
  clients_yellow: number | null;
  clients_green: number | null;
  clients_purple: number | null;
  clients_improving: number | null;
  clients_declining: number | null;
  health_trend: string | null;
  created_at: string | null;
}

export interface DailySummary {
  id: number;
  summary_date: string;
  total_clients: number | null;
  avg_health_score: number | null;
  critical_interventions: number | null;
  at_risk_revenue_aed: number | null;
  clients_red: number | null;
  clients_yellow: number | null;
  clients_green: number | null;
  clients_purple: number | null;
  created_at: string | null;
}
