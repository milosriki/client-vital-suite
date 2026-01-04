-- 1. Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the Smart Data Retention Policy
-- PROTECTS: Customers, Subscribers, Leads with DEALS, and Scheduled Assessments.
-- CLEANS: Cold leads with zero financial activity or sales interest.
SELECT cron.schedule('lead-cleanup-daily', '0 0 * * *', $$
  DELETE FROM public.contacts 
  WHERE created_at < NOW() - INTERVAL '90 days' -- Increased to 90 days for pipeline breathing room
  AND lifecycle_stage NOT IN ('customer', 'subscriber', 'opportunity', 'salesqualifiedlead')
  AND lead_status NOT IN ('appointment_scheduled', 'appointment_set')
  AND (total_value IS NULL OR total_value = 0);
$$);

-- 3. Create a specialized table for the Excel Daily Report Pushes
CREATE TABLE IF NOT EXISTS public.management_daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL,
    reported_revenue DECIMAL(12, 2),
    reported_leads INTEGER,
    manager_notes TEXT,
    raw_data JSONB,
    verified_at TIMESTAMPTZ,
    discrepancy_found BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
