-- Memory retention TTL + context namespacing (combined Task 3 + Task 8)
-- Rollback:
--   ALTER TABLE public.agent_memory DROP COLUMN IF EXISTS archived;
--   ALTER TABLE public.agent_memory DROP COLUMN IF EXISTS expires_at;
--   ALTER TABLE public.agent_memory DROP COLUMN IF EXISTS agent_name;
--   ALTER TABLE public.agent_conversations DROP COLUMN IF EXISTS expires_at;
--   ALTER TABLE public.agent_decisions DROP COLUMN IF EXISTS expires_at;
--   ALTER TABLE public.agent_patterns DROP COLUMN IF EXISTS agent_name;
--   ALTER TABLE public.agent_learnings DROP COLUMN IF EXISTS agent_name;
--   DROP INDEX IF EXISTS idx_am_expires;
--   DROP INDEX IF EXISTS idx_ac_expires;
--   DROP INDEX IF EXISTS idx_ad_expires;
--   DROP INDEX IF EXISTS idx_am_agent;
--   DROP INDEX IF EXISTS idx_ap_agent;
--   DROP INDEX IF EXISTS idx_al_agent;

-- === RETENTION: Add TTL columns ===

ALTER TABLE public.agent_memory
  ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.agent_conversations
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.agent_decisions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Backfill existing rows with expiry
-- agent_memory: 90 days
-- agent_conversations: 180 days
-- agent_decisions: 365 days
-- agent_learnings: NEVER (human feedback is precious)
-- agent_patterns: NEVER (learned behaviors are precious)

UPDATE public.agent_memory
  SET expires_at = created_at + INTERVAL '90 days'
  WHERE expires_at IS NULL AND created_at IS NOT NULL;

UPDATE public.agent_conversations
  SET expires_at = created_at + INTERVAL '180 days'
  WHERE expires_at IS NULL AND created_at IS NOT NULL;

UPDATE public.agent_decisions
  SET expires_at = created_at + INTERVAL '365 days'
  WHERE expires_at IS NULL AND created_at IS NOT NULL;

-- Retention indexes
CREATE INDEX IF NOT EXISTS idx_am_expires ON public.agent_memory(expires_at) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_ac_expires ON public.agent_conversations(expires_at);
CREATE INDEX IF NOT EXISTS idx_ad_expires ON public.agent_decisions(expires_at);

-- === NAMESPACING: Add agent_name columns ===

ALTER TABLE public.agent_memory
  ADD COLUMN IF NOT EXISTS agent_name text DEFAULT 'ptd-agent-gemini';

ALTER TABLE public.agent_patterns
  ADD COLUMN IF NOT EXISTS agent_name text DEFAULT 'shared';

-- Create agent_learnings if it doesn't exist (may not be in production)
CREATE TABLE IF NOT EXISTS public.agent_learnings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name text DEFAULT 'shared',
  learning_type text,
  content text,
  context jsonb DEFAULT '{}'::jsonb,
  confidence numeric DEFAULT 0.5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.agent_learnings
  ADD COLUMN IF NOT EXISTS agent_name text DEFAULT 'shared';

-- Namespacing indexes
CREATE INDEX IF NOT EXISTS idx_am_agent ON public.agent_memory(agent_name);
CREATE INDEX IF NOT EXISTS idx_ap_agent ON public.agent_patterns(agent_name);
CREATE INDEX IF NOT EXISTS idx_al_agent ON public.agent_learnings(agent_name);

COMMENT ON COLUMN public.agent_memory.expires_at IS 'Auto-set on insert. NULL = never expires. 90d default.';
COMMENT ON COLUMN public.agent_memory.agent_name IS 'Function name for context isolation. Prevents cross-agent memory pollution.';
