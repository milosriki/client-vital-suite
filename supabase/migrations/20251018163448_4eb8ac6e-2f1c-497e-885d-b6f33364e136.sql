-- ADD PREDICTIVE INTELLIGENCE COLUMNS
ALTER TABLE client_health_scores 
ADD COLUMN IF NOT EXISTS predictive_risk_score NUMERIC(5,2) DEFAULT 50,
ADD COLUMN IF NOT EXISTS risk_category TEXT CHECK (risk_category IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
ADD COLUMN IF NOT EXISTS momentum_indicator TEXT CHECK (momentum_indicator IN ('ACCELERATING', 'STABLE', 'DECLINING')) DEFAULT 'STABLE',
ADD COLUMN IF NOT EXISTS rate_of_change_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS early_warning_flag BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS risk_factors JSONB;

-- CREATE INTELLIGENCE TABLES
CREATE TABLE IF NOT EXISTS client_lifecycle_history (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  week_ending_date DATE NOT NULL,
  health_score NUMERIC(5,2),
  health_zone TEXT,
  sessions_this_week NUMERIC(5,1),
  sessions_previous_week NUMERIC(5,1),
  week_over_week_change NUMERIC(5,2),
  engagement_trend TEXT CHECK (engagement_trend IN ('ACCELERATING', 'STABLE', 'DECLINING')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email, week_ending_date)
);

CREATE TABLE IF NOT EXISTS churn_patterns (
  id BIGSERIAL PRIMARY KEY,
  pattern_name TEXT NOT NULL,
  days_before_churn INTEGER NOT NULL,
  avg_health_score_drop NUMERIC(5,2),
  avg_session_frequency_drop NUMERIC(5,2),
  common_behaviors JSONB,
  confidence_score NUMERIC(5,2),
  sample_size INTEGER,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pattern_name, days_before_churn)
);

CREATE TABLE IF NOT EXISTS intervention_outcomes (
  id BIGSERIAL PRIMARY KEY,
  client_email TEXT NOT NULL,
  intervention_id BIGINT REFERENCES intervention_log(id),
  intervention_type TEXT,
  client_persona TEXT,
  health_zone_at_intervention TEXT,
  executed_at TIMESTAMP WITH TIME ZONE,
  health_score_before NUMERIC(5,2),
  health_score_7d_after NUMERIC(5,2),
  health_score_30d_after NUMERIC(5,2),
  sessions_booked_within_7d INTEGER,
  trend_changed_to_positive BOOLEAN,
  outcome_success_score NUMERIC(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_insights (
  id BIGSERIAL PRIMARY KEY,
  insight_date DATE NOT NULL,
  insight_type TEXT NOT NULL,
  insight_category TEXT,
  insight_text TEXT,
  affected_clients JSONB,
  confidence_score NUMERIC(5,2),
  action_recommended TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ADD COLUMNS TO INTERVENTION_LOG
ALTER TABLE intervention_log 
ADD COLUMN IF NOT EXISTS success_probability NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
ADD COLUMN IF NOT EXISTS client_persona TEXT,
ADD COLUMN IF NOT EXISTS outcome_measured_at TIMESTAMP WITH TIME ZONE;

-- CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_lifecycle_email_date ON client_lifecycle_history(email, week_ending_date DESC);
CREATE INDEX IF NOT EXISTS idx_churn_patterns_days ON churn_patterns(days_before_churn);
CREATE INDEX IF NOT EXISTS idx_intervention_outcomes_email ON intervention_outcomes(client_email);
CREATE INDEX IF NOT EXISTS idx_ai_insights_date ON ai_insights(insight_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_predictive_risk ON client_health_scores(predictive_risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_health_risk_category ON client_health_scores(risk_category);