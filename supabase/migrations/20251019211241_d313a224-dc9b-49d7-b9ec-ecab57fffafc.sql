-- Create enriched CAPI events table with full Meta parameters
CREATE TABLE IF NOT EXISTS public.capi_events_enriched (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event Core
  event_id TEXT UNIQUE NOT NULL,
  event_name TEXT NOT NULL,
  event_time TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- User Data (will be hashed before sending)
  email TEXT,
  phone TEXT,
  first_name TEXT,
  last_name TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'ae',
  zip_code TEXT,
  external_id TEXT,
  
  -- Meta Cookies (NEVER hash)
  fbp TEXT,
  fbc TEXT,
  
  -- Event Data
  currency TEXT DEFAULT 'AED',
  value NUMERIC(12,2),
  content_name TEXT,
  content_category TEXT,
  content_ids TEXT[],
  num_items INTEGER,
  
  -- Source Context
  event_source_url TEXT,
  action_source TEXT DEFAULT 'website',
  
  -- HubSpot Enrichment
  hubspot_contact_id TEXT,
  hubspot_deal_id TEXT,
  lifecycle_stage TEXT,
  lead_source TEXT,
  original_source TEXT,
  
  -- Stripe Enrichment
  stripe_customer_id TEXT,
  stripe_charge_id TEXT,
  stripe_invoice_id TEXT,
  payment_method TEXT,
  subscription_id TEXT,
  subscription_status TEXT,
  
  -- Batch Processing
  batch_id UUID,
  batch_scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  send_status TEXT DEFAULT 'pending',
  send_attempts INTEGER DEFAULT 0,
  
  -- Meta Response
  meta_event_id TEXT,
  meta_response JSONB,
  
  -- Metadata
  mode TEXT DEFAULT 'test',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  raw_payload JSONB
);

-- Create batch_jobs table for batch processing control
CREATE TABLE IF NOT EXISTS public.batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name TEXT NOT NULL,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  execution_time TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending', -- pending, running, completed, failed
  events_count INTEGER DEFAULT 0,
  events_sent INTEGER DEFAULT 0,
  events_failed INTEGER DEFAULT 0,
  mode TEXT DEFAULT 'test',
  notes TEXT,
  error_log JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create batch_config table for timing controls
CREATE TABLE IF NOT EXISTS public.batch_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_name TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  batch_size INTEGER DEFAULT 200,
  batch_time TIME NOT NULL, -- e.g., '02:00:00' for 2 AM
  timezone TEXT DEFAULT 'Asia/Dubai',
  days_of_week INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7], -- 1=Monday, 7=Sunday
  mode TEXT DEFAULT 'test',
  last_run TIMESTAMP WITH TIME ZONE,
  next_run TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_capi_enriched_event_id ON public.capi_events_enriched(event_id);
CREATE INDEX IF NOT EXISTS idx_capi_enriched_event_time ON public.capi_events_enriched(event_time);
CREATE INDEX IF NOT EXISTS idx_capi_enriched_send_status ON public.capi_events_enriched(send_status);
CREATE INDEX IF NOT EXISTS idx_capi_enriched_batch_scheduled ON public.capi_events_enriched(batch_scheduled_for) WHERE send_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_capi_enriched_hubspot_id ON public.capi_events_enriched(hubspot_contact_id);
CREATE INDEX IF NOT EXISTS idx_capi_enriched_stripe_id ON public.capi_events_enriched(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_scheduled ON public.batch_jobs(scheduled_time) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.capi_events_enriched ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public access to capi_events_enriched"
  ON public.capi_events_enriched FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public access to batch_jobs"
  ON public.batch_jobs FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public access to batch_config"
  ON public.batch_config FOR ALL USING (true) WITH CHECK (true);

-- Triggers
CREATE TRIGGER update_capi_enriched_updated_at
  BEFORE UPDATE ON public.capi_events_enriched
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_batch_config_updated_at
  BEFORE UPDATE ON public.batch_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default batch config
INSERT INTO public.batch_config (config_name, batch_time, batch_size, notes)
VALUES 
  ('daily_morning_batch', '02:00:00', 200, 'Daily batch at 2 AM Dubai time'),
  ('daily_afternoon_batch', '14:00:00', 200, 'Daily batch at 2 PM Dubai time')
ON CONFLICT (config_name) DO NOTHING;

COMMENT ON TABLE public.capi_events_enriched IS 'Enriched Meta CAPI events with HubSpot and Stripe data';
COMMENT ON TABLE public.batch_jobs IS 'Batch job execution tracking';
COMMENT ON TABLE public.batch_config IS 'Batch processing schedule configuration';