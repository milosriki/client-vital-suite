import { Database } from "@/integrations/supabase/types";

export interface WeeklyHealthSummary {
  week_start: string;
  total_clients: number;
  avg_health_score: number;
  critical_clients: number;
  prepared: number;
  executing: number;
  completed: number;
  revenue_at_risk: number;
}

export interface RevenueByCoach {
  coach_id: string;
  coach_name: string;
  total_revenue: number;
  client_count: number;
  avg_revenue_per_client: number;
}

export interface ClientLifetimeValue {
  client_id: string;
  client_name: string;
  total_revenue: number;
  tenure_months: number;
  avg_monthly_spend: number;
  last_payment_date: string | null;
}

export interface RetentionCohort {
  cohort_month: string;
  starting_count: number;
  current_count: number;
  retention_rate: number;
  churn_rate: number;
}

// Extend the existing Database definitions locally for Views
export type DashboardDatabase = Database & {
  public: {
    Views: {
      weekly_health_summary: {
        Row: WeeklyHealthSummary;
      };
      revenue_by_coach: {
        Row: RevenueByCoach;
      };
      client_lifetime_value: {
        Row: ClientLifetimeValue;
      };
      retention_cohorts: {
        Row: RetentionCohort;
      };
    };
  };
};
