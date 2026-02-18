-- Add columns that the CallTracking UI reads but don't exist
ALTER TABLE public.call_records ADD COLUMN IF NOT EXISTS call_score NUMERIC;
ALTER TABLE public.call_records ADD COLUMN IF NOT EXISTS lead_quality TEXT;
ALTER TABLE public.call_records ADD COLUMN IF NOT EXISTS appointment_set BOOLEAN DEFAULT FALSE;
ALTER TABLE public.call_records ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE public.call_records ADD COLUMN IF NOT EXISTS call_type TEXT;
ALTER TABLE public.call_records ADD COLUMN IF NOT EXISTS ptd_outcome TEXT;
ALTER TABLE public.call_records ADD COLUMN IF NOT EXISTS is_lost BOOLEAN DEFAULT FALSE;
ALTER TABLE public.call_records ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC;

-- Populate owner_name from staff table
UPDATE public.call_records cr
SET owner_name = s.name
FROM public.staff s
WHERE cr.hubspot_owner_id = s.hubspot_owner_id
AND cr.owner_name IS NULL
AND s.hubspot_owner_id IS NOT NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_call_records_is_lost ON public.call_records(is_lost);
CREATE INDEX IF NOT EXISTS idx_call_records_ptd_outcome ON public.call_records(ptd_outcome);
