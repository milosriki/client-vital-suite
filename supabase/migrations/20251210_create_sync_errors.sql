-- ============================================
-- TASK 01: Create sync_errors Table
-- Agent: 1 | Priority: P0 | Risk: SAFE
-- Purpose: Track all sync errors for HubSpot performance & visibility
-- ============================================

CREATE TABLE IF NOT EXISTS public.sync_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL CHECK (error_type IN ('rate_limit', 'field_mapping', 'auth', 'timeout', 'validation', 'network')),
  source TEXT NOT NULL CHECK (source IN ('hubspot', 'stripe', 'meta', 'internal')),
  object_type TEXT,
  object_id TEXT,
  operation TEXT CHECK (operation IN ('create', 'update', 'delete', 'batch', 'fetch')),
  error_message TEXT NOT NULL,
  error_details JSONB DEFAULT '{}'::jsonb,
  request_payload JSONB,
  response_payload JSONB,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sync_errors_unresolved ON sync_errors(created_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sync_errors_source ON sync_errors(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_errors_type ON sync_errors(error_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_errors_retry ON sync_errors(next_retry_at) WHERE resolved_at IS NULL AND retry_count < max_retries;
CREATE INDEX IF NOT EXISTS idx_sync_errors_object ON sync_errors(object_type, object_id);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_sync_errors_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_errors_updated_at ON sync_errors;
CREATE TRIGGER sync_errors_updated_at
  BEFORE UPDATE ON sync_errors
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_errors_updated_at();

-- Enable RLS
ALTER TABLE sync_errors ENABLE ROW LEVEL SECURITY;

-- RLS Policies - authenticated users can read, service role can write
CREATE POLICY "Authenticated users can read sync_errors"
  ON sync_errors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage sync_errors"
  ON sync_errors FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment for documentation
COMMENT ON TABLE sync_errors IS 'Tracks all sync errors from HubSpot, Stripe, Meta, and internal sources for monitoring and retry logic';
