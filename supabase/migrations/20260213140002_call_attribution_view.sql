-- Task 4.3: Call → Ad/Deal Links
-- Links each call to its attributed Facebook ad and associated deal
-- via: call_records.caller_number → contacts.phone → attribution_events + deals

CREATE INDEX IF NOT EXISTS idx_contacts_phone
  ON contacts (phone) WHERE phone IS NOT NULL;

CREATE OR REPLACE VIEW public.call_attribution AS
SELECT
    cr.id AS call_id,
    cr.caller_number,
    cr.call_direction,
    cr.call_status,
    cr.call_outcome,
    cr.duration_seconds,
    cr.started_at AS call_started_at,
    cr.appointment_set,
    cr.revenue_generated AS call_revenue,
    cr.lead_quality,
    cr.call_score,
    cr.hubspot_owner_id AS agent_id,
    -- Contact info
    c.id AS contact_id,
    c.email AS contact_email,
    c.first_name,
    c.last_name,
    -- Attribution (which ad drove this call)
    ae.fb_ad_id,
    ae.fb_ad_name,
    ae.fb_adset_id,
    ae.fb_adset_name,
    ae.fb_campaign_id,
    ae.fb_campaign_name,
    ae.source AS attribution_source,
    ae.event_time AS attribution_event_time,
    -- Deal info (what deal this contact has)
    d.id AS deal_id,
    d.hubspot_deal_id,
    d.deal_name,
    d.deal_value,
    d.stage AS deal_stage,
    d.status AS deal_status
FROM public.call_records cr
JOIN public.contacts c ON c.phone = cr.caller_number
LEFT JOIN LATERAL (
    SELECT
        fb_ad_id, fb_ad_name,
        fb_adset_id, fb_adset_name,
        fb_campaign_id, fb_campaign_name,
        source, event_time
    FROM public.attribution_events
    WHERE email = c.email
    ORDER BY event_time DESC
    LIMIT 1
) ae ON c.email IS NOT NULL
LEFT JOIN public.deals d ON d.contact_id = c.id
WHERE cr.caller_number IS NOT NULL;

GRANT SELECT ON public.call_attribution TO authenticated;
