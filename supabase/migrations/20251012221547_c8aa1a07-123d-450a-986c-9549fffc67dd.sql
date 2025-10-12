-- Enable RLS on client_health_scores table
ALTER TABLE public.client_health_scores ENABLE ROW LEVEL SECURITY;

-- Create policy for read access
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