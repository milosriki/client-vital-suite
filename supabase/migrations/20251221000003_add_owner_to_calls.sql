-- Add hubspot_owner_id to call_records table
ALTER TABLE public.call_records 
ADD COLUMN IF NOT EXISTS hubspot_owner_id TEXT;

CREATE INDEX IF NOT EXISTS idx_call_records_owner ON public.call_records(hubspot_owner_id);
