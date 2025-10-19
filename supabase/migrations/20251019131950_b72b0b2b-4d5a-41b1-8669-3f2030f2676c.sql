-- Create missing tables for PTD Intelligence Pack

-- Clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  phone text,
  first_name text,
  last_name text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow public access to clients" 
  ON public.clients 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Coach reviews table
CREATE TABLE IF NOT EXISTS public.coach_reviews (
  id bigserial PRIMARY KEY,
  coach text NOT NULL,
  period_month int NOT NULL,
  period_year int NOT NULL,
  summary jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE (coach, period_month, period_year)
);

-- Enable RLS
ALTER TABLE public.coach_reviews ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow public access to coach_reviews" 
  ON public.coach_reviews 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Add RPC functions for PTD operations

-- Calculate daily health scores
CREATE OR REPLACE FUNCTION public.calculate_daily_health_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Example: mark all clients as green with low risk
  INSERT INTO health_scores (client_id, risk_score, as_of, zone, details)
  SELECT c.id, 0.1, CURRENT_DATE, 'green', jsonb_build_object('source', 'auto')
  FROM clients c
  ON CONFLICT (client_id, as_of) DO UPDATE SET
    risk_score = EXCLUDED.risk_score,
    zone = EXCLUDED.zone,
    details = EXCLUDED.details;
END;
$$;

-- Monthly coach review
CREATE OR REPLACE FUNCTION public.monthly_coach_review(p_coach text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_clients', COUNT(*),
    'greens',  (SELECT COUNT(*) FROM health_scores WHERE zone='green' AND as_of=CURRENT_DATE),
    'yellows', (SELECT COUNT(*) FROM health_scores WHERE zone='yellow' AND as_of=CURRENT_DATE),
    'reds',    (SELECT COUNT(*) FROM health_scores WHERE zone='red' AND as_of=CURRENT_DATE)
  )
  INTO result
  FROM clients;
  RETURN result;
END;
$$;