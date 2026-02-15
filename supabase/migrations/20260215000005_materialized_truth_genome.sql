-- High-performance materialized view for enterprise strategy page
-- FIX: known_cards bridge, DISTINCT ON for unique contact_id

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_enterprise_truth_genome AS
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
        ROUND(AVG(CASE
            WHEN duration_seconds > 900 THEN 100
            WHEN duration_seconds > 300 THEN 70
            ELSE 30
        END), 0) AS lead_intent_iq,
        COUNT(*) AS total_calls
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
    COALESCE(ci.lead_intent_iq, 0) AS lead_intent_iq,
    COALESCE(ci.avg_duration, 0) / 60.0 AS avg_call_min,
    CASE
        WHEN COALESCE(f.lifetime_value, 0) > 0 THEN 'VERIFIED WINNER'
        WHEN COALESCE(ci.lead_intent_iq, 0) > 80 THEN 'HIGH INTENT PENDING'
        WHEN c.custom_lifecycle_stage = 'closedwon' AND COALESCE(f.lifetime_value, 0) = 0
          THEN 'REVENUE LEAK'
        ELSE 'PROSPECTING'
    END AS atlas_verdict,
    now() AS last_reconciled_at
FROM public.contacts c
LEFT JOIN financial_dna f ON f.customer_email_lower = lower(c.email)
LEFT JOIN attribution_bridge ab ON ab.email_lower = lower(c.email)
LEFT JOIN call_intelligence ci ON ci.caller_number = c.phone;

-- Rule 1.1: UNIQUE index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_genome_contact_id
  ON public.mv_enterprise_truth_genome (contact_id);

-- Rule 1.5: Partial index for verdict queries
CREATE INDEX IF NOT EXISTS idx_mv_genome_verdict
  ON public.mv_enterprise_truth_genome (atlas_verdict)
  WHERE atlas_verdict IN ('VERIFIED WINNER', 'HIGH INTENT PENDING', 'REVENUE LEAK');

-- Rule 1.3: Composite for Creative DNA tab
CREATE INDEX IF NOT EXISTS idx_mv_genome_ad_verdict
  ON public.mv_enterprise_truth_genome (ad_id, atlas_verdict)
  WHERE ad_id IS NOT NULL;

-- Rule 1.4: Covering index for revenue queries
CREATE INDEX IF NOT EXISTS idx_mv_genome_cash
  ON public.mv_enterprise_truth_genome (verified_cash DESC)
  INCLUDE (lead_name, email, atlas_verdict);

-- Refresh function (Rule 5.1: short transaction)
CREATE OR REPLACE FUNCTION public.refresh_revenue_genome()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_enterprise_truth_genome;
END;
$$;

GRANT SELECT ON public.mv_enterprise_truth_genome TO authenticated;
GRANT SELECT ON public.mv_enterprise_truth_genome TO service_role;
