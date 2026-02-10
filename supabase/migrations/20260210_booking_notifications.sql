-- ============================================================
-- BOOKING NOTIFICATIONS TABLE
-- Purpose: Alerts team (Milos) when a lead reaches close/post_close.
-- Prevents leads from being ghosted after Lisa books them.
-- ============================================================

CREATE TABLE IF NOT EXISTS booking_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  lead_name TEXT,
  lead_goal TEXT,
  lead_area TEXT,
  phase TEXT NOT NULL DEFAULT 'close',
  lisa_last_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | actioned | expired
  created_at TIMESTAMPTZ DEFAULT NOW(),
  actioned_at TIMESTAMPTZ,
  actioned_by TEXT
);

-- Index for quick lookups of pending notifications
CREATE INDEX IF NOT EXISTS idx_booking_notifications_status
  ON booking_notifications(status) WHERE status = 'pending';

-- RLS: Only service role can insert (from edge function), authenticated users can read
ALTER TABLE booking_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage booking_notifications"
  ON booking_notifications FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can view booking_notifications"
  ON booking_notifications FOR SELECT
  USING (auth.role() = 'authenticated');
