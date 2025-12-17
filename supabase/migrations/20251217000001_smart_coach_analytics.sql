-- Smart Coach Analytics Table
-- Stores advanced coach performance metrics with predictive analytics

CREATE TABLE IF NOT EXISTS smart_coach_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_name TEXT NOT NULL,
  report_date DATE NOT NULL,
  
  -- Portfolio Size
  total_clients INTEGER DEFAULT 0,
  active_clients INTEGER DEFAULT 0,
  inactive_clients INTEGER DEFAULT 0,
  churned_clients INTEGER DEFAULT 0,
  
  -- Data Quality
  data_completeness_score INTEGER DEFAULT 0,
  
  -- Health Distribution
  red_zone_count INTEGER DEFAULT 0,
  yellow_zone_count INTEGER DEFAULT 0,
  green_zone_count INTEGER DEFAULT 0,
  purple_zone_count INTEGER DEFAULT 0,
  
  -- Distributional Metrics
  avg_health_score INTEGER DEFAULT 0,
  median_health_score INTEGER DEFAULT 0,
  health_score_stddev INTEGER DEFAULT 0,
  
  -- Concentration Risk
  red_zone_share INTEGER DEFAULT 0,
  
  -- Activity Metrics
  avg_sessions_7d NUMERIC(5,1) DEFAULT 0,
  avg_sessions_30d NUMERIC(5,1) DEFAULT 0,
  avg_utilization INTEGER DEFAULT 0,
  
  -- Leading Indicators
  forward_booking_rate INTEGER DEFAULT 0,
  adherence_gap NUMERIC(5,1) DEFAULT 0,
  
  -- Trend Analysis
  momentum_direction TEXT DEFAULT 'STABLE',
  
  -- Revenue Intelligence
  total_outstanding_sessions INTEGER DEFAULT 0,
  total_revenue_at_risk NUMERIC(12,2) DEFAULT 0,
  revenue_at_risk_critical NUMERIC(12,2) DEFAULT 0,
  
  -- Predictive Metrics
  predicted_churn_count_30d INTEGER DEFAULT 0,
  predicted_revenue_loss_30d NUMERIC(12,2) DEFAULT 0,
  intervention_urgency_score INTEGER DEFAULT 0,
  
  -- Comparative Analytics
  rank_vs_peers INTEGER DEFAULT 0,
  adjusted_health_score INTEGER DEFAULT 0,
  
  -- Rates
  retention_rate INTEGER DEFAULT 0,
  engagement_rate INTEGER DEFAULT 0,
  booking_rate INTEGER DEFAULT 0,
  
  -- Actionable Outputs
  recommended_focus TEXT,
  recommended_actions TEXT[],
  strengths TEXT[],
  weaknesses TEXT[],
  top_priority_clients JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint for upsert
  CONSTRAINT smart_coach_analytics_unique UNIQUE (coach_name, report_date)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_smart_coach_analytics_date ON smart_coach_analytics(report_date);
CREATE INDEX IF NOT EXISTS idx_smart_coach_analytics_coach ON smart_coach_analytics(coach_name);
CREATE INDEX IF NOT EXISTS idx_smart_coach_analytics_urgency ON smart_coach_analytics(intervention_urgency_score DESC);
CREATE INDEX IF NOT EXISTS idx_smart_coach_analytics_rank ON smart_coach_analytics(rank_vs_peers);

-- Add comment
COMMENT ON TABLE smart_coach_analytics IS 'Advanced coach performance analytics with predictive metrics, leading indicators, and actionable insights';
