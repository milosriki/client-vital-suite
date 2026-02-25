CREATE TABLE IF NOT EXISTS public.marketing_recommendations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id text,
  ad_name text,
  action text,
  reasoning text,
  metrics jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending',
  severity text DEFAULT 'medium',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.marketing_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all ON public.marketing_recommendations;
CREATE POLICY service_role_all ON public.marketing_recommendations FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT ON public.marketing_recommendations TO anon, authenticated;
GRANT ALL ON public.marketing_recommendations TO service_role;
NOTIFY pgrst, 'reload schema';
