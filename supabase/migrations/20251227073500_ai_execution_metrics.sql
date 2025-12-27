-- AI Execution Metrics Table
-- Tracks all AI function executions for observability dashboard

CREATE TABLE IF NOT EXISTS ai_execution_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  request_id TEXT,
  correlation_id TEXT NOT NULL,
  trace_id TEXT,
  
  -- Function info
  function_name TEXT NOT NULL,
  run_type TEXT DEFAULT 'chain',
  
  -- AI Provider info
  provider TEXT,
  model TEXT,
  
  -- Performance
  latency_ms INTEGER,
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_usd_est DECIMAL(10, 6),
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  http_status INTEGER,
  error_message TEXT,
  error_type TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  tags TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_metrics_function_name ON ai_execution_metrics(function_name);
CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON ai_execution_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_correlation_id ON ai_execution_metrics(correlation_id);
CREATE INDEX IF NOT EXISTS idx_metrics_trace_id ON ai_execution_metrics(trace_id);
CREATE INDEX IF NOT EXISTS idx_metrics_status ON ai_execution_metrics(status);
CREATE INDEX IF NOT EXISTS idx_metrics_provider ON ai_execution_metrics(provider);

-- Composite index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_metrics_function_created 
  ON ai_execution_metrics(function_name, created_at DESC);

-- Enable RLS
ALTER TABLE ai_execution_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything
CREATE POLICY "Service role full access" ON ai_execution_metrics
  FOR ALL USING (auth.role() = 'service_role');

-- Policy: Authenticated users can read
CREATE POLICY "Authenticated users can read" ON ai_execution_metrics
  FOR SELECT USING (auth.role() = 'authenticated');

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_ai_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_execution_metrics_updated_at
  BEFORE UPDATE ON ai_execution_metrics
  FOR EACH ROW EXECUTE FUNCTION update_ai_metrics_updated_at();

-- Comments
COMMENT ON TABLE ai_execution_metrics IS 'Tracks AI function executions for observability';
COMMENT ON COLUMN ai_execution_metrics.correlation_id IS 'Links frontend request to backend trace';
COMMENT ON COLUMN ai_execution_metrics.cost_usd_est IS 'Estimated cost in USD based on token usage';
