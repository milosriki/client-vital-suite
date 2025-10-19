-- Create app_settings table for storing configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_url TEXT,
  supabase_anon_key TEXT,
  n8n_base_url TEXT,
  capi_base_url TEXT,
  meta_pixel_id TEXT,
  meta_access_token TEXT,
  test_event_code TEXT,
  telegram_bot_token TEXT,
  telegram_chat_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow public access for settings (adjust as needed)
CREATE POLICY "Allow public read access" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.app_settings FOR UPDATE USING (true);

-- Create capi_events table for logging CAPI events
CREATE TABLE IF NOT EXISTS public.capi_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  value_aed NUMERIC,
  fbp TEXT,
  fbc TEXT,
  external_id TEXT,
  event_id TEXT,
  mode TEXT DEFAULT 'test',
  test_event_code TEXT,
  status TEXT,
  response_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.capi_events ENABLE ROW LEVEL SECURITY;

-- Allow public access
CREATE POLICY "Allow public read access" ON public.capi_events FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.capi_events FOR INSERT WITH CHECK (true);

-- Create automation_logs table
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  mode TEXT DEFAULT 'test',
  status TEXT,
  payload JSONB,
  response_data JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Allow public access
CREATE POLICY "Allow public read access" ON public.automation_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.automation_logs FOR INSERT WITH CHECK (true);

-- Create view for company health aggregates
CREATE OR REPLACE VIEW public.company_health_aggregates AS
SELECT 
  DATE(calculated_at) as report_date,
  AVG(health_score) as company_avg_score,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY health_score) as median_health_score,
  STDDEV(health_score) as health_score_stdev,
  COUNT(*) FILTER (WHERE health_zone = 'RED') as red_count,
  ROUND(COUNT(*) FILTER (WHERE health_zone = 'RED') * 100.0 / NULLIF(COUNT(*), 0), 2) as red_pct,
  COUNT(*) FILTER (WHERE health_zone = 'YELLOW') as yellow_count,
  COUNT(*) FILTER (WHERE health_zone = 'GREEN') as green_count,
  COUNT(*) FILTER (WHERE health_zone = 'PURPLE') as purple_count,
  COUNT(*) FILTER (WHERE momentum_indicator = 'ACCELERATING') as clients_improving,
  COUNT(*) FILTER (WHERE momentum_indicator = 'DECELERATING') as clients_declining,
  COUNT(*) as total_clients
FROM client_health_scores
GROUP BY DATE(calculated_at)
ORDER BY report_date DESC;

-- Add trigger for updating updated_at
CREATE OR REPLACE FUNCTION update_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION update_app_settings_updated_at();