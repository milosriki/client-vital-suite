-- Migration: Add missing columns to daily_marketing_briefs
-- These columns are expected by useDeepIntelligence hook but were missing from the original table

-- Create table if it doesn't exist (original migration may not have run)
CREATE TABLE IF NOT EXISTS public.daily_marketing_briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brief_date DATE NOT NULL UNIQUE,
  yesterday_spend NUMERIC(10,2),
  yesterday_leads INTEGER,
  yesterday_cpl NUMERIC(10,2),
  yesterday_assessments INTEGER,
  yesterday_true_cpa NUMERIC(10,2),
  rolling_7d_spend NUMERIC(12,2),
  rolling_7d_revenue NUMERIC(12,2),
  rolling_7d_roas NUMERIC(6,3),
  rolling_7d_avg_health NUMERIC(5,2),
  rolling_7d_ghost_rate NUMERIC(5,2),
  actions_required JSONB DEFAULT '[]'::jsonb,
  budget_proposals JSONB DEFAULT '[]'::jsonb,
  fatigue_alerts JSONB DEFAULT '[]'::jsonb,
  projection_30d JSONB DEFAULT '{}'::jsonb,
  new_copy_pending INTEGER DEFAULT 0,
  historical_context JSONB DEFAULT '{}'::jsonb,
  funnel_health JSONB DEFAULT NULL,
  loss_analysis JSONB DEFAULT '{}'::jsonb,
  source_alignment JSONB DEFAULT '{}'::jsonb,
  projections JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns in case table already exists but is missing them
ALTER TABLE public.daily_marketing_briefs
  ADD COLUMN IF NOT EXISTS historical_context JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS funnel_health JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS loss_analysis JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_alignment JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS projections JSONB DEFAULT '{}'::jsonb;

-- RLS
ALTER TABLE public.daily_marketing_briefs ENABLE ROW LEVEL SECURITY;

-- Also create a view that auto-computes a daily brief from existing data
-- This can be used to populate the table via a cron edge function
CREATE OR REPLACE VIEW public.view_daily_marketing_brief AS
WITH yesterday AS (
  SELECT * FROM public.daily_business_metrics
  WHERE date = (CURRENT_DATE - INTERVAL '1 day')::date
  LIMIT 1
),
rolling_7d AS (
  SELECT
    COALESCE(SUM(ad_spend_facebook), 0) AS spend,
    COALESCE(SUM(total_revenue_booked), 0) AS revenue,
    CASE WHEN SUM(ad_spend_facebook) > 0
      THEN SUM(total_revenue_booked) / NULLIF(SUM(ad_spend_facebook), 0)
      ELSE 0
    END AS roas,
    CASE WHEN SUM(total_appointments_set) > 0
      THEN 1.0 - (SUM(total_appointments_held)::numeric / NULLIF(SUM(total_appointments_set), 0))
      ELSE 0
    END AS ghost_rate
  FROM public.daily_business_metrics
  WHERE date >= (CURRENT_DATE - INTERVAL '7 days')::date
),
latest_funnel AS (
  SELECT * FROM public.funnel_metrics
  WHERE dimension_type = 'overall'
  ORDER BY metric_date DESC
  LIMIT 1
)
SELECT
  CURRENT_DATE AS brief_date,
  y.ad_spend_facebook AS yesterday_spend,
  y.total_leads_new AS yesterday_leads,
  y.cost_per_lead AS yesterday_cpl,
  y.total_appointments_held AS yesterday_assessments,
  CASE WHEN y.total_appointments_held > 0
    THEN y.ad_spend_facebook / NULLIF(y.total_appointments_held, 0)
    ELSE 0
  END AS yesterday_true_cpa,
  r.spend AS rolling_7d_spend,
  r.revenue AS rolling_7d_revenue,
  r.roas AS rolling_7d_roas,
  r.ghost_rate AS rolling_7d_ghost_rate,
  jsonb_build_object(
    'marketing_health', f.marketing_health,
    'sales_health', f.sales_health,
    'coach_health', f.coach_health,
    'ops_health', f.ops_health,
    'lead_to_booked_pct', f.lead_to_booked_pct,
    'booked_to_held_pct', f.booked_to_held_pct,
    'overall_lead_to_customer_pct', f.overall_lead_to_customer_pct
  ) AS funnel_health
FROM yesterday y
CROSS JOIN rolling_7d r
LEFT JOIN latest_funnel f ON true;

COMMENT ON VIEW public.view_daily_marketing_brief IS 'Auto-computed daily marketing brief from daily_business_metrics + funnel_metrics';

-- RLS policies
DO $$ BEGIN
  CREATE POLICY "Authenticated users can read daily briefs"
    ON public.daily_marketing_briefs FOR SELECT
    TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
