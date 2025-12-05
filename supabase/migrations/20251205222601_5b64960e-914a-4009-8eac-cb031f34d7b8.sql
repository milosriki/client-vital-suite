-- Enable RLS on client_health_scores
ALTER TABLE public.client_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client_health_scores"
ON public.client_health_scores FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Enable RLS on coach_performance
ALTER TABLE public.coach_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage coach_performance"
ON public.coach_performance FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Enable RLS on intervention_log
ALTER TABLE public.intervention_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage intervention_log"
ON public.intervention_log FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Enable RLS on daily_summary
ALTER TABLE public.daily_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage daily_summary"
ON public.daily_summary FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Enable RLS on coach_reviews
ALTER TABLE public.coach_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage coach_reviews"
ON public.coach_reviews FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());