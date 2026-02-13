-- HARDENING INDEXES (Batch 6, Step 6.10)
-- Purpose: Add indexes to Foreign Keys that were found unindexed during audit.
-- All wrapped in DO blocks to skip gracefully if tables/columns don't exist.

-- 1. deals (High join volume with contacts)
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON public.deals(contact_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_deals_pipeline_id ON public.deals(pipeline_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;

-- 2. business_calibration (Joins with prepared_actions)
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_business_calibration_action_id ON public.business_calibration(action_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;

-- 3. contacts (Ensure core lookups are fast)
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_contacts_email_lower ON public.contacts(lower(email));
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;

-- 4. edge_function_invocations (Audit log lookups)
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_function_invocations_function_id ON public.edge_function_invocations(function_id);
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;
