-- view_call_attribution: JOIN call_records → contacts via normalized phone (last 9 digits)
-- Answers: "Which call came from which Facebook ad?"
-- Phone normalization: strip non-digits, match last 9 digits to handle +971/00971/0 prefixes

-- Functional index for phone normalization on contacts (enables fast join)
CREATE INDEX IF NOT EXISTS idx_contacts_phone_last9
  ON public.contacts (RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 9))
  WHERE phone IS NOT NULL;

-- Functional index for caller_number normalization on call_records
CREATE INDEX IF NOT EXISTS idx_call_records_caller_last9
  ON public.call_records (RIGHT(regexp_replace(caller_number, '[^0-9]', '', 'g'), 9))
  WHERE caller_number IS NOT NULL;

CREATE OR REPLACE VIEW public.view_call_attribution AS
SELECT
    -- Call identity
    cr.id                                                   AS call_id,
    cr.call_id                                              AS call_external_id,
    cr.direction                                            AS call_direction,
    cr.status                                               AS call_status,
    cr.outcome                                              AS call_outcome,
    cr.duration                                             AS duration_seconds,
    cr.started_at,
    cr.caller_number,
    cr.called_number,
    cr.appointment_set,
    cr.lead_quality,
    cr.call_score,
    cr.ptd_outcome,
    cr.hubspot_owner_id                                     AS agent_id,
    cr.owner_name                                           AS agent_name,

    -- Contact identity
    c.id                                                    AS contact_id,
    c.email                                                 AS contact_email,
    c.first_name,
    c.last_name,
    c.phone                                                 AS contact_phone,

    -- Attribution: which ad drove this call (sourced directly from contacts)
    c.attributed_ad_id                                      AS ad_id,
    c.attributed_adset_id                                   AS adset_id,
    c.attributed_campaign_id                                AS campaign_id,
    c.attribution_source                                    AS attribution_source,
    c.utm_source,
    c.utm_medium,
    c.utm_campaign

FROM public.call_records cr
JOIN public.contacts c
  ON RIGHT(regexp_replace(cr.caller_number, '[^0-9]', '', 'g'), 9)
   = RIGHT(regexp_replace(c.phone,          '[^0-9]', '', 'g'), 9)
WHERE cr.caller_number IS NOT NULL
  AND c.phone IS NOT NULL;

GRANT SELECT ON public.view_call_attribution TO authenticated;
