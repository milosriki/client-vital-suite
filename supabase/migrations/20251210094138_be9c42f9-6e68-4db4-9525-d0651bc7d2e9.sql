-- TASK 01: Create sync_errors table
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

CREATE INDEX IF NOT EXISTS idx_sync_errors_unresolved ON sync_errors(created_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sync_errors_source ON sync_errors(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_errors_type ON sync_errors(error_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_errors_retry ON sync_errors(next_retry_at) WHERE resolved_at IS NULL AND retry_count < max_retries;
CREATE INDEX IF NOT EXISTS idx_sync_errors_object ON sync_errors(object_type, object_id);

CREATE OR REPLACE FUNCTION update_sync_errors_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_errors_updated_at BEFORE UPDATE ON sync_errors FOR EACH ROW EXECUTE FUNCTION update_sync_errors_updated_at();

-- Enable RLS
ALTER TABLE sync_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access sync_errors" ON sync_errors FOR ALL USING (is_admin());
CREATE POLICY "Public read sync_errors" ON sync_errors FOR SELECT USING (true);

-- TASK 02: Create HubSpot Property Cache
CREATE TABLE IF NOT EXISTS public.hubspot_property_definitions (
  object_type TEXT NOT NULL CHECK (object_type IN ('contact', 'deal', 'company', 'engagement')),
  property_name TEXT NOT NULL,
  property_label TEXT,
  field_type TEXT,
  options JSONB DEFAULT '[]'::jsonb,
  is_required BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  description TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (object_type, property_name)
);

CREATE INDEX idx_hubspot_props_type ON hubspot_property_definitions(object_type);
CREATE INDEX idx_hubspot_props_updated ON hubspot_property_definitions(last_synced_at);

ALTER TABLE hubspot_property_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access hubspot_props" ON hubspot_property_definitions FOR ALL USING (is_admin());
CREATE POLICY "Public read hubspot_props" ON hubspot_property_definitions FOR SELECT USING (true);

-- TASK 03: Agent Context Cache
CREATE TABLE IF NOT EXISTS public.agent_context (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  agent_type TEXT CHECK (agent_type IN ('analyst', 'advisor', 'watcher')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_context_expires ON agent_context(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE agent_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access agent_context" ON agent_context FOR ALL USING (is_admin());
CREATE POLICY "Public read agent_context" ON agent_context FOR SELECT USING (true);

-- Enable realtime for sync_errors
ALTER PUBLICATION supabase_realtime ADD TABLE sync_errors;