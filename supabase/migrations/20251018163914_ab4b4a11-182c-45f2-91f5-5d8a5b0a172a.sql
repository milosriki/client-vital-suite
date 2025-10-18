-- ADD MISSING COLUMNS TO EXISTING TABLES

-- Add predictive_risk_score to client_lifecycle_history
ALTER TABLE client_lifecycle_history 
ADD COLUMN IF NOT EXISTS predictive_risk_score NUMERIC(5,2);

-- Add avg_risk_score_increase to churn_patterns
ALTER TABLE churn_patterns 
ADD COLUMN IF NOT EXISTS avg_risk_score_increase NUMERIC(5,2);

-- Add risk score columns to intervention_outcomes
ALTER TABLE intervention_outcomes 
ADD COLUMN IF NOT EXISTS risk_score_at_intervention NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS risk_score_before NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS risk_score_7d_after NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS risk_score_30d_after NUMERIC(5,2);

-- Add affected_client_count to ai_insights
ALTER TABLE ai_insights 
ADD COLUMN IF NOT EXISTS affected_client_count INTEGER;

-- Add CHECK constraint to ai_insights.insight_category if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'ai_insights' 
    AND column_name = 'insight_category'
  ) THEN
    ALTER TABLE ai_insights 
    ADD CONSTRAINT ai_insights_insight_category_check 
    CHECK (insight_category IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'));
  END IF;
END $$;

-- Add intervention_effectiveness_score to intervention_log
ALTER TABLE intervention_log 
ADD COLUMN IF NOT EXISTS intervention_effectiveness_score NUMERIC(5,2);

-- ADD MISSING INDEXES
CREATE INDEX IF NOT EXISTS idx_health_momentum ON client_health_scores(momentum_indicator);
CREATE INDEX IF NOT EXISTS idx_health_early_warning ON client_health_scores(early_warning_flag) WHERE early_warning_flag = true;
CREATE INDEX IF NOT EXISTS idx_intervention_outcomes_success ON intervention_outcomes(outcome_success_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_category ON ai_insights(insight_category);

-- VERIFICATION QUERY
SELECT 
    'client_health_scores_predictive_columns' as verification_item,
    COUNT(*) as count
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'client_health_scores' 
AND column_name IN ('predictive_risk_score', 'risk_category', 'momentum_indicator', 'rate_of_change_percent', 'early_warning_flag', 'risk_factors')
UNION ALL
SELECT 
    'client_lifecycle_history_columns' as verification_item,
    COUNT(*) as count
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'client_lifecycle_history'
UNION ALL
SELECT 
    'churn_patterns_columns' as verification_item,
    COUNT(*) as count
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'churn_patterns'
UNION ALL
SELECT 
    'intervention_outcomes_columns' as verification_item,
    COUNT(*) as count
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'intervention_outcomes'
UNION ALL
SELECT 
    'ai_insights_columns' as verification_item,
    COUNT(*) as count
FROM information_schema.columns 
WHERE table_schema = 'public'
AND table_name = 'ai_insights'
ORDER BY verification_item;