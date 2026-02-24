-- =====================================================
-- PHASE 6: Contact Consolidation Migration
-- Merges leads, sales_leads, clients → contacts
-- Old tables renamed to _deprecated_*, views created
-- for backward-compatible reads
-- =====================================================

-- Step 1: Add missing columns from leads table to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_suggested_reply TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_reply_generated_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS raw_status TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS call_status TEXT;

-- Step 2: Backfill from leads → contacts (only rows not already in contacts)
INSERT INTO contacts (
  email, phone, first_name, last_name, company, source, status,
  lead_score, hubspot_contact_id, hubspot_owner_id, lifecycle_stage,
  ai_suggested_reply, ai_reply_generated_at, notes, tags, metadata,
  created_at, updated_at
)
SELECT
  l.email, l.phone, l.first_name, l.last_name, l.company, l.source, l.status,
  l.lead_score, l.hubspot_id, l.hubspot_owner_id,
  COALESCE(l.lifecycle_stage, 'lead'),
  l.ai_suggested_reply, l.ai_reply_generated_at, l.notes, l.tags, l.metadata,
  l.created_at, l.updated_at
FROM leads l
WHERE l.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.email = l.email)
  AND NOT EXISTS (SELECT 1 FROM contacts c WHERE l.hubspot_id IS NOT NULL AND c.hubspot_contact_id = l.hubspot_id)
ON CONFLICT (email) DO NOTHING;

-- Step 3: Enrich existing contacts with leads-only data
UPDATE contacts c SET
  ai_suggested_reply = COALESCE(c.ai_suggested_reply, l.ai_suggested_reply),
  ai_reply_generated_at = COALESCE(c.ai_reply_generated_at, l.ai_reply_generated_at),
  notes = COALESCE(c.notes, l.notes),
  tags = COALESCE(c.tags, l.tags),
  lead_score = COALESCE(NULLIF(c.lead_score, 0), l.lead_score)
FROM leads l
WHERE l.email IS NOT NULL AND l.email = c.email;

-- Step 4: Backfill from sales_leads → contacts
UPDATE contacts c SET
  raw_status = COALESCE(c.raw_status, sl.raw_status),
  call_status = COALESCE(c.call_status, sl.call_status)
FROM sales_leads sl
WHERE sl.hubspot_id IS NOT NULL AND sl.hubspot_id = c.hubspot_contact_id;

-- Insert sales_leads not in contacts
INSERT INTO contacts (
  email, phone, first_name, last_name, company,
  hubspot_contact_id, hubspot_owner_id, lifecycle_stage,
  status, raw_status, call_status, created_at, updated_at
)
SELECT
  sl.email, sl.phone, sl.first_name, sl.last_name, sl.company,
  sl.hubspot_id, sl.hubspot_owner_id, sl.lifecycle_stage,
  sl.status, sl.raw_status, sl.call_status, sl.created_at, sl.updated_at
FROM sales_leads sl
WHERE sl.hubspot_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.hubspot_contact_id = sl.hubspot_id)
  AND (sl.email IS NULL OR NOT EXISTS (SELECT 1 FROM contacts c WHERE c.email = sl.email))
ON CONFLICT (hubspot_contact_id) DO NOTHING;

-- Step 5: Backfill from clients → contacts
INSERT INTO contacts (email, phone, first_name, last_name, created_at)
SELECT cl.email, cl.phone, cl.first_name, cl.last_name, cl.created_at
FROM clients cl
WHERE cl.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.email = cl.email)
ON CONFLICT (email) DO NOTHING;

-- Step 6: Rename old tables (preserved for rollback)
ALTER TABLE leads RENAME TO _deprecated_leads;
ALTER TABLE sales_leads RENAME TO _deprecated_sales_leads;
ALTER TABLE clients RENAME TO _deprecated_clients;

-- Step 7: Create backward-compatible views for reads
-- leads view: maps contacts columns back to leads schema
CREATE OR REPLACE VIEW leads AS
SELECT
  c.id,
  c.email,
  c.phone,
  c.first_name,
  c.last_name,
  COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '') AS full_name,
  c.company,
  c.source,
  c.status,
  c.lead_score,
  c.hubspot_contact_id AS hubspot_id,
  c.hubspot_owner_id,
  c.lifecycle_stage,
  c.last_contacted_at AS last_contacted_at,
  c.ai_suggested_reply,
  c.ai_reply_generated_at,
  c.notes,
  c.tags,
  c.metadata,
  c.created_at,
  c.updated_at
FROM contacts c
WHERE c.lifecycle_stage IS NULL
   OR c.lifecycle_stage IN ('lead', 'subscriber', 'marketingqualifiedlead', 'salesqualifiedlead', 'other');

-- sales_leads view: maps contacts to sales_leads schema
CREATE OR REPLACE VIEW sales_leads AS
SELECT
  c.id,
  c.hubspot_contact_id AS hubspot_id,
  c.email,
  c.first_name,
  c.last_name,
  c.phone,
  c.company,
  c.status,
  c.raw_status,
  c.call_status,
  c.hubspot_owner_id,
  c.lifecycle_stage,
  c.last_contacted_at AS last_contacted,
  c.created_at,
  c.updated_at
FROM contacts c;

-- clients view: maps contacts to clients schema
CREATE OR REPLACE VIEW clients AS
SELECT
  c.id,
  c.email,
  c.phone,
  c.first_name,
  c.last_name,
  c.created_at
FROM contacts c
WHERE c.lifecycle_stage = 'customer';

-- Step 8: Recreate the sales pipeline views on new sales_leads view
-- (They were originally built on the sales_leads table)
CREATE OR REPLACE VIEW vw_sales_contacts AS
SELECT
  c.id,
  c.hubspot_contact_id AS hubspot_id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.company,
  c.status,
  c.last_contacted_at AS last_contacted,
  c.hubspot_owner_id
FROM contacts c
WHERE c.lifecycle_stage != 'customer'
  AND (c.status IS NULL OR c.status != 'DISQUALIFIED');

CREATE OR REPLACE VIEW vw_active_clients AS
SELECT
  c.id,
  c.hubspot_contact_id AS hubspot_id,
  c.first_name,
  c.last_name,
  c.company,
  c.email,
  c.phone,
  c.updated_at AS last_sync
FROM contacts c
WHERE c.lifecycle_stage = 'customer';

-- Step 9: Transfer RLS policies
-- Views inherit RLS from underlying table (contacts already has RLS)
-- No additional policies needed

-- Step 10: Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_contacts_ai_reply ON contacts (ai_reply_generated_at) WHERE ai_suggested_reply IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_raw_status ON contacts (raw_status) WHERE raw_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_call_status ON contacts (call_status) WHERE call_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN (tags) WHERE tags IS NOT NULL;
