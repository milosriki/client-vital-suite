ALTER TABLE public.call_records ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
