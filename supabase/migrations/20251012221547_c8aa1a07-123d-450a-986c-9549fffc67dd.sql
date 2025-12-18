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

-- Add missing columns if table already exists (for existing databases)
DO $$
BEGIN
  -- Add calculated_at if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_health_scores' AND column_name = 'calculated_at') THEN
    ALTER TABLE public.client_health_scores ADD COLUMN calculated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  
  -- Add health_zone if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_health_scores' AND column_name = 'health_zone') THEN
    ALTER TABLE public.client_health_scores ADD COLUMN health_zone TEXT DEFAULT 'YELLOW';
  END IF;
  
  -- Add churn_risk_score if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_health_scores' AND column_name = 'churn_risk_score') THEN
    ALTER TABLE public.client_health_scores ADD COLUMN churn_risk_score NUMERIC(5,2) DEFAULT 0;
  END IF;
  
  -- Add days_since_last_session if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_health_scores' AND column_name = 'days_since_last_session') THEN
    ALTER TABLE public.client_health_scores ADD COLUMN days_since_last_session INTEGER DEFAULT 0;
  END IF;
  
  -- Add momentum_indicator if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_health_scores' AND column_name = 'momentum_indicator') THEN
    ALTER TABLE public.client_health_scores ADD COLUMN momentum_indicator TEXT DEFAULT 'STABLE';
  END IF;
  
  -- Add predictive_risk_score if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_health_scores' AND column_name = 'predictive_risk_score') THEN
    ALTER TABLE public.client_health_scores ADD COLUMN predictive_risk_score NUMERIC(5,2) DEFAULT 0;
  END IF;
  
  -- Add risk_category if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_health_scores' AND column_name = 'risk_category') THEN
    ALTER TABLE public.client_health_scores ADD COLUMN risk_category TEXT;
  END IF;
  
  -- Add rate_of_change_percent if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_health_scores' AND column_name = 'rate_of_change_percent') THEN
    ALTER TABLE public.client_health_scores ADD COLUMN rate_of_change_percent NUMERIC(5,2) DEFAULT 0;
  END IF;
  
  -- Add early_warning_flag if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_health_scores' AND column_name = 'early_warning_flag') THEN
    ALTER TABLE public.client_health_scores ADD COLUMN early_warning_flag BOOLEAN DEFAULT FALSE;
  END IF;
  
  -- Add risk_factors if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_health_scores' AND column_name = 'risk_factors') THEN
    ALTER TABLE public.client_health_scores ADD COLUMN risk_factors JSONB DEFAULT '[]';
  END IF;
END $$;

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
