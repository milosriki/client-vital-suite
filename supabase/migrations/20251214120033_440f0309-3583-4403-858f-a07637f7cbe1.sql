-- Add public read access to daily_summary for dashboard
CREATE POLICY "Public read access for daily_summary" 
ON public.daily_summary 
FOR SELECT 
USING (true);

-- Add public read access to weekly_patterns for dashboard
CREATE POLICY "Public read access for weekly_patterns" 
ON public.weekly_patterns 
FOR SELECT 
USING (true);

-- Add public read access to coach_performance for dashboard
CREATE POLICY "Public read access for coach_performance" 
ON public.coach_performance 
FOR SELECT 
USING (true);