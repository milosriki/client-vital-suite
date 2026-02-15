-- Create Truth Triangle View
-- Joins Ad Spend (Meta), Deal Value (HubSpot), and Collected Cash (Stripe)
-- Purpose: Verify revenue claims across 3 independent systems
-- Fixed: date_start→date, created→created_at, removed net (doesn't exist)

CREATE OR REPLACE VIEW public.view_truth_triangle AS
SELECT
    -- Time Dimension
    COALESCE(f.m, d.m, s.m) as month,

    -- Source 1: Meta Ads (Spend)
    COALESCE(f.spend, 0) as meta_ad_spend,
    COALESCE(f.purchase_value, 0) as meta_reported_revenue,

    -- Source 2: HubSpot Deals (Closed Won Value)
    COALESCE(d.deal_value, 0) as hubspot_deal_value,
    COALESCE(d.deal_count, 0)::int as hubspot_deal_count,

    -- Source 3: Stripe (Actual Cash)
    COALESCE(s.amount, 0) as stripe_gross_revenue,

    -- Discrepancies
    (COALESCE(s.amount, 0) - COALESCE(d.deal_value, 0)) as gap_stripe_hubspot,

    -- ROAS Calculations
    CASE
        WHEN COALESCE(f.spend, 0) > 0 THEN COALESCE(s.amount, 0) / f.spend
        ELSE 0
    END as true_roas_cash,

    CASE
        WHEN COALESCE(f.spend, 0) > 0 THEN COALESCE(d.deal_value, 0) / f.spend
        ELSE 0
    END as pipeline_roas_booked

FROM
    (SELECT DATE_TRUNC('month', date::date)::DATE as m, SUM(spend) as spend, SUM(purchase_value) as purchase_value
     FROM facebook_ads_insights GROUP BY 1) f

    FULL OUTER JOIN

    (SELECT DATE_TRUNC('month', close_date::date)::DATE as m, SUM(deal_value) as deal_value, COUNT(id) as deal_count
     FROM deals WHERE stage = 'closedwon' GROUP BY 1) d
    ON f.m = d.m

    FULL OUTER JOIN

    (SELECT DATE_TRUNC('month', created_at::date)::DATE as m, SUM(amount) as amount
     FROM stripe_transactions WHERE status = 'succeeded' GROUP BY 1) s
    ON COALESCE(f.m, d.m) = s.m

ORDER BY month DESC;

COMMENT ON VIEW public.view_truth_triangle IS 'Aggregated monthly truth comparison between Meta Spend, HubSpot Deals, and Stripe Cash.';
