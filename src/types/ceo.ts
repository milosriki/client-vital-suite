export interface PreparedAction {
  id: string;
  action_type: string;
  action_title: string;
  action_description: string;
  reasoning: string;
  expected_impact: string;
  risk_level: string;
  confidence: number;
  prepared_payload: any;
  supporting_data: any;
  status: string;
  priority: number;
  source_agent: string;
  created_at: string;
  executed_at?: string;
  rejection_reason?: string;
}

export interface BusinessGoal {
  id: string;
  goal_name: string;
  metric_name: string;
  baseline_value: number;
  current_value: number;
  target_value: number;
  deadline: string;
  status: string;
}

export interface CalibrationExample {
  id: string;
  scenario_description: string;
  ai_recommendation: string;
  your_decision: string;
  was_ai_correct: boolean;
  created_at: string;
}

export interface ProactiveInsight {
  id: string;
  insight_type: string;
  title: string;
  description: string;
  priority: string;
  created_at: string;
}

export interface BIAnalysis {
  executive_summary?: string;
  system_status?: string;
  action_plan?: string[];
  data_freshness?: string;
}

export interface RevenueMetrics {
  totalRevenue: number;
  avgDealValue: number;
  dealsCount: number;
  pipelineValue: number;
}

export interface ClientHealthMetrics {
  green: number;
  yellow: number;
  red: number;
  purple: number;
  total: number;
  atRiskRevenue: number;
  avgHealth: number;
}

export interface IntegrationStatus {
  [key: string]: {
    connected: boolean;
    lastSync: string | null;
    errors: number;
  };
}

export interface ChurnAlert {
  firstname: string;
  lastname: string;
  email: string;
  churn_risk_score: number;
  health_zone: string;
  package_value_aed: number;
}
