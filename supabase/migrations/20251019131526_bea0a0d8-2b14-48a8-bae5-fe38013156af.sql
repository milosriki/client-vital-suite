-- Fix security warnings from previous migration

-- Fix the company_health_aggregates view security issue
DROP VIEW IF EXISTS public.company_health_aggregates;

CREATE VIEW public.company_health_aggregates
WITH (security_invoker = true) AS
SELECT
  AVG(health_score)::numeric(10,2) AS company_avg_score,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY health_score) AS median_health_score,
  STDDEV_POP(health_score)::numeric(10,2) AS health_score_stdev,
  SUM((zone='red')::int) AS red_count,
  ROUND(100.0 * SUM((zone='red')::int)/NULLIF(COUNT(*),0), 2) AS red_pct,
  SUM((zone='yellow')::int) AS yellow_count,
  SUM((zone='green')::int) AS green_count,
  SUM((zone='purple')::int) AS purple_count,
  SUM((improving=true)::int) AS clients_improving,
  SUM((improving=false)::int) AS clients_declining
FROM public.health_scores
WHERE as_of >= CURRENT_DATE - INTERVAL '30 days';

-- Fix functions without search_path set
CREATE OR REPLACE FUNCTION public.client_health_scores_set_calculated_on()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.calculated_on := DATE(NEW.calculated_at);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_calculated_on()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.calculated_on := DATE(NEW.calculated_at);
  RETURN NEW;
END;
$function$;