-- Ultimate Truth Events Table
-- Stores aligned events from Facebook CAPI, HubSpot, and AnyTrack

CREATE TABLE IF NOT EXISTS public.ultimate_truth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Unique identifier across all sources
  ultimate_event_id TEXT UNIQUE NOT NULL,
  
  -- Standardized event name
  event_name TEXT NOT NULL, -- Purchase, Lead, InitiateCheckout, CompleteRegistration, etc.
  event_time TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- PII (from HubSpot - most complete)
  email TEXT NOT NULL,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  
  -- Attribution (from AnyTrack - best attribution)
  attribution_source TEXT, -- google, facebook, direct, etc.
  attribution_medium TEXT, -- cpc, organic, referral, etc.
  attribution_campaign TEXT,
  fb_campaign_id TEXT,
  fb_ad_id TEXT,
  fb_adset_id TEXT,
  
  -- Conversion (from HubSpot - source of truth)
  conversion_value NUMERIC(12,2),
  conversion_currency TEXT DEFAULT 'AED',
  hubspot_deal_id TEXT, -- HubSpot deal ID (source of truth)
  deal_closed_at TIMESTAMP WITH TIME ZONE,
  
  -- Source tracking
  has_facebook_capi BOOLEAN DEFAULT false,
  has_hubspot BOOLEAN DEFAULT false,
  has_anytrack BOOLEAN DEFAULT false,
  
  -- Confidence score (0-100)
  confidence_score INTEGER DEFAULT 0,
  
  -- Source event IDs for reference
  facebook_capi_event_id TEXT,
  hubspot_contact_id TEXT,
  hubspot_deal_id_ref TEXT,
  anytrack_event_id TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  alignment_method TEXT, -- email_match, phone_match, external_id_match, time_window_match
  alignment_notes TEXT -- Notes about how alignment was done
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_ultimate_truth_email ON public.ultimate_truth_events(email);
CREATE INDEX IF NOT EXISTS idx_ultimate_truth_phone ON public.ultimate_truth_events(phone);
CREATE INDEX IF NOT EXISTS idx_ultimate_truth_event_time ON public.ultimate_truth_events(event_time);
CREATE INDEX IF NOT EXISTS idx_ultimate_truth_deal_id ON public.ultimate_truth_events(hubspot_deal_id);
CREATE INDEX IF NOT EXISTS idx_ultimate_truth_confidence ON public.ultimate_truth_events(confidence_score);

-- View for dashboard
CREATE OR REPLACE VIEW public.ultimate_truth_dashboard AS
SELECT 
  ultimate_event_id,
  event_name,
  event_time,
  email,
  attribution_source,
  attribution_campaign,
  conversion_value,
  conversion_currency,
  hubspot_deal_id,
  deal_closed_at,
  has_facebook_capi,
  has_hubspot,
  has_anytrack,
  confidence_score,
  alignment_method,
  CASE 
    WHEN confidence_score >= 80 THEN 'HIGH'
    WHEN confidence_score >= 60 THEN 'MEDIUM'
    ELSE 'LOW'
  END as confidence_level
FROM public.ultimate_truth_events
ORDER BY event_time DESC;

-- Function to calculate confidence score
CREATE OR REPLACE FUNCTION public.calculate_confidence_score(
  p_has_email BOOLEAN,
  p_has_phone BOOLEAN,
  p_has_fbp BOOLEAN,
  p_has_fbc BOOLEAN,
  p_has_external_id BOOLEAN,
  p_multiple_sources BOOLEAN,
  p_time_aligned BOOLEAN
) RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
BEGIN
  IF p_has_email THEN score := score + 25; END IF;
  IF p_has_phone THEN score := score + 20; END IF;
  IF p_has_fbp THEN score := score + 30; END IF;
  IF p_has_fbc THEN score := score + 15; END IF;
  IF p_has_external_id THEN score := score + 10; END IF;
  IF p_multiple_sources THEN score := score + 20; END IF;
  IF p_time_aligned THEN score := score + 10; END IF;
  
  RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.calculate_confidence_score TO anon, authenticated, service_role;

COMMENT ON TABLE public.ultimate_truth_events IS 'Aligned events from Facebook CAPI, HubSpot, and AnyTrack - single source of truth';
COMMENT ON VIEW public.ultimate_truth_dashboard IS 'Dashboard view of ultimate truth events with confidence levels';
