-- ============================================
-- CREATE lead_ai_replies TABLE
-- Stores AI-generated replies for leads
-- Used when leads.ai_suggested_reply column doesn't exist
-- or when using contacts table as fallback
-- ============================================

CREATE TABLE IF NOT EXISTS public.lead_ai_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  contact_id TEXT,
  lead_id TEXT,
  reply_text TEXT NOT NULL,
  source_table TEXT DEFAULT 'leads', -- 'leads' or 'contacts'
  synced_to_hubspot BOOLEAN DEFAULT FALSE,
  hubspot_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lookup
CREATE INDEX IF NOT EXISTS idx_lead_ai_replies_email ON public.lead_ai_replies(email);
CREATE INDEX IF NOT EXISTS idx_lead_ai_replies_contact_id ON public.lead_ai_replies(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_ai_replies_synced ON public.lead_ai_replies(synced_to_hubspot) WHERE synced_to_hubspot = FALSE;
CREATE INDEX IF NOT EXISTS idx_lead_ai_replies_created ON public.lead_ai_replies(created_at DESC);

-- RLS policies
ALTER TABLE public.lead_ai_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON public.lead_ai_replies FOR ALL USING (true);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_lead_ai_replies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lead_ai_replies_updated_at ON public.lead_ai_replies;
CREATE TRIGGER trigger_lead_ai_replies_updated_at
  BEFORE UPDATE ON public.lead_ai_replies
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_ai_replies_updated_at();

-- RPC function to create table (called from Edge Function if table doesn't exist)
CREATE OR REPLACE FUNCTION create_lead_ai_replies_table()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Table already exists if this migration ran, so this is a no-op
  -- Kept for backwards compatibility with Edge Function
  RAISE NOTICE 'lead_ai_replies table already exists';
END;
$$;

-- Comment for documentation
COMMENT ON TABLE public.lead_ai_replies IS 'Stores AI-generated lead replies. TODO: Sync back to HubSpot via hubspot-webhook or dedicated function.';

