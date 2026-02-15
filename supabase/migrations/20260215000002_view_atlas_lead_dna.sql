-- view_atlas_lead_dna: Ad Creative → Call Quality → Stripe Cash
-- Fix: stripe_transactions.customer_email → known_cards bridge
-- Rule 1.1: Ensure all JOIN columns are indexed

-- Rule 1.1: Functional index for LOWER() joins
CREATE INDEX IF NOT EXISTS idx_attribution_events_email_lower
  ON public.attribution_events (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_known_cards_email_lower
  ON public.known_cards (lower(customer_email))
  WHERE customer_email IS NOT NULL;

-- Rule 1.5: Partial index — only succeeded transactions matter
CREATE INDEX IF NOT EXISTS idx_stripe_txn_succeeded
  ON public.stripe_transactions (customer_id)
  WHERE status = 'succeeded';

CREATE OR REPLACE VIEW public.view_atlas_lead_dna AS
WITH ad_performance AS (
    SELECT
        ad_id,
        creative_name,
        body AS ad_copy,
        image_url,
        status AS ad_status
    FROM public.facebook_creatives
),
lead_journey AS (
    SELECT DISTINCT ON (c.id)
        c.id AS contact_id,
        c.email,
        c.phone,
        c.first_name,
        c.last_name,
        c.city,
        c.custom_lifecycle_stage,
        ae.fb_ad_id,
        ae.source AS attribution_source
    FROM public.contacts c
    JOIN public.attribution_events ae
      ON lower(ae.email) = lower(c.email)
    WHERE ae.fb_ad_id IS NOT NULL
    ORDER BY c.id, ae.event_time DESC
),
call_intent AS (
    SELECT
        caller_number,
        SUM(duration_seconds) AS total_call_duration,
        MAX(started_at) AS last_call_at,
        COUNT(*) AS total_calls
    FROM public.call_records
    GROUP BY caller_number
),
revenue_truth AS (
    SELECT
        lower(kc.customer_email) AS customer_email_lower,
        SUM(st.amount) / 100 AS total_cash_collected
    FROM public.stripe_transactions st
    JOIN public.known_cards kc ON kc.customer_id = st.customer_id
    WHERE st.status = 'succeeded'
      AND kc.customer_email IS NOT NULL
    GROUP BY lower(kc.customer_email)
)
SELECT
    lj.contact_id,
    lj.first_name || ' ' || lj.last_name AS full_name,
    lj.email,
    lj.city,
    lj.custom_lifecycle_stage,
    ap.ad_id,
    ap.creative_name,
    ap.ad_copy,
    ap.image_url,
    COALESCE(ci.total_call_duration, 0) AS call_duration_seconds,
    COALESCE(ci.total_calls, 0) AS call_count,
    COALESCE(rt.total_cash_collected, 0) AS verified_revenue,
    CASE
        WHEN ci.total_call_duration > 900 AND COALESCE(rt.total_cash_collected, 0) = 0
          THEN 'High Intent - Pending'
        WHEN COALESCE(rt.total_cash_collected, 0) > 0
          THEN 'Verified Winner'
        WHEN ci.total_call_duration < 60 AND ci.total_calls > 0
          THEN 'Low Intent - Potential Waste'
        ELSE 'Neutral'
    END AS atlas_lead_status
FROM lead_journey lj
LEFT JOIN ad_performance ap ON ap.ad_id = lj.fb_ad_id
LEFT JOIN call_intent ci ON ci.caller_number = lj.phone
LEFT JOIN revenue_truth rt ON rt.customer_email_lower = lower(lj.email);

GRANT SELECT ON public.view_atlas_lead_dna TO authenticated;
GRANT SELECT ON public.view_atlas_lead_dna TO service_role;
