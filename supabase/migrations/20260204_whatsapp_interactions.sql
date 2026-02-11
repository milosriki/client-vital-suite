-- High-Speed WhatsApp Interactions Table
-- Store full message history for AI context retrieval

CREATE TABLE IF NOT EXISTS whatsapp_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    message_text TEXT,
    response_text TEXT,
    status TEXT DEFAULT 'pending', -- pending, delivered, failed
    whatsapp_id TEXT, -- AISensy or WhatsApp message ID
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by phone number (Critical for <1s response)
CREATE INDEX IF NOT EXISTS idx_whatsapp_interactions_phone 
ON whatsapp_interactions(phone_number, created_at DESC);

-- Enable RLS
ALTER TABLE whatsapp_interactions ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything
DO $$ BEGIN
  CREATE POLICY "Service role can manage all"
  ON whatsapp_interactions
  FOR ALL
  USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
