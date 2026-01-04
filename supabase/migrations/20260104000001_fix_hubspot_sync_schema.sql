-- Fix missing columns for HubSpot sync functions
-- This migration ensures that the contacts and leads tables have all columns expected by the sync-hubspot-to-supabase function

-- 1. FIX CONTACTS TABLE
DO $$ 
BEGIN
    -- Rename hubspot_id to hubspot_contact_id if it exists and hubspot_contact_id doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'hubspot_id') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'hubspot_contact_id') THEN
        ALTER TABLE public.contacts RENAME COLUMN hubspot_id TO hubspot_contact_id;
    END IF;

    -- Ensure hubspot_contact_id exists and is unique
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'hubspot_contact_id') THEN
        ALTER TABLE public.contacts ADD COLUMN hubspot_contact_id TEXT UNIQUE;
    END IF;

    -- Add missing owner and status columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'owner_id') THEN
        ALTER TABLE public.contacts ADD COLUMN owner_id TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'owner_name') THEN
        ALTER TABLE public.contacts ADD COLUMN owner_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'status') THEN
        ALTER TABLE public.contacts ADD COLUMN status TEXT;
    END IF;

    -- Add missing location columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'location') THEN
        ALTER TABLE public.contacts ADD COLUMN location TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'neighborhood') THEN
        ALTER TABLE public.contacts ADD COLUMN neighborhood TEXT;
    END IF;

    -- Add missing traffic/attribution columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'latest_traffic_source') THEN
        ALTER TABLE public.contacts ADD COLUMN latest_traffic_source TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'latest_traffic_source_2') THEN
        ALTER TABLE public.contacts ADD COLUMN latest_traffic_source_2 TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'first_touch_source') THEN
        ALTER TABLE public.contacts ADD COLUMN first_touch_source TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'last_touch_source') THEN
        ALTER TABLE public.contacts ADD COLUMN last_touch_source TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'first_page_seen') THEN
        ALTER TABLE public.contacts ADD COLUMN first_page_seen TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'last_page_seen') THEN
        ALTER TABLE public.contacts ADD COLUMN last_page_seen TEXT;
    END IF;

    -- Add missing activity columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'call_attempt_count') THEN
        ALTER TABLE public.contacts ADD COLUMN call_attempt_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'custom_lifecycle_stage') THEN
        ALTER TABLE public.contacts ADD COLUMN custom_lifecycle_stage TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'first_conversion_date') THEN
        ALTER TABLE public.contacts ADD COLUMN first_conversion_date TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'num_form_submissions') THEN
        ALTER TABLE public.contacts ADD COLUMN num_form_submissions INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'num_unique_forms_submitted') THEN
        ALTER TABLE public.contacts ADD COLUMN num_unique_forms_submitted INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'recent_conversion') THEN
        ALTER TABLE public.contacts ADD COLUMN recent_conversion TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'recent_conversion_date') THEN
        ALTER TABLE public.contacts ADD COLUMN recent_conversion_date TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'sla_first_touch') THEN
        ALTER TABLE public.contacts ADD COLUMN sla_first_touch TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'time_of_entry') THEN
        ALTER TABLE public.contacts ADD COLUMN time_of_entry TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'contact_unworked') THEN
        ALTER TABLE public.contacts ADD COLUMN contact_unworked BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'last_activity_date') THEN
        ALTER TABLE public.contacts ADD COLUMN last_activity_date TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'email_domain') THEN
        ALTER TABLE public.contacts ADD COLUMN email_domain TEXT;
    END IF;

    -- Add missing UTM columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'utm_source') THEN
        ALTER TABLE public.contacts ADD COLUMN utm_source TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'utm_medium') THEN
        ALTER TABLE public.contacts ADD COLUMN utm_medium TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'utm_campaign') THEN
        ALTER TABLE public.contacts ADD COLUMN utm_campaign TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'utm_content') THEN
        ALTER TABLE public.contacts ADD COLUMN utm_content TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'utm_term') THEN
        ALTER TABLE public.contacts ADD COLUMN utm_term TEXT;
    END IF;

    -- Ensure session activity columns exist (just in case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'sessions_last_7d') THEN
        ALTER TABLE public.contacts ADD COLUMN sessions_last_7d INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'sessions_last_30d') THEN
        ALTER TABLE public.contacts ADD COLUMN sessions_last_30d INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'sessions_last_90d') THEN
        ALTER TABLE public.contacts ADD COLUMN sessions_last_90d INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'future_booked_sessions') THEN
        ALTER TABLE public.contacts ADD COLUMN future_booked_sessions INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'last_paid_session_date') THEN
        ALTER TABLE public.contacts ADD COLUMN last_paid_session_date TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'next_session_is_booked') THEN
        ALTER TABLE public.contacts ADD COLUMN next_session_is_booked BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'last_package_cost') THEN
        ALTER TABLE public.contacts ADD COLUMN last_package_cost DECIMAL(12,2) DEFAULT 0;
    END IF;

END $$;

-- 2. FIX LEADS TABLE
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'owner_id') THEN
        ALTER TABLE public.leads ADD COLUMN owner_id TEXT;
    END IF;
    
    -- Ensure hubspot_id has a unique constraint for upsert
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'leads_hubspot_id_key'
    ) THEN
        ALTER TABLE public.leads ADD CONSTRAINT leads_hubspot_id_key UNIQUE (hubspot_id);
    END IF;

    -- Make name nullable if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'name') THEN
        ALTER TABLE public.leads ALTER COLUMN name DROP NOT NULL;
    END IF;
END $$;

-- 3. FIX DEALS TABLE
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'value_aed') THEN
        ALTER TABLE public.deals ADD COLUMN value_aed DECIMAL(12,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'deal_value') THEN
        ALTER TABLE public.deals ADD COLUMN deal_value DECIMAL(12,2) DEFAULT 0;
    END IF;
END $$;

-- Ensure indexes exist for the new columns
CREATE INDEX IF NOT EXISTS idx_contacts_hubspot_contact_id ON public.contacts(hubspot_contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_owner_id ON public.contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_owner_id ON public.leads(owner_id);
