
-- 1. Check Kacper's Date
SELECT email, firstname, lastname, last_session_date, days_since_last_session, health_score 
FROM client_health_scores 
WHERE email ILIKE '%kacper%' OR firstname ILIKE '%kacper%';

-- 2. Check Top Ads (Last 3 Days)
SELECT campaign_name, ad_name, spend, impressions, clicks, leads, roas_current
FROM facebook_ads_insights
WHERE date_start >= (CURRENT_DATE - INTERVAL '3 days')
ORDER BY roas_current DESC
LIMIT 5;

-- 3. Check AI Logs for Failures
SELECT created_at, function_id, status, error_message, execution_time_ms
FROM edge_function_logs
WHERE created_at >= (NOW() - INTERVAL '1 hour')
AND status != 'success'
ORDER BY created_at DESC
LIMIT 10;
