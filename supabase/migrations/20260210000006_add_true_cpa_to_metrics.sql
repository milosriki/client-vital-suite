-- Add True CPA and Assessment counts to daily metrics
ALTER TABLE public.daily_business_metrics 
ADD COLUMN IF NOT EXISTS total_assessments_completed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS true_cpa DECIMAL(12,2) DEFAULT 0;

COMMENT ON COLUMN public.daily_business_metrics.total_assessments_completed IS 'Count of "Completed" or "Attended" sessions from AWS vw_schedulers.';
COMMENT ON COLUMN public.daily_business_metrics.true_cpa IS 'Ad Spend / Completed Assessments.';
