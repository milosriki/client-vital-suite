-- ============================================================================
-- Add missing columns to capi_events table
-- ============================================================================

ALTER TABLE public.capi_events 
ADD COLUMN IF NOT EXISTS event_time timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'AED',
ADD COLUMN IF NOT EXISTS user_email text,
ADD COLUMN IF NOT EXISTS user_phone text,
ADD COLUMN IF NOT EXISTS raw jsonb,
ADD COLUMN IF NOT EXISTS inserted_at timestamptz DEFAULT now();

-- Add indexes for capi_events
CREATE INDEX IF NOT EXISTS idx_capi_event_id 
  ON public.capi_events(event_id);

CREATE INDEX IF NOT EXISTS idx_capi_event_name_time 
  ON public.capi_events(event_name, event_time);

-- ============================================================================
-- TABLE: health_scores
-- ============================================================================
-- Purpose: Tracks client health metrics over time with risk assessment
--          and trend indicators
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.health_scores (
  id bigserial PRIMARY KEY,
  client_id text NOT NULL,
  as_of date NOT NULL,
  health_score numeric NOT NULL,
  risk_score numeric,
  zone text CHECK (zone IN ('green','yellow','red','purple')),
  improving boolean,
  details jsonb,
  inserted_at timestamptz DEFAULT now(),
  UNIQUE (client_id, as_of)
);

-- Enable RLS
ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;

-- Create policy for health_scores
CREATE POLICY "Allow public access to health_scores" 
  ON public.health_scores 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_health_scores_client 
  ON public.health_scores(client_id);

CREATE INDEX IF NOT EXISTS idx_health_scores_asof 
  ON public.health_scores(as_of);

-- ============================================================================
-- FUNCTION: upsert_capi_event
-- ============================================================================
-- Purpose: Safely upserts a CAPI event from JSON input
-- ============================================================================

CREATE OR REPLACE FUNCTION public.upsert_capi_event(p_event jsonb)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.capi_events(
    event_id, 
    event_name, 
    event_time, 
    currency, 
    value_aed, 
    external_id, 
    fbp, 
    fbc, 
    user_email, 
    user_phone, 
    raw,
    email,
    phone
  )
  VALUES (
    (p_event->>'event_id'),
    (p_event->>'event_name'),
    COALESCE((p_event->>'event_time')::timestamptz, now()),
    COALESCE(p_event->>'currency', 'AED'),
    NULLIF(p_event->>'value','')::numeric,
    p_event->>'external_id',
    p_event->>'fbp',
    p_event->>'fbc',
    p_event->'user_data'->>'email',
    p_event->'user_data'->>'phone',
    p_event,
    COALESCE(p_event->'user_data'->>'email', p_event->>'email'),
    COALESCE(p_event->'user_data'->>'phone', p_event->>'phone')
  )
  ON CONFLICT (event_id) DO UPDATE SET
    event_time = EXCLUDED.event_time,
    user_email = EXCLUDED.user_email,
    user_phone = EXCLUDED.user_phone,
    raw = EXCLUDED.raw;
END;
$$;