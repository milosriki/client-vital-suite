CREATE TABLE IF NOT EXISTS public.agent_context (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  agent_type TEXT CHECK (agent_type IN ('analyst', 'advisor', 'watcher')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_context_expires ON agent_context(expires_at) WHERE expires_at IS NOT NULL;
