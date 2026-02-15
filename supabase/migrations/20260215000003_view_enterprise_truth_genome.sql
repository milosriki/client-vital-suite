-- 5-source reconciliation: FB + AnyTrack + HubSpot + CallGear + Stripe
-- Fix: customer_email → known_cards bridge
-- Fix: DISTINCT ON to prevent duplicate contacts

CREATE OR REPLACE VIEW public.view_enterprise_truth_genome AS
WITH financial_dna AS (
    SELECT
        lower(kc.customer_email) AS customer_email_lower,
        SUM(st.amount) / 100 AS lifetime_value,
        MIN(st.created_at) AS first_payment_at
    FROM public.stripe_transactions st
    JOIN public.known_cards kc ON kc.customer_id = st.customer_id
    WHERE st.status = 'succeeded'
      AND kc.customer_email IS NOT NULL
    GROUP BY lower(kc.customer_email)
),
attribution_bridge AS (
    SELECT DISTINCT ON (lower(email))
        lower(email) AS email_lower,
        fb_ad_id,
        fb_adset_id,
        fb_campaign_id,
        utm_source,
        utm_medium,
        utm_content,
        created_at AS lead_created_at
    FROM public.attribution_events
    WHERE email IS NOT NULL
    ORDER BY lower(email), created_at DESC
),
call_intelligence AS (
    SELECT
        caller_number,
        AVG(duration_seconds) AS avg_duration,
        COUNT(*) AS total_calls,
        MAX(started_at) AS last_call_at
    FROM public.call_records
    GROUP BY caller_number
)
SELECT
    c.id AS contact_id,
    c.first_name || ' ' || c.last_name AS lead_name,
    c.email,
    c.city,
    c.custom_lifecycle_stage AS stage,
    COALESCE(ab.fb_ad_id, c.attributed_ad_id) AS ad_id,
    COALESCE(f.lifetime_value, 0) AS verified_cash,
    EXTRACT(EPOCH FROM (f.first_payment_at - ab.lead_created_at)) / 86400 AS payback_days,
    COALESCE(ci.avg_duration, 0) AS avg_call_min,
    CASE
        WHEN COALESCE(f.lifetime_value, 0) > 0 THEN 'VERIFIED WINNER'
        WHEN COALESCE(ci.avg_duration, 0) > 900 THEN 'HIGH INTENT PENDING'
        WHEN c.custom_lifecycle_stage = 'closedwon' AND COALESCE(f.lifetime_value, 0) = 0
          THEN 'REVENUE LEAK'
        ELSE 'PROSPECTING'
    END AS atlas_verdict
FROM public.contacts c
LEFT JOIN financial_dna f ON f.customer_email_lower = lower(c.email)
LEFT JOIN attribution_bridge ab ON ab.email_lower = lower(c.email)
LEFT JOIN call_intelligence ci ON ci.caller_number = c.phone;

GRANT SELECT ON public.view_enterprise_truth_genome TO authenticated;
GRANT SELECT ON public.view_enterprise_truth_genome TO service_role;
