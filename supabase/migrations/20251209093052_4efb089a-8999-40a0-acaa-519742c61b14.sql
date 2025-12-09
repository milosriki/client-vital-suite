-- Add public read access policies for sales pipeline data visibility

-- Leads table - public read
CREATE POLICY "Public read access for leads" ON public.leads FOR SELECT USING (true);

-- Enhanced leads table - public read  
CREATE POLICY "Public read access for enhanced_leads" ON public.enhanced_leads FOR SELECT USING (true);

-- Deals table - public read
CREATE POLICY "Public read access for deals" ON public.deals FOR SELECT USING (true);

-- Appointments table - public read
CREATE POLICY "Public read access for appointments" ON public.appointments FOR SELECT USING (true);

-- Call records table - public read
CREATE POLICY "Public read access for call_records" ON public.call_records FOR SELECT USING (true);

-- Contacts table - public read
CREATE POLICY "Public read access for contacts" ON public.contacts FOR SELECT USING (true);

-- Staff table - public read
CREATE POLICY "Public read access for staff" ON public.staff FOR SELECT USING (true);

-- KPI tracking table - public read
CREATE POLICY "Public read access for kpi_tracking" ON public.kpi_tracking FOR SELECT USING (true);

-- Business forecasts - public read
CREATE POLICY "Public read access for business_forecasts" ON public.business_forecasts FOR SELECT USING (true);

-- Create proactive_insights table for call tracking
CREATE TABLE IF NOT EXISTS public.proactive_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id),
  lead_id uuid REFERENCES public.leads(id),
  insight_type text NOT NULL,
  priority text DEFAULT 'medium',
  status text DEFAULT 'pending',
  recommended_action text,
  call_script text,
  best_call_time text,
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  completed_by text,
  outcome text,
  notes text
);

ALTER TABLE public.proactive_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for proactive_insights" ON public.proactive_insights FOR SELECT USING (true);
CREATE POLICY "Admins can manage proactive_insights" ON public.proactive_insights FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Fix function search paths
CREATE OR REPLACE FUNCTION public.set_calculated_on()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    NEW.calculated_on := DATE(NEW.calculated_at);
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$function$;