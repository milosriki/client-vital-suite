-- Fix: assessment_truth_matrix view was in 20260211000003 but failed to apply on remote
-- Re-creating it as standalone migration

CREATE OR REPLACE VIEW public.assessment_truth_matrix AS
SELECT
    c.email,
    c.first_name,
    c.last_name,
    c.owner_name as coach,
    d.stage as hubspot_deal_stage,
    CASE
        WHEN d.stage = '122237508' THEN 'Assessment Booked'
        WHEN d.stage = '122237276' THEN 'Assessment Completed'
        WHEN d.stage = '122221229' THEN 'Booking Process'
        WHEN d.stage = 'qualifiedtobuy' THEN 'Qualified to Buy'
        WHEN d.stage = 'closedwon' THEN 'Closed Won'
        WHEN d.stage = '1063991961' THEN 'Closed Lost'
        WHEN d.stage = '1064059180' THEN 'On Hold'
        ELSE d.stage
    END as hubspot_stage_name,
    CASE WHEN d.stage = '122237276' THEN true ELSE false END as hubspot_says_completed,
    CASE WHEN atc.email IS NOT NULL THEN true ELSE false END as aws_confirms_attended,
    CASE
        WHEN d.stage = '122237276' AND atc.email IS NOT NULL THEN 'CONFIRMED_ATTENDED'
        WHEN d.stage = '122237276' AND atc.email IS NULL THEN 'HUBSPOT_ONLY_NO_AWS_PROOF'
        WHEN d.stage = '122237508' AND atc.email IS NOT NULL THEN 'ATTENDED_BUT_HUBSPOT_NOT_UPDATED'
        WHEN d.stage = '122237508' AND atc.email IS NULL THEN 'BOOKED_NOT_ATTENDED'
        WHEN d.stage IN ('closedwon', '1063991961') THEN 'PAST_ASSESSMENT_STAGE'
        ELSE 'UNKNOWN'
    END as truth_status,
    ae.fb_ad_id,
    ae.campaign,
    ae.source as attribution_source,
    c.created_at as lead_created_at,
    d.created_at as deal_created_at,
    d.updated_at as stage_updated_at,
    chs.health_score,
    chs.health_zone
FROM public.contacts c
JOIN public.deals d ON d.contact_id = c.id
LEFT JOIN public.aws_truth_cache atc ON atc.email = c.email
LEFT JOIN public.client_health_scores chs ON chs.email = c.email
LEFT JOIN LATERAL (
    SELECT fb_ad_id, campaign, source
    FROM public.attribution_events
    WHERE email = c.email
    ORDER BY event_time DESC
    LIMIT 1
) ae ON true
WHERE d.stage IN ('122237508', '122237276', '122221229', 'qualifiedtobuy',
                  'closedwon', '1063991961', '1064059180');

COMMENT ON VIEW public.assessment_truth_matrix IS 'Cross-references HubSpot deal stages with AWS ground truth for assessment verification';
