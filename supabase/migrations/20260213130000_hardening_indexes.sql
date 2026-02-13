-- HARDENING INDEXES (Batch 6, Step 6.10)
-- Purpose: Add indexes to Foreign Keys that were found unindexed during audit.

-- 1. hubspot_deals (High join volume with contacts)
CREATE INDEX IF NOT EXISTS idx_hubspot_deals_contact_id ON public.hubspot_deals(associated_contact_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_deals_company_id ON public.hubspot_deals(associated_company_id);
CREATE INDEX IF NOT EXISTS idx_hubspot_deals_pipeline ON public.hubspot_deals(pipeline);

-- 2. business_calibration (Joins with prepared_actions)
CREATE INDEX IF NOT EXISTS idx_business_calibration_action_id ON public.business_calibration(action_id);

-- 3. contacts (Ensure core lookups are fast)
-- (Checking if email is indexed - usually yes via UNIQUE, but good to be sure if used in lower)
CREATE INDEX IF NOT EXISTS idx_contacts_email_lower ON public.contacts(lower(email));

-- 4. Audit Metadata (Ensure we can query logs fast)
CREATE INDEX IF NOT EXISTS idx_function_invocations_function_id ON public.edge_function_invocations(function_id);
