CREATE OR REPLACE FUNCTION get_campaign_money_map(days_back integer DEFAULT 90)
RETURNS TABLE (
  campaign_name text,
  total_spend numeric,
  total_leads bigint,
  total_revenue numeric,
  total_deals bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH fb_spend AS (
    SELECT 
      f.campaign_name,
      SUM(f.spend) as spend
    FROM facebook_ads_insights f
    WHERE f.date >= (current_date - days_back * interval '1 day')::date
    GROUP BY f.campaign_name
  ),
  hs_revenue AS (
    SELECT 
      COALESCE(c.utm_campaign, 'Unattributed/Organic') as campaign_name,
      COUNT(*) as leads,
      SUM(COALESCE(c.total_deal_value, 0)) as revenue,
      SUM(COALESCE(c.num_associated_deals, 0)) as deals
    FROM contacts c
    GROUP BY COALESCE(c.utm_campaign, 'Unattributed/Organic')
  ),
  all_campaigns AS (
    SELECT DISTINCT name FROM (
      SELECT f.campaign_name as name FROM fb_spend f
      UNION
      SELECT h.campaign_name as name FROM hs_revenue h
    ) s
  )
  SELECT 
    ac.name,
    COALESCE(f.spend, 0)::numeric,
    COALESCE(h.leads, 0)::bigint,
    COALESCE(h.revenue, 0)::numeric,
    COALESCE(h.deals, 0)::bigint
  FROM all_campaigns ac
  LEFT JOIN fb_spend f ON ac.name = f.campaign_name
  LEFT JOIN hs_revenue h ON ac.name = h.campaign_name
  ORDER BY h.revenue DESC NULLS LAST;
END;
$$;
