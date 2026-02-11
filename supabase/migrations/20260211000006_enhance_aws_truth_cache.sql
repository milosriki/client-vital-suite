-- Migration to enhance aws_truth_cache with PowerBI financial DNA
-- DATE: 2026-02-11

ALTER TABLE public.aws_truth_cache 
ADD COLUMN IF NOT EXISTS total_sessions_attended int DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_sessions_cancelled int DEFAULT 0,
ADD COLUMN IF NOT EXISTS lifetime_revenue numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS leak_score numeric DEFAULT 0;

-- Comment on columns
COMMENT ON COLUMN public.aws_truth_cache.lifetime_revenue IS 'Total revenue from PowerBI replica (financial DNA).';
COMMENT ON COLUMN public.aws_truth_cache.leak_score IS 'Calculated difference between attributed and actual revenue.';
