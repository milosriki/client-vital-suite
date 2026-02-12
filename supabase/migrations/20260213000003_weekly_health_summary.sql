-- Weekly Health Summary VIEW
-- Aggregates daily_summary by ISO week to power weekly trend charts
-- Source: daily_summary table (populated by nightly health-score-calculator)

CREATE OR REPLACE VIEW public.weekly_health_summary AS
SELECT
  DATE_TRUNC('week', summary_date)::date AS week_start,
  (DATE_TRUNC('week', summary_date)::date + 6) AS week_end,
  ROUND(AVG(avg_health_score), 1) AS avg_health_score,
  MAX(total_clients) AS total_clients,
  ROUND(AVG(clients_red)) AS red_clients,
  ROUND(AVG(clients_yellow)) AS yellow_clients,
  ROUND(AVG(clients_green)) AS green_clients,
  ROUND(AVG(clients_purple)) AS purple_clients,
  COUNT(*) AS days_in_week
FROM public.daily_summary
WHERE summary_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE_TRUNC('week', summary_date)
ORDER BY week_start DESC;

-- Grants
GRANT SELECT ON public.weekly_health_summary TO authenticated;

COMMENT ON VIEW public.weekly_health_summary IS 'Weekly aggregation of daily_summary for trend charts. AVGs zone counts and health score per ISO week.';
