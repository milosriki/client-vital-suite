-- New tables for PowerBI-enriched data from AWS sync bridge
-- Supports: client reviews, demographics, and session pricing

-- 1. Client Reviews (from vw_powerbi_schedulers)
CREATE TABLE IF NOT EXISTS public.client_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL,
  coach_id TEXT,
  coach_name TEXT,
  client_name TEXT,
  review_date TIMESTAMPTZ,
  rating NUMERIC(3,1),
  session_id TEXT UNIQUE,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_reviews_client ON public.client_reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_client_reviews_coach ON public.client_reviews(coach_name);
CREATE INDEX IF NOT EXISTS idx_client_reviews_rating ON public.client_reviews(rating);

-- 2. Client Demographics (from vw_powerbi_clients)
CREATE TABLE IF NOT EXISTS public.client_demographics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  country TEXT,
  birthdate DATE,
  gender TEXT,
  nationality TEXT,
  height NUMERIC(5,1),
  weight NUMERIC(5,1),
  injury TEXT,
  goals TEXT,
  marketing_campaign TEXT,
  membership_type TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_demographics_email ON public.client_demographics(email);
CREATE INDEX IF NOT EXISTS idx_client_demographics_city ON public.client_demographics(city);

-- 3. Add PowerBI columns to training_sessions_live (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_sessions_live' AND column_name = 'base_value') THEN
    ALTER TABLE public.training_sessions_live ADD COLUMN base_value NUMERIC(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_sessions_live' AND column_name = 'review_rating') THEN
    ALTER TABLE public.training_sessions_live ADD COLUMN review_rating NUMERIC(3,1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_sessions_live' AND column_name = 'origin') THEN
    ALTER TABLE public.training_sessions_live ADD COLUMN origin TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_sessions_live' AND column_name = 'workout_type') THEN
    ALTER TABLE public.training_sessions_live ADD COLUMN workout_type TEXT;
  END IF;
END $$;

-- 4. Add PowerBI columns to client_packages_live (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_packages_live' AND column_name = 'base_value') THEN
    ALTER TABLE public.client_packages_live ADD COLUMN base_value NUMERIC(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_packages_live' AND column_name = 'package_status') THEN
    ALTER TABLE public.client_packages_live ADD COLUMN package_status TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_packages_live' AND column_name = 'payment_provider') THEN
    ALTER TABLE public.client_packages_live ADD COLUMN payment_provider TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_packages_live' AND column_name = 'purchase_origin') THEN
    ALTER TABLE public.client_packages_live ADD COLUMN purchase_origin TEXT;
  END IF;
END $$;

-- RLS policies
ALTER TABLE public.client_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_demographics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on client_reviews" ON public.client_reviews FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated read client_reviews" ON public.client_reviews FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role full access on client_demographics" ON public.client_demographics FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated read client_demographics" ON public.client_demographics FOR SELECT TO authenticated USING (true);
