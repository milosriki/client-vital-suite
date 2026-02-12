-- WhatsApp Sales Agent - Database Migration
-- Created: 2026-02-04
-- Purpose: Add tracking tables for message delivery and response safety

-- Message Delivery Log
-- Tracks all outgoing WhatsApp messages sent via HubSpot
CREATE TABLE IF NOT EXISTS message_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT NOT NULL,
  message_preview TEXT, -- First 100 chars of message
  status TEXT NOT NULL CHECK (status IN ('delivered', 'failed')),
  error_message TEXT,
  delivery_time_ms INTEGER, -- How long delivery took
  attempts INTEGER DEFAULT 1, -- Number of retry attempts
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_message_delivery_thread 
  ON message_delivery_log(thread_id);

CREATE INDEX IF NOT EXISTS idx_message_delivery_status 
  ON message_delivery_log(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_delivery_recent 
  ON message_delivery_log(created_at DESC);

-- Response Safety Log
-- Tracks instances where content filter detected potential info leaks
CREATE TABLE IF NOT EXISTS response_safety_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT NOT NULL,
  issues TEXT[] NOT NULL, -- Array of detected safety issues
  original_length INTEGER, -- Length of response before sanitization
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for safety monitoring
CREATE INDEX IF NOT EXISTS idx_response_safety_thread 
  ON response_safety_log(thread_id);

CREATE INDEX IF NOT EXISTS idx_response_safety_recent 
  ON response_safety_log(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE message_delivery_log IS 
  'Tracks all WhatsApp message deliveries via HubSpot Conversations API';

COMMENT ON COLUMN message_delivery_log.thread_id IS 
  'HubSpot conversation thread ID';

COMMENT ON COLUMN message_delivery_log.delivery_time_ms IS 
  'Time taken to deliver message in milliseconds (for performance monitoring)';

COMMENT ON TABLE response_safety_log IS 
  'Logs instances where content filter detected potential information leaks';

COMMENT ON COLUMN response_safety_log.issues IS 
  'Array of detected safety violations (e.g., ["Response mentions capabilities", "Technical term: supabase"])';

-- Row-level security (if needed)
-- ALTER TABLE message_delivery_log ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE response_safety_log ENABLE ROW LEVEL SECURITY;
