-- Add fields to your existing daily_summary table to store the AI analysis
ALTER TABLE public.daily_summary 
ADD COLUMN IF NOT EXISTS executive_briefing TEXT, -- The main "Morning Coffee" report
ADD COLUMN IF NOT EXISTS system_health_status TEXT, -- "All Systems Go" or "Error in HubSpot Sync"
ADD COLUMN IF NOT EXISTS max_utilization_rate NUMERIC, -- Your "Max Utilisation" metric
ADD COLUMN IF NOT EXISTS action_plan JSONB; -- Top 3 things you MUST do today

-- Add AI suggested reply to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS ai_suggested_reply TEXT;
