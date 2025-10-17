// Temporary type definitions until Supabase types are regenerated
export interface ClientHealthScore {
  id: string;
  client_id: string;
  firstname: string | null;
  lastname: string | null;
  client_email: string | null;
  health_score: number;
  health_zone: 'RED' | 'YELLOW' | 'GREEN' | 'PURPLE';
  engagement_score: number | null;
  momentum_score: number | null;
  package_health_score: number | null;
  relationship_score: number | null;
  sessions_last_7_days: number;
  sessions_last_30_days: number;
  sessions_last_90_days: number;
  outstanding_sessions: number;
  purchased_sessions: number;
  days_since_last_session: number | null;
  next_session_booked: boolean;
  client_segment: string | null;
  assigned_coach: string | null;
  calculated_at: string;
  created_at: string;
  updated_at: string;
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
