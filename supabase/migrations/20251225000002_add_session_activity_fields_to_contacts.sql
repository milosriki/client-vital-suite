-- Add session activity fields to contacts table for health score calculation
-- These fields are synced from HubSpot and used by the health-calculator function

-- Session activity counts
DO $$ BEGIN
    ALTER TABLE public.contacts ADD COLUMN sessions_last_7d INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.contacts ADD COLUMN sessions_last_30d INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.contacts ADD COLUMN sessions_last_90d INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Last paid session date for inactivity calculation
DO $$ BEGIN
    ALTER TABLE public.contacts ADD COLUMN last_paid_session_date TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Booking status for commitment bonus
DO $$ BEGIN
    ALTER TABLE public.contacts ADD COLUMN next_session_is_booked BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE public.contacts ADD COLUMN future_booked_sessions INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Package cost for revenue analysis
DO $$ BEGIN
    ALTER TABLE public.contacts ADD COLUMN last_package_cost DECIMAL(12,2) DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Days since last session (computed field for convenience)
DO $$ BEGIN
    ALTER TABLE public.contacts ADD COLUMN days_since_last_session INTEGER DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add indexes for health score queries
CREATE INDEX IF NOT EXISTS idx_contacts_sessions_last_7d ON public.contacts(sessions_last_7d);
CREATE INDEX IF NOT EXISTS idx_contacts_sessions_last_30d ON public.contacts(sessions_last_30d);
CREATE INDEX IF NOT EXISTS idx_contacts_last_paid_session ON public.contacts(last_paid_session_date);

COMMENT ON COLUMN public.contacts.sessions_last_7d IS 'Number of sessions conducted in last 7 days (from HubSpot)';
COMMENT ON COLUMN public.contacts.sessions_last_30d IS 'Number of sessions conducted in last 30 days (from HubSpot)';
COMMENT ON COLUMN public.contacts.sessions_last_90d IS 'Number of sessions conducted in last 90 days (from HubSpot)';
COMMENT ON COLUMN public.contacts.last_paid_session_date IS 'Date of last paid session (from HubSpot)';
COMMENT ON COLUMN public.contacts.next_session_is_booked IS 'Whether next session is booked (from HubSpot)';
COMMENT ON COLUMN public.contacts.future_booked_sessions IS 'Number of future booked sessions (from HubSpot)';
COMMENT ON COLUMN public.contacts.last_package_cost IS 'Cost of last package purchased (from HubSpot)';
COMMENT ON COLUMN public.contacts.days_since_last_session IS 'Days since last session (computed)';
