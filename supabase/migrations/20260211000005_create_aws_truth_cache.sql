-- Create the AWS Truth Cache Table
-- This table stores ground-truth data ported from AWS RDS (Office)
-- to be consumed by Supabase Edge Functions and the Frontend.

CREATE TABLE IF NOT EXISTS public.aws_truth_cache (
    id uuid primary key default gen_random_uuid(),
    email text unique NOT NULL,
    full_name text,
    outstanding_sessions int DEFAULT 0,
    last_session_date timestamptz,
    coach_name text,
    package_name text,
    updated_at timestamptz default now()
);

-- Enable RLS
ALTER TABLE public.aws_truth_cache ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view the cache
CREATE POLICY "Users can view AWS truth cache" 
ON public.aws_truth_cache FOR SELECT 
TO authenticated 
USING (true);

-- Allow service role to manage everything
CREATE POLICY "Service role can manage AWS truth cache" 
ON public.aws_truth_cache FOR ALL 
TO service_role 
USING (true)
WITH CHECK (true);

-- Index for fast lookup by email
CREATE INDEX IF NOT EXISTS idx_aws_truth_cache_email ON public.aws_truth_cache(email);

-- Add comment for documentation
COMMENT ON TABLE public.aws_truth_cache IS 'Mirror of AWS RDS ground truth for high-performance dashboard access.';
