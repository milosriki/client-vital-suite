-- ============================================
-- LEAD UTILIZATION SYSTEM - DATABASE TABLES
-- Agent 6 Implementation - December 8, 2024
-- ============================================

-- ============================================
-- 1. CALL RECORDS TABLE
-- Tracks every call/contact attempt made to clients
-- ============================================
CREATE TABLE IF NOT EXISTS call_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Client identification
  client_email TEXT NOT NULL,
  firstname TEXT,
  lastname TEXT,

  -- Call details
  call_date TIMESTAMPTZ DEFAULT NOW(),
  call_type TEXT CHECK (call_type IN ('PHONE', 'WHATSAPP', 'EMAIL', 'SMS', 'IN_PERSON')),

  -- Outcome
  status TEXT CHECK (status IN ('COMPLETED', 'NO_ANSWER', 'VOICEMAIL', 'DECLINED', 'SCHEDULED')),
  outcome TEXT CHECK (outcome IN ('BOOKED', 'INTERESTED', 'NOT_INTERESTED', 'CALLBACK', 'NO_ANSWER', 'OTHER')),

  -- Contact details
  executed_by TEXT, -- Who made the call (coach/setter name)
  duration_seconds INT,
  notes TEXT,

  -- Follow-up
  follow_up_needed BOOLEAN DEFAULT FALSE,
  follow_up_date TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for call_records
CREATE INDEX IF NOT EXISTS idx_call_records_email ON call_records(client_email, call_date DESC);
CREATE INDEX IF NOT EXISTS idx_call_records_date ON call_records(call_date DESC);
CREATE INDEX IF NOT EXISTS idx_call_records_executed_by ON call_records(executed_by, call_date DESC);
CREATE INDEX IF NOT EXISTS idx_call_records_status ON call_records(status);

-- ============================================
-- 2. LEAD STATUS TRACKER TABLE
-- Tracks current status and next action for every lead
-- ============================================
CREATE TABLE IF NOT EXISTS lead_status_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Client identification
  client_email TEXT NOT NULL UNIQUE,
  firstname TEXT,
  lastname TEXT,

  -- Current status
  status TEXT NOT NULL CHECK (status IN ('NEEDS_CALL', 'CONTACTED', 'BOOKED', 'NO_ANSWER', 'DECLINED', 'NURTURING', 'LOST')),

  -- Last action tracking
  last_action_date TIMESTAMPTZ DEFAULT NOW(),
  last_action_type TEXT, -- 'CALL', 'EMAIL', 'WHATSAPP', etc.
  last_action_by TEXT, -- Coach/setter name
  last_action_outcome TEXT,

  -- Next action planning
  next_action_date TIMESTAMPTZ,
  next_action_type TEXT,
  next_action_priority INT CHECK (next_action_priority BETWEEN 1 AND 10), -- 1=low, 10=critical

  -- AI recommendations
  ai_recommendation TEXT,
  ai_draft_message TEXT,
  ai_priority_score NUMERIC(5,2), -- 0-100
  ai_recommended_channel TEXT, -- 'PHONE', 'WHATSAPP', 'EMAIL'
  ai_reasoning TEXT,
  ai_last_updated TIMESTAMPTZ,

  -- Contact owner tracking
  current_owner TEXT, -- HubSpot owner name
  previous_owner TEXT,
  owner_changed_at TIMESTAMPTZ,
  days_with_current_owner INT DEFAULT 0,

  -- Engagement metrics
  days_since_last_contact INT DEFAULT 0,
  total_contact_attempts INT DEFAULT 0,
  successful_contacts INT DEFAULT 0,
  last_booking_date TIMESTAMPTZ,
  days_since_last_booking INT,

  -- Health & risk
  current_health_zone TEXT, -- RED, YELLOW, GREEN, etc.
  risk_score NUMERIC(5,2),
  pattern_status TEXT, -- PATTERN_BREAK, ON_TRACK, etc.

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one record per client
  CONSTRAINT unique_client_email UNIQUE (client_email)
);

-- Indexes for lead_status_tracker
CREATE INDEX IF NOT EXISTS idx_lead_status ON lead_status_tracker(status);
CREATE INDEX IF NOT EXISTS idx_lead_priority ON lead_status_tracker(ai_priority_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_lead_owner ON lead_status_tracker(current_owner);
CREATE INDEX IF NOT EXISTS idx_lead_days_since_contact ON lead_status_tracker(days_since_last_contact DESC);
CREATE INDEX IF NOT EXISTS idx_lead_next_action ON lead_status_tracker(next_action_date ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_lead_health_zone ON lead_status_tracker(current_health_zone);

-- ============================================
-- 3. ADD OWNER TRACKING TO CLIENT_HEALTH_SCORES
-- ============================================
ALTER TABLE client_health_scores
ADD COLUMN IF NOT EXISTS hubspot_owner_name TEXT,
ADD COLUMN IF NOT EXISTS previous_owner TEXT,
ADD COLUMN IF NOT EXISTS owner_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS days_since_last_session INT,
ADD COLUMN IF NOT EXISTS pattern_status TEXT CHECK (pattern_status IN ('ON_TRACK', 'PATTERN_BREAK', 'IRREGULAR', 'NEW'));

-- Index for owner tracking
CREATE INDEX IF NOT EXISTS idx_health_owner ON client_health_scores(hubspot_owner_name);
CREATE INDEX IF NOT EXISTS idx_health_pattern_status ON client_health_scores(pattern_status);

-- ============================================
-- 4. FUNCTIONS FOR LEAD UTILIZATION
-- ============================================

-- Function to calculate days since last contact
CREATE OR REPLACE FUNCTION calculate_days_since_contact(p_email TEXT)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_days INT;
BEGIN
  SELECT EXTRACT(DAY FROM (NOW() - MAX(call_date)))::INT
  INTO v_days
  FROM call_records
  WHERE client_email = p_email;

  RETURN COALESCE(v_days, 999); -- Return 999 if never contacted
END;
$$;

-- Function to get leads needing attention (to be called by Edge Function)
CREATE OR REPLACE FUNCTION get_leads_needing_attention(
  p_owner TEXT DEFAULT NULL,
  p_days_threshold INT DEFAULT 7,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  client_email TEXT,
  firstname TEXT,
  lastname TEXT,
  days_since_contact INT,
  current_health_zone TEXT,
  risk_score NUMERIC,
  pattern_status TEXT,
  owner TEXT,
  last_action_date TIMESTAMPTZ,
  ai_priority_score NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lst.client_email,
    lst.firstname,
    lst.lastname,
    lst.days_since_last_contact,
    lst.current_health_zone,
    lst.risk_score,
    lst.pattern_status,
    lst.current_owner,
    lst.last_action_date,
    lst.ai_priority_score
  FROM lead_status_tracker lst
  WHERE
    (p_owner IS NULL OR lst.current_owner = p_owner)
    AND lst.days_since_last_contact >= p_days_threshold
    AND lst.status NOT IN ('LOST', 'DECLINED')
  ORDER BY
    lst.ai_priority_score DESC NULLS LAST,
    lst.days_since_last_contact DESC
  LIMIT p_limit;
END;
$$;

-- Function to update lead status from call record
CREATE OR REPLACE FUNCTION update_lead_from_call()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update or insert into lead_status_tracker
  INSERT INTO lead_status_tracker (
    client_email,
    firstname,
    lastname,
    status,
    last_action_date,
    last_action_type,
    last_action_by,
    last_action_outcome,
    total_contact_attempts,
    days_since_last_contact
  )
  VALUES (
    NEW.client_email,
    NEW.firstname,
    NEW.lastname,
    CASE
      WHEN NEW.outcome = 'BOOKED' THEN 'BOOKED'
      WHEN NEW.status = 'NO_ANSWER' THEN 'NO_ANSWER'
      WHEN NEW.status = 'DECLINED' THEN 'DECLINED'
      ELSE 'CONTACTED'
    END,
    NEW.call_date,
    NEW.call_type,
    NEW.executed_by,
    NEW.outcome,
    1,
    0
  )
  ON CONFLICT (client_email)
  DO UPDATE SET
    status = CASE
      WHEN NEW.outcome = 'BOOKED' THEN 'BOOKED'
      WHEN NEW.status = 'NO_ANSWER' THEN 'NO_ANSWER'
      WHEN NEW.status = 'DECLINED' THEN 'DECLINED'
      ELSE 'CONTACTED'
    END,
    last_action_date = NEW.call_date,
    last_action_type = NEW.call_type,
    last_action_by = NEW.executed_by,
    last_action_outcome = NEW.outcome,
    total_contact_attempts = lead_status_tracker.total_contact_attempts + 1,
    successful_contacts = CASE
      WHEN NEW.status = 'COMPLETED' THEN lead_status_tracker.successful_contacts + 1
      ELSE lead_status_tracker.successful_contacts
    END,
    days_since_last_contact = 0,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Trigger to auto-update lead status when call is recorded
CREATE TRIGGER trigger_update_lead_from_call
  AFTER INSERT ON call_records
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_from_call();

-- Function to sync lead tracker from health scores
CREATE OR REPLACE FUNCTION sync_lead_tracker_from_health()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO lead_status_tracker (
    client_email,
    firstname,
    lastname,
    current_health_zone,
    risk_score,
    pattern_status,
    current_owner,
    days_since_last_contact
  )
  VALUES (
    NEW.email,
    NEW.firstname,
    NEW.lastname,
    NEW.health_zone,
    NEW.predictive_risk_score,
    NEW.pattern_status,
    NEW.hubspot_owner_name,
    COALESCE(NEW.days_since_last_session, 0)
  )
  ON CONFLICT (client_email)
  DO UPDATE SET
    firstname = NEW.firstname,
    lastname = NEW.lastname,
    current_health_zone = NEW.health_zone,
    risk_score = NEW.predictive_risk_score,
    pattern_status = NEW.pattern_status,
    previous_owner = CASE
      WHEN lead_status_tracker.current_owner IS DISTINCT FROM NEW.hubspot_owner_name
      THEN lead_status_tracker.current_owner
      ELSE lead_status_tracker.previous_owner
    END,
    current_owner = NEW.hubspot_owner_name,
    owner_changed_at = CASE
      WHEN lead_status_tracker.current_owner IS DISTINCT FROM NEW.hubspot_owner_name
      THEN NOW()
      ELSE lead_status_tracker.owner_changed_at
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Trigger to sync lead tracker when health scores update
CREATE TRIGGER trigger_sync_lead_tracker
  AFTER INSERT OR UPDATE ON client_health_scores
  FOR EACH ROW
  EXECUTE FUNCTION sync_lead_tracker_from_health();

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_status_tracker ENABLE ROW LEVEL SECURITY;

-- Public access policies (adjust as needed for your security requirements)
CREATE POLICY "Allow public read access" ON call_records FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON call_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON call_records FOR UPDATE USING (true);

CREATE POLICY "Allow public read access" ON lead_status_tracker FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON lead_status_tracker FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON lead_status_tracker FOR UPDATE USING (true);

-- ============================================
-- 6. UPDATE TRIGGERS
-- ============================================
CREATE TRIGGER update_call_records_updated_at
  BEFORE UPDATE ON call_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_lead_tracker_updated_at
  BEFORE UPDATE ON lead_status_tracker
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Tables created:
-- - call_records: Track all call attempts
-- - lead_status_tracker: Current status of every lead
-- Columns added to client_health_scores:
-- - hubspot_owner_name, previous_owner, owner_changed_at
-- - days_since_last_session, pattern_status
-- Functions created:
-- - calculate_days_since_contact()
-- - get_leads_needing_attention()
-- - update_lead_from_call() (trigger function)
-- - sync_lead_tracker_from_health() (trigger function)
