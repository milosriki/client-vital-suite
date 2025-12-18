-- Create client_health_scores table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.client_health_scores (
  id BIGSERIAL PRIMARY KEY,
  contact_id TEXT NOT NULL,
  email TEXT,
  firstname TEXT,
  lastname TEXT,
  health_score INTEGER DEFAULT 0,
  zone TEXT DEFAULT 'GREEN',
  engagement_score INTEGER DEFAULT 0,
  momentum_score INTEGER DEFAULT 0,
  package_score INTEGER DEFAULT 0,
  relationship_score INTEGER DEFAULT 0,
  financial_score INTEGER DEFAULT 0,
  days_inactive INTEGER DEFAULT 0,
  sessions_7d INTEGER DEFAULT 0,
  sessions_30d INTEGER DEFAULT 0,
  sessions_90d INTEGER DEFAULT 0,
  outstanding_sessions INTEGER DEFAULT 0,
  days_until_renewal INTEGER,
  assigned_coach TEXT,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id)
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