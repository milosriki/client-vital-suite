-- Create event_mappings table for HubSpot to Meta event configuration
CREATE TABLE IF NOT EXISTS public.event_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hubspot_event_name TEXT NOT NULL,
  meta_event_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  event_parameters JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(hubspot_event_name)
);

-- Enable RLS
ALTER TABLE public.event_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies for event_mappings
CREATE POLICY "Allow public read access"
  ON public.event_mappings
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access"
  ON public.event_mappings
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access"
  ON public.event_mappings
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access"
  ON public.event_mappings
  FOR DELETE
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_event_mappings_updated_at
  BEFORE UPDATE ON public.event_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default Meta standard events
INSERT INTO public.event_mappings (hubspot_event_name, meta_event_name, is_active, event_parameters) VALUES
  ('initial_lead', 'Lead', true, '{"currency": "AED"}'::jsonb),
  ('lead', 'Lead', true, '{"currency": "AED"}'::jsonb),
  ('marketingqualifiedlead', 'Lead', true, '{"currency": "AED", "content_name": "Marketing Qualified Lead"}'::jsonb),
  ('salesqualifiedlead', 'Lead', true, '{"currency": "AED", "content_name": "Sales Qualified Lead"}'::jsonb),
  ('opportunity', 'InitiateCheckout', true, '{"currency": "AED"}'::jsonb),
  ('customer', 'Purchase', true, '{"currency": "AED"}'::jsonb),
  ('pageview', 'PageView', true, '{}'::jsonb),
  ('view_content', 'ViewContent', true, '{"currency": "AED"}'::jsonb)
ON CONFLICT (hubspot_event_name) DO NOTHING;

COMMENT ON TABLE public.event_mappings IS 'Maps HubSpot events to Meta Conversions API standard events';