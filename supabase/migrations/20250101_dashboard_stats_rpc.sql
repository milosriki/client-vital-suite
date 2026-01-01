CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  now_date date := current_date;
  this_month_start date := date_trunc('month', now_date);
  this_month_end date := (date_trunc('month', now_date) + interval '1 month - 1 day')::date;
  last_month_start date := date_trunc('month', now_date - interval '1 month');
  last_month_end date := (date_trunc('month', now_date - interval '1 month') + interval '1 month - 1 day')::date;
  
  revenue_this_month numeric;
  revenue_last_month numeric;
  revenue_today numeric;
  pipeline_val numeric;
  pipeline_cnt integer;
  revenue_trend numeric;
BEGIN
  -- Revenue This Month
  SELECT COALESCE(SUM(deal_value), 0) INTO revenue_this_month
  FROM deals
  WHERE status = 'closed' 
  AND close_date >= this_month_start 
  AND close_date <= this_month_end;

  -- Revenue Last Month
  SELECT COALESCE(SUM(deal_value), 0) INTO revenue_last_month
  FROM deals
  WHERE status = 'closed' 
  AND close_date >= last_month_start 
  AND close_date <= last_month_end;

  -- Revenue Today
  SELECT COALESCE(SUM(deal_value), 0) INTO revenue_today
  FROM deals
  WHERE status = 'closed' 
  AND close_date >= now_date;

  -- Pipeline
  SELECT COALESCE(SUM(deal_value), 0), COUNT(*) INTO pipeline_val, pipeline_cnt
  FROM deals
  WHERE status NOT IN ('closed', 'lost');

  -- Calculate Trend
  IF revenue_last_month > 0 THEN
    revenue_trend := ROUND(((revenue_this_month - revenue_last_month) / revenue_last_month) * 100, 0);
  ELSE
    revenue_trend := 0;
  END IF;

  RETURN json_build_object(
    'revenue_this_month', revenue_this_month,
    'revenue_last_month', revenue_last_month,
    'revenue_today', revenue_today,
    'revenue_trend', revenue_trend,
    'pipeline_value', pipeline_val,
    'pipeline_count', pipeline_cnt,
    'is_positive_trend', revenue_trend >= 0
  );
END;
$$;
