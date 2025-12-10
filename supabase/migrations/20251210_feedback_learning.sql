-- ============================================
-- FEEDBACK LEARNING SYSTEM
-- Continuous improvement from user corrections
-- ============================================

-- User feedback on agent responses
CREATE TABLE IF NOT EXISTS agent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  feedback_type TEXT, -- 'positive', 'negative', 'correction'
  correction TEXT, -- User's corrected answer
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- 1-5 stars
  feedback_details JSONB,
  learned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast query lookups
CREATE INDEX IF NOT EXISTS idx_agent_feedback_thread ON agent_feedback(thread_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_type ON agent_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_learned ON agent_feedback(learned_at) WHERE learned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_feedback_created ON agent_feedback(created_at DESC);

-- Learned corrections (what agent got wrong and how to fix)
CREATE TABLE IF NOT EXISTS agent_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern TEXT NOT NULL, -- What triggers this correction (normalized query pattern)
  wrong_answer TEXT,
  correct_answer TEXT NOT NULL,
  confidence FLOAT DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  times_applied INTEGER DEFAULT 0,
  times_confirmed INTEGER DEFAULT 0, -- How many times users confirmed this correction
  times_rejected INTEGER DEFAULT 0, -- How many times users rejected this correction
  context_tags TEXT[], -- Tags for categorization (e.g., 'health_score', 'formula', 'client_analysis')
  feedback_ids UUID[], -- References to agent_feedback that created/updated this
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast pattern matching
CREATE INDEX IF NOT EXISTS idx_agent_corrections_pattern ON agent_corrections USING gin(to_tsvector('english', pattern));
CREATE INDEX IF NOT EXISTS idx_agent_corrections_confidence ON agent_corrections(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_agent_corrections_tags ON agent_corrections USING gin(context_tags);
CREATE INDEX IF NOT EXISTS idx_agent_corrections_updated ON agent_corrections(updated_at DESC);

-- Function to find similar patterns using text search
CREATE OR REPLACE FUNCTION find_relevant_corrections(query_text TEXT, min_confidence FLOAT DEFAULT 0.5, max_results INTEGER DEFAULT 5)
RETURNS TABLE (
  id UUID,
  pattern TEXT,
  correct_answer TEXT,
  confidence FLOAT,
  times_applied INTEGER,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.pattern,
    c.correct_answer,
    c.confidence,
    c.times_applied,
    ts_rank(to_tsvector('english', c.pattern), plainto_tsquery('english', query_text)) as similarity
  FROM agent_corrections c
  WHERE
    c.confidence >= min_confidence
    AND to_tsvector('english', c.pattern) @@ plainto_tsquery('english', query_text)
  ORDER BY
    similarity DESC,
    c.confidence DESC,
    c.times_confirmed DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to update correction confidence based on feedback
CREATE OR REPLACE FUNCTION update_correction_confidence(correction_id UUID, was_helpful BOOLEAN)
RETURNS VOID AS $$
DECLARE
  current_confirmed INTEGER;
  current_rejected INTEGER;
  new_confidence FLOAT;
BEGIN
  -- Get current stats
  SELECT times_confirmed, times_rejected
  INTO current_confirmed, current_rejected
  FROM agent_corrections
  WHERE id = correction_id;

  -- Update counters
  IF was_helpful THEN
    UPDATE agent_corrections
    SET
      times_confirmed = times_confirmed + 1,
      updated_at = now()
    WHERE id = correction_id;
    current_confirmed := current_confirmed + 1;
  ELSE
    UPDATE agent_corrections
    SET
      times_rejected = times_rejected + 1,
      updated_at = now()
    WHERE id = correction_id;
    current_rejected := current_rejected + 1;
  END IF;

  -- Calculate new confidence (Bayesian-ish approach)
  -- Start with base 0.5, then adjust based on success rate
  -- Add smoothing to prevent extreme values
  new_confidence := (current_confirmed + 1.0) / (current_confirmed + current_rejected + 2.0);

  -- Update confidence
  UPDATE agent_corrections
  SET confidence = new_confidence
  WHERE id = correction_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get feedback statistics
CREATE OR REPLACE FUNCTION get_feedback_stats(days_back INTEGER DEFAULT 7)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_feedback', COUNT(*),
    'positive', COUNT(*) FILTER (WHERE feedback_type = 'positive'),
    'negative', COUNT(*) FILTER (WHERE feedback_type = 'negative'),
    'corrections', COUNT(*) FILTER (WHERE feedback_type = 'correction'),
    'avg_rating', ROUND(AVG(rating)::numeric, 2),
    'learned_corrections', COUNT(*) FILTER (WHERE learned_at IS NOT NULL),
    'period_days', days_back
  )
  INTO result
  FROM agent_feedback
  WHERE created_at >= now() - (days_back || ' days')::interval;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get top corrections by confidence
CREATE OR REPLACE FUNCTION get_top_corrections(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  pattern TEXT,
  correct_answer TEXT,
  confidence FLOAT,
  times_applied INTEGER,
  times_confirmed INTEGER,
  times_rejected INTEGER,
  success_rate FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.pattern,
    c.correct_answer,
    c.confidence,
    c.times_applied,
    c.times_confirmed,
    c.times_rejected,
    CASE
      WHEN (c.times_confirmed + c.times_rejected) > 0
      THEN ROUND((c.times_confirmed::float / (c.times_confirmed + c.times_rejected))::numeric, 2)
      ELSE 0.0
    END as success_rate
  FROM agent_corrections c
  ORDER BY c.confidence DESC, c.times_confirmed DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_corrections_updated_at
BEFORE UPDATE ON agent_corrections
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON agent_feedback TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON agent_corrections TO authenticated;
-- GRANT EXECUTE ON FUNCTION find_relevant_corrections TO authenticated;
-- GRANT EXECUTE ON FUNCTION update_correction_confidence TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_feedback_stats TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_top_corrections TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE agent_feedback IS 'Stores user feedback on agent responses for continuous learning';
COMMENT ON TABLE agent_corrections IS 'Learned corrections that improve agent responses over time';
COMMENT ON FUNCTION find_relevant_corrections IS 'Finds corrections relevant to a query using text similarity';
COMMENT ON FUNCTION update_correction_confidence IS 'Updates correction confidence based on user feedback (Bayesian approach)';
COMMENT ON FUNCTION get_feedback_stats IS 'Returns aggregated feedback statistics for monitoring';
COMMENT ON FUNCTION get_top_corrections IS 'Returns the most confident and successful corrections';
