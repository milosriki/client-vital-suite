-- PTD Multi-Step Reasoning System
-- Database schema for storing reasoning traces and analytics

-- ============================================
-- REASONING TRACES TABLE
-- ============================================
-- Stores complete execution traces of multi-step reasoning chains

CREATE TABLE IF NOT EXISTS reasoning_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Query information
  query text NOT NULL,
  context text,

  -- Execution metadata
  chain_type text CHECK (chain_type IN ('sequential', 'parallel', 'conditional')),
  total_steps int NOT NULL DEFAULT 0,
  completed_steps int NOT NULL DEFAULT 0,
  failed_steps int NOT NULL DEFAULT 0,

  -- Performance metrics
  execution_time_ms int,
  avg_step_time_ms int GENERATED ALWAYS AS (
    CASE
      WHEN total_steps > 0 THEN execution_time_ms / total_steps
      ELSE NULL
    END
  ) STORED,

  -- Detailed trace
  steps_trace jsonb NOT NULL DEFAULT '[]'::jsonb,
  intermediate_results jsonb DEFAULT '{}'::jsonb,

  -- Results
  final_answer text,
  success boolean DEFAULT true,
  error_message text,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  user_session_id text
);

-- Indexes for performance
CREATE INDEX idx_reasoning_traces_created_at ON reasoning_traces(created_at DESC);
CREATE INDEX idx_reasoning_traces_query ON reasoning_traces USING gin(to_tsvector('english', query));
CREATE INDEX idx_reasoning_traces_chain_type ON reasoning_traces(chain_type);
CREATE INDEX idx_reasoning_traces_success ON reasoning_traces(success);
CREATE INDEX idx_reasoning_traces_session ON reasoning_traces(user_session_id);

-- Index for searching step results
CREATE INDEX idx_reasoning_traces_steps ON reasoning_traces USING gin(steps_trace);

-- ============================================
-- REASONING ANALYTICS VIEW
-- ============================================
-- Provides insights into reasoning system performance

CREATE OR REPLACE VIEW reasoning_analytics AS
SELECT
  chain_type,
  COUNT(*) as total_queries,
  COUNT(*) FILTER (WHERE success = true) as successful_queries,
  COUNT(*) FILTER (WHERE success = false) as failed_queries,
  ROUND(AVG(execution_time_ms)::numeric, 2) as avg_execution_time_ms,
  ROUND(AVG(total_steps)::numeric, 2) as avg_steps_per_query,
  ROUND(AVG(completed_steps::float / NULLIF(total_steps, 0) * 100)::numeric, 2) as avg_completion_rate,
  MIN(execution_time_ms) as min_execution_time_ms,
  MAX(execution_time_ms) as max_execution_time_ms
FROM reasoning_traces
GROUP BY chain_type;

-- ============================================
-- POPULAR QUERIES VIEW
-- ============================================
-- Track frequently asked questions

CREATE OR REPLACE VIEW popular_reasoning_queries AS
SELECT
  query,
  COUNT(*) as query_count,
  AVG(execution_time_ms) as avg_execution_time,
  MAX(created_at) as last_asked,
  chain_type,
  ROUND(AVG(completed_steps::float / NULLIF(total_steps, 0) * 100)::numeric, 2) as avg_success_rate
FROM reasoning_traces
GROUP BY query, chain_type
HAVING COUNT(*) > 1
ORDER BY query_count DESC
LIMIT 50;

-- ============================================
-- SLOW QUERIES VIEW
-- ============================================
-- Identify queries that take too long

CREATE OR REPLACE VIEW slow_reasoning_queries AS
SELECT
  id,
  query,
  chain_type,
  total_steps,
  execution_time_ms,
  created_at,
  steps_trace
FROM reasoning_traces
WHERE execution_time_ms > 10000 -- More than 10 seconds
ORDER BY execution_time_ms DESC
LIMIT 100;

-- ============================================
-- FAILED REASONING VIEW
-- ============================================
-- Track failed reasoning attempts for debugging

CREATE OR REPLACE VIEW failed_reasoning_attempts AS
SELECT
  id,
  query,
  chain_type,
  total_steps,
  completed_steps,
  failed_steps,
  error_message,
  steps_trace,
  created_at
FROM reasoning_traces
WHERE success = false OR failed_steps > 0
ORDER BY created_at DESC
LIMIT 100;

-- ============================================
-- REASONING TOOLS USAGE TABLE
-- ============================================
-- Track which tools are most frequently used

CREATE TABLE IF NOT EXISTS reasoning_tool_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name text NOT NULL,
  reasoning_trace_id uuid REFERENCES reasoning_traces(id) ON DELETE CASCADE,
  step_number int,
  execution_time_ms int,
  success boolean DEFAULT true,
  error_message text,
  result_summary text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_tool_usage_tool_name ON reasoning_tool_usage(tool_name);
CREATE INDEX idx_tool_usage_trace_id ON reasoning_tool_usage(reasoning_trace_id);
CREATE INDEX idx_tool_usage_created_at ON reasoning_tool_usage(created_at DESC);

-- ============================================
-- TOOL USAGE ANALYTICS VIEW
-- ============================================

CREATE OR REPLACE VIEW tool_usage_analytics AS
SELECT
  tool_name,
  COUNT(*) as total_uses,
  COUNT(*) FILTER (WHERE success = true) as successful_uses,
  COUNT(*) FILTER (WHERE success = false) as failed_uses,
  ROUND(AVG(execution_time_ms)::numeric, 2) as avg_execution_time_ms,
  ROUND((COUNT(*) FILTER (WHERE success = true)::float / COUNT(*) * 100)::numeric, 2) as success_rate_pct
FROM reasoning_tool_usage
GROUP BY tool_name
ORDER BY total_uses DESC;

-- ============================================
-- REASONING CACHE TABLE
-- ============================================
-- Cache frequently asked questions for faster responses

CREATE TABLE IF NOT EXISTS reasoning_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash text UNIQUE NOT NULL, -- MD5 hash of normalized query
  original_query text NOT NULL,
  cached_answer text NOT NULL,
  cached_steps jsonb,
  chain_type text,

  -- Cache metadata
  hit_count int DEFAULT 0,
  last_hit_at timestamptz,
  cache_created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '24 hours'),

  -- Quality metrics
  avg_user_rating float,
  total_ratings int DEFAULT 0,

  CONSTRAINT valid_rating CHECK (avg_user_rating >= 0 AND avg_user_rating <= 5)
);

CREATE INDEX idx_reasoning_cache_hash ON reasoning_cache(query_hash);
CREATE INDEX idx_reasoning_cache_expires ON reasoning_cache(expires_at);
CREATE INDEX idx_reasoning_cache_hits ON reasoning_cache(hit_count DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to normalize and hash queries for caching
CREATE OR REPLACE FUNCTION normalize_reasoning_query(query_text text)
RETURNS text AS $$
BEGIN
  -- Normalize: lowercase, trim, remove extra spaces
  RETURN TRIM(REGEXP_REPLACE(LOWER(query_text), '\s+', ' ', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate query hash
CREATE OR REPLACE FUNCTION hash_reasoning_query(query_text text)
RETURNS text AS $$
BEGIN
  RETURN MD5(normalize_reasoning_query(query_text));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check cache before running reasoning
CREATE OR REPLACE FUNCTION check_reasoning_cache(query_text text)
RETURNS TABLE(
  cached boolean,
  answer text,
  steps jsonb,
  chain_type text
) AS $$
DECLARE
  query_hash text;
  cache_record reasoning_cache%ROWTYPE;
BEGIN
  query_hash := hash_reasoning_query(query_text);

  -- Try to find valid cache entry
  SELECT * INTO cache_record
  FROM reasoning_cache
  WHERE reasoning_cache.query_hash = check_reasoning_cache.query_hash
    AND expires_at > now()
  LIMIT 1;

  IF FOUND THEN
    -- Update cache hit stats
    UPDATE reasoning_cache
    SET
      hit_count = hit_count + 1,
      last_hit_at = now()
    WHERE reasoning_cache.query_hash = check_reasoning_cache.query_hash;

    RETURN QUERY
    SELECT
      true as cached,
      cache_record.cached_answer as answer,
      cache_record.cached_steps as steps,
      cache_record.chain_type;
  ELSE
    RETURN QUERY
    SELECT
      false as cached,
      NULL::text as answer,
      NULL::jsonb as steps,
      NULL::text as chain_type;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to save reasoning result to cache
CREATE OR REPLACE FUNCTION save_to_reasoning_cache(
  query_text text,
  answer_text text,
  steps_data jsonb,
  chain_type_value text,
  ttl_hours int DEFAULT 24
)
RETURNS void AS $$
DECLARE
  query_hash text;
BEGIN
  query_hash := hash_reasoning_query(query_text);

  INSERT INTO reasoning_cache (
    query_hash,
    original_query,
    cached_answer,
    cached_steps,
    chain_type,
    expires_at
  )
  VALUES (
    query_hash,
    query_text,
    answer_text,
    steps_data,
    chain_type_value,
    now() + (ttl_hours || ' hours')::interval
  )
  ON CONFLICT (query_hash)
  DO UPDATE SET
    cached_answer = EXCLUDED.cached_answer,
    cached_steps = EXCLUDED.cached_steps,
    chain_type = EXCLUDED.chain_type,
    cache_created_at = now(),
    expires_at = now() + (ttl_hours || ' hours')::interval,
    hit_count = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_reasoning_cache()
RETURNS int AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM reasoning_cache
  WHERE expires_at < now();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- AUTOMATIC TOOL USAGE TRACKING
-- ============================================
-- Trigger function to extract tool usage from reasoning traces

CREATE OR REPLACE FUNCTION extract_tool_usage()
RETURNS TRIGGER AS $$
DECLARE
  step_record jsonb;
  step_data record;
BEGIN
  -- Extract each step and insert into tool usage table
  FOR step_record IN SELECT * FROM jsonb_array_elements(NEW.steps_trace)
  LOOP
    SELECT
      (step_record->>'step_number')::int as step_number,
      step_record->>'tool_to_use' as tool_name,
      (step_record->>'execution_time_ms')::int as execution_time_ms,
      (step_record->>'status' = 'completed') as success,
      step_record->>'error' as error_message,
      step_record->>'conclusion' as result_summary
    INTO step_data;

    IF step_data.tool_name IS NOT NULL THEN
      INSERT INTO reasoning_tool_usage (
        tool_name,
        reasoning_trace_id,
        step_number,
        execution_time_ms,
        success,
        error_message,
        result_summary
      )
      VALUES (
        step_data.tool_name,
        NEW.id,
        step_data.step_number,
        step_data.execution_time_ms,
        step_data.success,
        step_data.error_message,
        step_data.result_summary
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS track_tool_usage ON reasoning_traces;
CREATE TRIGGER track_tool_usage
  AFTER INSERT ON reasoning_traces
  FOR EACH ROW
  EXECUTE FUNCTION extract_tool_usage();

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE reasoning_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE reasoning_tool_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE reasoning_cache ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own reasoning traces
CREATE POLICY "Users can view own reasoning traces"
  ON reasoning_traces
  FOR SELECT
  USING (auth.uid() = created_by OR created_by IS NULL);

-- Allow users to insert their own reasoning traces
CREATE POLICY "Users can insert own reasoning traces"
  ON reasoning_traces
  FOR INSERT
  WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

-- Allow service role full access
CREATE POLICY "Service role has full access to reasoning traces"
  ON reasoning_traces
  USING (auth.jwt()->>'role' = 'service_role');

-- Tool usage policies
CREATE POLICY "Users can view tool usage for their traces"
  ON reasoning_tool_usage
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reasoning_traces
      WHERE reasoning_traces.id = reasoning_tool_usage.reasoning_trace_id
        AND (reasoning_traces.created_by = auth.uid() OR reasoning_traces.created_by IS NULL)
    )
  );

CREATE POLICY "Service role has full access to tool usage"
  ON reasoning_tool_usage
  USING (auth.jwt()->>'role' = 'service_role');

-- Cache policies (read-only for users)
CREATE POLICY "Anyone can read cache"
  ON reasoning_cache
  FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage cache"
  ON reasoning_cache
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================

-- Insert sample reasoning trace
INSERT INTO reasoning_traces (
  query,
  chain_type,
  total_steps,
  completed_steps,
  failed_steps,
  execution_time_ms,
  steps_trace,
  final_answer,
  success
) VALUES (
  'Why is revenue down this month?',
  'sequential',
  5,
  5,
  0,
  4532,
  '[
    {
      "step_number": 1,
      "question": "Get current month revenue",
      "tool_to_use": "get_revenue_data",
      "tool_args": {"period": "current_month"},
      "result": {"revenue": 45000},
      "conclusion": "Current revenue is $45,000",
      "execution_time_ms": 823,
      "status": "completed"
    },
    {
      "step_number": 2,
      "question": "Get last month revenue",
      "tool_to_use": "get_revenue_data",
      "tool_args": {"period": "last_month"},
      "result": {"revenue": 58500},
      "conclusion": "Last month revenue was $58,500",
      "execution_time_ms": 756,
      "status": "completed"
    },
    {
      "step_number": 3,
      "question": "Compare periods",
      "tool_to_use": "compare_metrics",
      "tool_args": {"metric_a": "$step_1", "metric_b": "$step_2"},
      "result": {"difference": -13500, "percent_change": -23.08},
      "conclusion": "Revenue declined 23%",
      "execution_time_ms": 234,
      "status": "completed"
    }
  ]'::jsonb,
  'Revenue decreased 23% due to fewer deals closed. Recommend investigating lead generation.',
  true
);

-- ============================================
-- CLEANUP CRON JOB
-- ============================================

-- Schedule daily cleanup of expired cache entries
-- Note: Requires pg_cron extension
SELECT cron.schedule(
  'cleanup-reasoning-cache',
  '0 2 * * *', -- 2 AM daily
  $$SELECT clean_expired_reasoning_cache();$$
);

-- ============================================
-- GRANTS
-- ============================================

-- Grant access to authenticated users
GRANT SELECT, INSERT ON reasoning_traces TO authenticated;
GRANT SELECT ON reasoning_tool_usage TO authenticated;
GRANT SELECT ON reasoning_cache TO authenticated;
GRANT SELECT ON reasoning_analytics TO authenticated;
GRANT SELECT ON popular_reasoning_queries TO authenticated;
GRANT SELECT ON tool_usage_analytics TO authenticated;

-- Grant full access to service role
GRANT ALL ON reasoning_traces TO service_role;
GRANT ALL ON reasoning_tool_usage TO service_role;
GRANT ALL ON reasoning_cache TO service_role;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE reasoning_traces IS 'Stores complete execution traces of multi-step reasoning chains with performance metrics';
COMMENT ON TABLE reasoning_tool_usage IS 'Tracks individual tool invocations within reasoning chains for analytics';
COMMENT ON TABLE reasoning_cache IS 'Caches frequently asked questions to improve response time';
COMMENT ON FUNCTION check_reasoning_cache IS 'Check if a query has a valid cached response';
COMMENT ON FUNCTION save_to_reasoning_cache IS 'Save a reasoning result to cache with configurable TTL';
COMMENT ON FUNCTION clean_expired_reasoning_cache IS 'Remove expired cache entries (run via cron)';
