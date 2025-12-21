-- Fix status constraint for prepared_actions to allow 'pending' and 'awaiting_approval'
ALTER TABLE public.prepared_actions 
DROP CONSTRAINT prepared_actions_status_check;

ALTER TABLE public.prepared_actions 
ADD CONSTRAINT prepared_actions_status_check 
CHECK (status IN ('prepared', 'pending', 'awaiting_approval', 'executing', 'executed', 'failed', 'rejected'));

-- Add approved_by column if missing
ALTER TABLE public.prepared_actions 
ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- Add approved_at column if missing
ALTER TABLE public.prepared_actions 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
