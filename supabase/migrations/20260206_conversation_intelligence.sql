-- ================================================================
-- CONVERSATION INTELLIGENCE TABLE (Sidecar)
-- Run this in Supabase SQL Editor
-- ================================================================

-- DROP TABLE IF EXISTS conversation_intelligence;

CREATE TABLE IF NOT EXISTS conversation_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to your existing leads table
  phone TEXT NOT NULL UNIQUE, -- Added UNIQUE constraint for safety
  
  -- ============================================
  -- AI ANALYSIS DATA
  -- ============================================
  
  -- Lead scoring (0 = ice cold, 100 = ready to book)
  lead_score INT DEFAULT 10
    CHECK (lead_score >= 0 AND lead_score <= 100),
  
  -- Lead temperature classification
  lead_temperature TEXT DEFAULT 'cold'
    CHECK (lead_temperature IN ('cold', 'warm', 'hot')),
  
  -- Psychological classification
  psychological_profile TEXT,
  
  -- The specific pain point identified
  dominant_pain TEXT,
  
  -- Their real desired outcome (emotional, not surface)
  desired_outcome TEXT,
  
  -- The blocker preventing them from acting
  primary_blocker TEXT,
  
  -- Current conversation phase
  conversation_phase TEXT DEFAULT 'hook'
    CHECK (conversation_phase IN (
      'hook', 'diagnosis', 'reframe', 'close',
      'followup', 'booked', 'lost'
    )),
  
  -- ============================================
  -- AI MEMORY / THOUGHT LOG
  -- ============================================
  
  -- The AI's last internal thought (JSON string)
  last_internal_thought JSONB,
  
  -- Running summary of key conversation points
  conversation_summary TEXT,
  
  -- Total message count
  message_count INT DEFAULT 0,
  
  -- ============================================
  -- OBJECTION TRACKING
  -- ============================================
  
  -- Track which objections have been raised
  objections_raised TEXT[] DEFAULT '{}',
  
  -- Track what objections have been handled
  objections_handled TEXT[] DEFAULT '{}',
  
  -- ============================================
  -- FOLLOW-UP DATA
  -- ============================================
  
  -- When the lead last sent a message
  last_lead_message_at TIMESTAMPTZ,
  
  -- How many follow-ups have been sent
  followup_count INT DEFAULT 0,
  
  -- What stage of follow-up we're at
  followup_stage TEXT DEFAULT 'none'
    CHECK (followup_stage IN (
      'none', 'challenge_sent', 'value_drop_sent',
      'breakup_sent', 'exhausted'
    )),
  
  -- ============================================
  -- METADATA
  -- ============================================
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_ci_phone ON conversation_intelligence(phone);

CREATE INDEX IF NOT EXISTS idx_ci_hot_leads ON conversation_intelligence(lead_score DESC)
  WHERE lead_temperature = 'hot';

CREATE INDEX IF NOT EXISTS idx_ci_followup ON conversation_intelligence(last_lead_message_at)
  WHERE followup_stage != 'exhausted'
    AND conversation_phase NOT IN ('booked', 'lost');

CREATE INDEX IF NOT EXISTS idx_ci_phase ON conversation_intelligence(conversation_phase);

-- ============================================
-- AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_ci_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ci_updated_at_trigger ON conversation_intelligence;
CREATE TRIGGER ci_updated_at_trigger
  BEFORE UPDATE ON conversation_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION update_ci_timestamp();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE conversation_intelligence ENABLE ROW LEVEL SECURITY;

-- Allow your Edge Functions (service role) full access
DROP POLICY IF EXISTS ci_service_policy ON conversation_intelligence;
CREATE POLICY ci_service_policy
  ON conversation_intelligence
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- USEFUL VIEWS FOR YOUR DASHBOARD
-- ============================================

CREATE OR REPLACE VIEW v_active_pipeline AS
SELECT
  -- l.name, -- Commented out to avoid dependency error if 'leads' table missing or 'name' col missing
  ci.phone,
  ci.lead_score,
  ci.lead_temperature,
  ci.conversation_phase,
  ci.psychological_profile,
  ci.dominant_pain,
  ci.message_count,
  ci.last_lead_message_at,
  EXTRACT(EPOCH FROM (NOW() - ci.last_lead_message_at)) / 3600
    AS hours_since_last_message
FROM conversation_intelligence ci
-- LEFT JOIN leads l ON l.phone = ci.phone -- Commented out to be safe
WHERE ci.conversation_phase NOT IN ('booked', 'lost')
ORDER BY ci.lead_score DESC;

CREATE OR REPLACE VIEW v_followup_queue AS
SELECT
  -- l.name,
  ci.phone,
  ci.lead_score,
  ci.dominant_pain,
  ci.followup_stage,
  ci.followup_count,
  ci.last_lead_message_at,
  EXTRACT(EPOCH FROM (NOW() - ci.last_lead_message_at)) / 3600
    AS hours_inactive
FROM conversation_intelligence ci
-- LEFT JOIN leads l ON l.phone = ci.phone
WHERE ci.last_lead_message_at < NOW() - INTERVAL '24 hours'
  AND ci.followup_stage != 'exhausted'
  AND ci.conversation_phase NOT IN ('booked', 'lost')
ORDER BY ci.last_lead_message_at ASC;

CREATE OR REPLACE VIEW v_conversion_funnel AS
SELECT
  conversation_phase,
  COUNT(*) as total,
  ROUND(AVG(lead_score), 1) as avg_score,
  ROUND(AVG(message_count), 1) as avg_messages
FROM conversation_intelligence
GROUP BY conversation_phase
ORDER BY
  CASE conversation_phase
    WHEN 'hook' THEN 1
    WHEN 'diagnosis' THEN 2
    WHEN 'reframe' THEN 3
    WHEN 'close' THEN 4
    WHEN 'booked' THEN 5
    WHEN 'followup' THEN 6
    WHEN 'lost' THEN 7
  END;
