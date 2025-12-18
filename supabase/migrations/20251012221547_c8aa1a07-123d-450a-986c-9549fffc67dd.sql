-- Ensure the table exists before applying policies/RLS
CREATE TABLE IF NOT EXISTS public.client_health_scores (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  firstname TEXT,
  lastname TEXT,
  health_score NUMERIC(5,2) DEFAULT 0,
  health_zone TEXT DEFAULT 'YELLOW' CHECK (health_zone IN ('RED','YELLOW','GREEN','PURPLE')),
  assigned_coach TEXT,
  days_since_last_session INTEGER DEFAULT 0,
  churn_risk_score NUMERIC(5,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  calculated_on DATE GENERATED ALWAYS AS (DATE(calculated_at)) STORED,
  momentum_indicator TEXT DEFAULT 'STABLE',
  predictive_risk_score NUMERIC(5,2) DEFAULT 0,
  risk_category TEXT,
  rate_of_change_percent NUMERIC(5,2) DEFAULT 0,
  early_warning_flag BOOLEAN DEFAULT FALSE,
  risk_factors JSONB DEFAULT '[]'
);

-- Enable RLS on client_health_scores table
ALTER TABLE public.client_health_scores ENABLE ROW LEVEL SECURITY;

-- Create policy for read access
CREATE POLICY "Enable read access for all users"
ON public.client_health_scores
FOR SELECT
USING (true);

-- Fix the update_updated_at_column function to have proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;
