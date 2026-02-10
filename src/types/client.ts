/**
 * Enterprise Client Types
 * Full type definitions for client/contact data shapes
 */

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  hubspot_contact_id?: string;
  stripe_customer_id?: string;
  coach_id?: string;
  coach_name?: string;
  status: ClientStatus;
  health_score?: number;
  churn_risk?: number;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
}

export type ClientStatus =
  | "active"
  | "inactive"
  | "churned"
  | "at_risk"
  | "new"
  | "onboarding";

export interface ClientHealthScore {
  client_id: string;
  overall_score: number;
  engagement_score: number;
  payment_score: number;
  activity_score: number;
  trend: "improving" | "stable" | "declining";
  last_calculated_at: string;
  factors: HealthFactor[];
}

export interface HealthFactor {
  name: string;
  value: number;
  weight: number;
  impact: "positive" | "neutral" | "negative";
}

export interface ChurnPrediction {
  client_id: string;
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  factors: ChurnFactor[];
  predicted_at: string;
  recommended_action?: string;
}

export interface ChurnFactor {
  name: string;
  contribution: number;
  description: string;
}
