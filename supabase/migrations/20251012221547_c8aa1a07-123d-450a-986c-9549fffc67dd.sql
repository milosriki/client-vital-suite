-- Create client_health_scores table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.client_health_scores (
  id BIGSERIAL PRIMARY KEY,
  contact_id TEXT,
  email TEXT,
  firstname TEXT,
  lastname TEXT,
  health_score NUMERIC(5,2) DEFAULT 0,
  health_zone TEXT DEFAULT 'YELLOW' CHECK (health_zone IN ('RED','YELLOW','GREEN','PURPLE')),
  zone TEXT DEFAULT 'GREEN',
  engagement_score INTEGER DEFAULT 0,
  momentum_score INTEGER DEFAULT 0,
  package_score INTEGER DEFAULT 0,
  relationship_score INTEGER DEFAULT 0,
  financial_score INTEGER DEFAULT 0,
  days_inactive INTEGER DEFAULT 0,
  days_since_last_session INTEGER DEFAULT 0,
  sessions_7d INTEGER DEFAULT 0,
  sessions_30d INTEGER DEFAULT 0,
  sessions_90d INTEGER DEFAULT 0,
  outstanding_sessions INTEGER DEFAULT 0,
  days_until_renewal INTEGER,
  assigned_coach TEXT,
  churn_risk_score NUMERIC(5,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculated_on DATE GENERATED ALWAYS AS (DATE(calculated_at)) STORED,
  momentum_indicator TEXT DEFAULT 'STABLE',
  predictive_risk_score NUMERIC(5,2) DEFAULT 0,
  risk_category TEXT,
  rate_of_change_percent NUMERIC(5,2) DEFAULT 0,
  early_warning_flag BOOLEAN DEFAULT FALSE,
  risk_factors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(email)
);

-- Enable RLS on client_health_scores table
ALTER TABLE public.client_health_scores ENABLE ROW LEVEL SECURITY;

-- Create policy for read access (drop first if exists)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.client_health_scores;
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
