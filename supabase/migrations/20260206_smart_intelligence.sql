-- ============================================================================
-- Smart Intelligence Upgrade - Database Migration
-- Run this in Supabase SQL Editor
-- ============================================================================

-- TABLE: lead_intelligence (Real-time lead scoring)
CREATE TABLE IF NOT EXISTS lead_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  lead_score INT DEFAULT 0,
  sentiment FLOAT DEFAULT 0,
  engagement_level TEXT DEFAULT 'cold',
  conversation_stage TEXT DEFAULT 'discovery',
  last_intent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_intelligence_phone ON lead_intelligence(phone);
CREATE INDEX IF NOT EXISTS idx_lead_intelligence_score ON lead_intelligence(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_lead_intelligence_hot ON lead_intelligence(engagement_level, lead_score DESC);

-- TABLE: conversation_memory (Short + Long term memory)
CREATE TABLE IF NOT EXISTS conversation_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  short_term JSONB DEFAULT '[]',
  long_term JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_memory_phone ON conversation_memory(phone);

-- VIEW: daily_performance_dashboard
CREATE OR REPLACE VIEW daily_performance_dashboard AS
SELECT 
  DATE(created_at) as date,
  COUNT(DISTINCT phone) as total_leads,
  ROUND(AVG(lead_score)::numeric, 1) as avg_lead_score,
  COUNT(DISTINCT CASE WHEN lead_score >= 70 THEN phone END) as hot_leads,
  COUNT(DISTINCT CASE WHEN engagement_level = 'hot' THEN phone END) as engaged_leads,
  ROUND(AVG(sentiment)::numeric, 2) as avg_sentiment
FROM lead_intelligence
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Add lead_score column to leads table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'leads' AND column_name = 'lead_score') THEN
    ALTER TABLE leads ADD COLUMN lead_score INT DEFAULT 0;
  END IF;
END $$;
