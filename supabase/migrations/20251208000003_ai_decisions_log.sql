-- AI Decisions Log Table
-- Tracks all AI-generated decisions, recommendations, and interventions
-- Enables learning feedback loop to improve AI performance over time

CREATE TABLE IF NOT EXISTS public.ai_decisions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_type TEXT NOT NULL, -- 'intervention', 'call_queue', 'score_explanation', 'coach_analysis', etc.
  client_email TEXT, -- Client this decision was about (if applicable)
  coach_name TEXT, -- Coach this decision was about (if applicable)
  ai_reasoning TEXT NOT NULL, -- Why the AI made this recommendation
  recommendation JSONB NOT NULL, -- The full recommendation object
  confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 1), -- AI confidence score (0-1)
  context JSONB DEFAULT '{}', -- Additional context that led to this decision
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT, -- User who triggered this AI decision

  -- Feedback and outcome tracking
  user_action TEXT, -- 'accepted', 'rejected', 'modified', 'ignored'
  user_action_at TIMESTAMPTZ,
  user_notes TEXT,
  outcome TEXT, -- 'success', 'failed', 'partial', 'pending'
  outcome_recorded_at TIMESTAMPTZ,
  outcome_notes TEXT,

  -- Performance metrics
  response_time_ms INTEGER, -- How long the AI took to respond
  cost_usd NUMERIC, -- Cost of this AI call
  model_used TEXT -- Which AI model was used
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_decisions_log_decision_type ON public.ai_decisions_log(decision_type);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_log_client_email ON public.ai_decisions_log(client_email);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_log_coach_name ON public.ai_decisions_log(coach_name);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_log_created_at ON public.ai_decisions_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_log_outcome ON public.ai_decisions_log(outcome);
CREATE INDEX IF NOT EXISTS idx_ai_decisions_log_user_action ON public.ai_decisions_log(user_action);

-- Composite index for learning queries (what worked in the past)
CREATE INDEX IF NOT EXISTS idx_ai_decisions_log_learning
  ON public.ai_decisions_log(decision_type, outcome, confidence DESC)
  WHERE outcome IN ('success', 'failed');

-- Enable Row Level Security (RLS)
ALTER TABLE public.ai_decisions_log ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated users" ON public.ai_decisions_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to calculate success rate by decision type
CREATE OR REPLACE FUNCTION get_ai_decision_success_rate(
  p_decision_type TEXT,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  decision_type TEXT,
  total_decisions BIGINT,
  successful BIGINT,
  failed BIGINT,
  pending BIGINT,
  success_rate NUMERIC,
  avg_confidence NUMERIC,
  avg_response_time_ms NUMERIC
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    p_decision_type as decision_type,
    COUNT(*) as total_decisions,
    COUNT(*) FILTER (WHERE outcome = 'success') as successful,
    COUNT(*) FILTER (WHERE outcome = 'failed') as failed,
    COUNT(*) FILTER (WHERE outcome = 'pending') as pending,
    ROUND(
      CAST(COUNT(*) FILTER (WHERE outcome = 'success') AS NUMERIC) /
      NULLIF(COUNT(*) FILTER (WHERE outcome IN ('success', 'failed')), 0) * 100,
      2
    ) as success_rate,
    ROUND(AVG(confidence), 3) as avg_confidence,
    ROUND(AVG(response_time_ms), 0) as avg_response_time_ms
  FROM public.ai_decisions_log
  WHERE decision_type = p_decision_type
    AND created_at >= NOW() - (p_days_back || ' days')::INTERVAL
  GROUP BY decision_type;
$$;

-- Function to get learning insights (what patterns work best)
CREATE OR REPLACE FUNCTION get_ai_learning_insights(
  p_decision_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  pattern TEXT,
  success_count BIGINT,
  total_count BIGINT,
  success_rate NUMERIC,
  avg_confidence NUMERIC,
  example_recommendation JSONB
)
LANGUAGE SQL
STABLE
AS $$
  WITH pattern_analysis AS (
    SELECT
      recommendation->>'intervention_type' as pattern,
      COUNT(*) FILTER (WHERE outcome = 'success') as success_count,
      COUNT(*) as total_count,
      ROUND(
        CAST(COUNT(*) FILTER (WHERE outcome = 'success') AS NUMERIC) /
        NULLIF(COUNT(*), 0) * 100,
        2
      ) as success_rate,
      ROUND(AVG(confidence), 3) as avg_confidence,
      (ARRAY_AGG(recommendation ORDER BY confidence DESC))[1] as example_recommendation
    FROM public.ai_decisions_log
    WHERE
      outcome IN ('success', 'failed')
      AND (p_decision_type IS NULL OR decision_type = p_decision_type)
      AND created_at >= NOW() - INTERVAL '90 days'
    GROUP BY recommendation->>'intervention_type'
  )
  SELECT * FROM pattern_analysis
  WHERE total_count >= 3 -- At least 3 samples to be statistically relevant
  ORDER BY success_rate DESC, total_count DESC
  LIMIT p_limit;
$$;

-- Function to log AI decision (to be called from Edge Functions)
CREATE OR REPLACE FUNCTION log_ai_decision(
  p_decision_type TEXT,
  p_ai_reasoning TEXT,
  p_recommendation JSONB,
  p_confidence NUMERIC DEFAULT NULL,
  p_context JSONB DEFAULT '{}'::JSONB,
  p_client_email TEXT DEFAULT NULL,
  p_coach_name TEXT DEFAULT NULL,
  p_created_by TEXT DEFAULT NULL,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_cost_usd NUMERIC DEFAULT NULL,
  p_model_used TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE SQL
AS $$
  INSERT INTO public.ai_decisions_log (
    decision_type,
    ai_reasoning,
    recommendation,
    confidence,
    context,
    client_email,
    coach_name,
    created_by,
    response_time_ms,
    cost_usd,
    model_used
  ) VALUES (
    p_decision_type,
    p_ai_reasoning,
    p_recommendation,
    p_confidence,
    p_context,
    p_client_email,
    p_coach_name,
    p_created_by,
    p_response_time_ms,
    p_cost_usd,
    p_model_used
  )
  RETURNING id;
$$;

-- Function to update AI decision outcome (called when intervention outcome is known)
CREATE OR REPLACE FUNCTION update_ai_decision_outcome(
  p_decision_id UUID,
  p_outcome TEXT,
  p_outcome_notes TEXT DEFAULT NULL,
  p_user_action TEXT DEFAULT NULL,
  p_user_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE SQL
AS $$
  UPDATE public.ai_decisions_log
  SET
    outcome = p_outcome,
    outcome_recorded_at = NOW(),
    outcome_notes = COALESCE(p_outcome_notes, outcome_notes),
    user_action = COALESCE(p_user_action, user_action),
    user_action_at = CASE
      WHEN p_user_action IS NOT NULL THEN NOW()
      ELSE user_action_at
    END,
    user_notes = COALESCE(p_user_notes, user_notes)
  WHERE id = p_decision_id
  RETURNING true;
$$;

-- Create a view for easy AI performance monitoring
CREATE OR REPLACE VIEW ai_performance_dashboard AS
SELECT
  decision_type,
  COUNT(*) as total_decisions,
  COUNT(*) FILTER (WHERE outcome = 'success') as successful,
  COUNT(*) FILTER (WHERE outcome = 'failed') as failed,
  COUNT(*) FILTER (WHERE outcome = 'pending') as pending,
  ROUND(
    CAST(COUNT(*) FILTER (WHERE outcome = 'success') AS NUMERIC) /
    NULLIF(COUNT(*) FILTER (WHERE outcome IN ('success', 'failed')), 0) * 100,
    2
  ) as success_rate,
  ROUND(AVG(confidence), 3) as avg_confidence,
  ROUND(AVG(response_time_ms), 0) as avg_response_time_ms,
  ROUND(SUM(cost_usd), 4) as total_cost_usd,
  DATE_TRUNC('day', created_at) as date
FROM public.ai_decisions_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY decision_type, DATE_TRUNC('day', created_at)
ORDER BY date DESC, decision_type;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.ai_decisions_log TO authenticated;
GRANT SELECT ON ai_performance_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_decision_success_rate(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_learning_insights(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION log_ai_decision(TEXT, TEXT, JSONB, NUMERIC, JSONB, TEXT, TEXT, TEXT, INTEGER, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION update_ai_decision_outcome(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Comment on table
COMMENT ON TABLE public.ai_decisions_log IS 'Tracks all AI-generated decisions and their outcomes for learning and performance monitoring';
COMMENT ON FUNCTION get_ai_decision_success_rate(TEXT, INTEGER) IS 'Calculates success rate for a specific AI decision type over a time period';
COMMENT ON FUNCTION get_ai_learning_insights(TEXT, INTEGER) IS 'Returns patterns that have been most successful for AI recommendations';
COMMENT ON FUNCTION log_ai_decision(TEXT, TEXT, JSONB, NUMERIC, JSONB, TEXT, TEXT, TEXT, INTEGER, NUMERIC, TEXT) IS 'Logs a new AI decision to the database';
COMMENT ON FUNCTION update_ai_decision_outcome(UUID, TEXT, TEXT, TEXT, TEXT) IS 'Updates the outcome of an AI decision when results are known';
