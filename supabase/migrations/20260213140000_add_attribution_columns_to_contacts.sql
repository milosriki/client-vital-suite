-- Task 4.1: Add Facebook ad attribution columns to contacts table
-- These columns are populated by sync-hubspot-to-supabase from attribution_events
-- via email match (latest event within 7-day window of contact creation)

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attributed_ad_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attributed_campaign_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attributed_adset_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attribution_source TEXT;

-- Index for quick lookups by attribution
CREATE INDEX IF NOT EXISTS idx_contacts_attributed_ad_id
  ON contacts (attributed_ad_id) WHERE attributed_ad_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_attributed_campaign_id
  ON contacts (attributed_campaign_id) WHERE attributed_campaign_id IS NOT NULL;
