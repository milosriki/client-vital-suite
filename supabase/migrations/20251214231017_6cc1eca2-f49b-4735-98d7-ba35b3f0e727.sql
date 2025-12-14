-- Add public read access for client_health_scores so dashboard can display data
CREATE POLICY "Public read access for client_health_scores" 
ON public.client_health_scores 
FOR SELECT 
USING (true);