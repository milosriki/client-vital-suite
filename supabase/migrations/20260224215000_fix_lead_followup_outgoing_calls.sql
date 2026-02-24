-- Phase 5 Fix: view_lead_follow_up - Fix total_outgoing_calls always returning 0
--
-- ROOT CAUSE:
--   1. call_counts CTE joins on caller_number only — for outbound HubSpot calls,
--      caller_number = agent's FROM number, NOT the lead's phone.
--      The sync now stores the contact's phone in caller_number, but old records
--      still have the wrong value.
--   2. call_counts had no outbound filter — now separated into total/outbound/inbound.
--   3. The view had no `total_outgoing_calls` column at all.
--
-- FIX: 
--   - Match call_records on c.phone = COALESCE(cr.caller_number, cr.called_number)
--     (covers both old HubSpot data with agent's FROM# in caller_number AND
--      new data/CallGear data with contact's phone in caller_number)
--   - Add `total_outgoing_calls` column filtered by call_direction = 'outbound'
--   - Keep backward-compatible `total_calls` and `no_calls_made` columns

CREATE OR REPLACE VIEW view_lead_follow_up AS
WITH contact_calls AS (
  -- Match call_records to contacts via phone.
  -- Strategy:
  --   A) caller_number = contact phone (CallGear + fixed HubSpot outbound)
  --   B) called_number = contact phone (old HubSpot outbound data stored agent# in caller_number)
  -- Use DISTINCT to avoid double-counting when both columns match the same contact.
  SELECT DISTINCT
    c.id AS contact_id,
    cr.id AS call_record_id,
    cr.call_status,
    cr.call_outcome,
    cr.created_at AS call_date,
    cr.hubspot_owner_id,
    cr.duration_seconds,
    COALESCE(cr.call_direction, 'unknown') AS call_direction
  FROM call_records cr
  CROSS JOIN LATERAL (
    SELECT c.id FROM contacts c
    WHERE c.phone IS NOT NULL
      AND (c.phone = cr.caller_number OR c.phone = cr.called_number)
    LIMIT 1
  ) c
  WHERE cr.caller_number IS NOT NULL OR cr.called_number IS NOT NULL
),
latest_calls AS (
  SELECT DISTINCT ON (contact_id)
    contact_id,
    call_status,
    call_outcome,
    call_date AS last_call_date,
    hubspot_owner_id AS last_call_agent,
    duration_seconds
  FROM contact_calls
  ORDER BY contact_id, call_date DESC
),
call_counts AS (
  SELECT
    contact_id,
    COUNT(*) AS total_calls,
    COUNT(*) FILTER (WHERE call_status = 'answered' OR call_outcome = 'answered') AS answered_calls,
    COUNT(*) FILTER (WHERE call_direction = 'outbound') AS total_outgoing_calls,
    COUNT(*) FILTER (WHERE call_direction = 'inbound')  AS total_incoming_calls
  FROM contact_calls
  GROUP BY contact_id
),
latest_deals AS (
  SELECT DISTINCT ON (contact_id)
    contact_id, id AS deal_id, deal_name, stage AS deal_stage,
    deal_value, close_date, created_at AS deal_created, updated_at AS deal_updated
  FROM deals WHERE status != 'cancelled'
  ORDER BY contact_id, created_at DESC
)
SELECT
  c.id,
  c.hubspot_contact_id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.city,
  c.owner_name AS setter_name,
  c.lifecycle_stage,
  c.latest_traffic_source AS lead_source,
  c.utm_source,
  c.utm_campaign,
  c.created_at AS contact_created,
  EXTRACT(DAY FROM NOW() - c.created_at)::int AS days_since_created,
  lc.call_status AS last_call_status,
  lc.call_outcome AS last_call_outcome,
  lc.last_call_date,
  lc.last_call_agent,
  COALESCE(cc.total_calls, 0)::int AS total_calls,
  COALESCE(cc.answered_calls, 0)::int AS answered_calls,
  COALESCE(cc.total_outgoing_calls, 0)::int AS total_outgoing_calls,
  COALESCE(cc.total_incoming_calls, 0)::int AS total_incoming_calls,
  GREATEST(lc.last_call_date, ld.deal_updated, c.updated_at) AS last_activity_date,
  EXTRACT(DAY FROM NOW() - GREATEST(lc.last_call_date, ld.deal_updated, c.updated_at))::int AS days_since_last_contact,
  ld.deal_id IS NOT NULL AS has_deal,
  ld.deal_name,
  ld.deal_stage,
  ld.deal_value,
  ld.close_date,
  ld.deal_created,
  EXTRACT(DAY FROM NOW() - ld.deal_updated)::int AS days_in_deal_stage,
  c.assigned_coach,
  -- Issue flags
  (c.lifecycle_stage IN ('customer','opportunity') AND c.assigned_coach IS NULL) AS missing_coach,
  (c.lifecycle_stage NOT IN ('subscriber','lead','other') AND ld.deal_id IS NULL) AS missing_deal,
  (COALESCE(cc.total_calls, 0) = 0) AS no_calls_made,
  (COALESCE(cc.total_outgoing_calls, 0) = 0) AS no_outgoing_calls_made,
  (EXTRACT(DAY FROM NOW() - GREATEST(lc.last_call_date, c.updated_at)) > 7
    AND c.lifecycle_stage IN ('lead','marketingqualifiedlead')) AS going_cold,
  -- Priority scoring
  CASE
    WHEN EXTRACT(DAY FROM NOW() - GREATEST(lc.last_call_date, c.updated_at)) > 7
      AND COALESCE(ld.deal_value, 0) > 10000 THEN 1
    WHEN COALESCE(cc.total_calls, 0) = 0 THEN 1
    WHEN EXTRACT(DAY FROM NOW() - GREATEST(lc.last_call_date, c.updated_at)) > 3 THEN 2
    WHEN c.lifecycle_stage IN ('customer','opportunity') AND c.assigned_coach IS NULL THEN 2
    ELSE 3
  END AS priority_number,
  c.attributed_ad_id,
  c.attribution_source
FROM contacts c
LEFT JOIN latest_calls lc ON c.id = lc.contact_id
LEFT JOIN call_counts cc ON c.id = cc.contact_id
LEFT JOIN latest_deals ld ON c.id = ld.contact_id
WHERE c.status != 'MERGED_DUPLICATE'
  AND c.lifecycle_stage IN ('lead','marketingqualifiedlead','salesqualifiedlead','opportunity','customer')
ORDER BY priority_number ASC, days_since_last_contact DESC NULLS LAST;

-- Grant access
GRANT SELECT ON view_lead_follow_up TO authenticated;
GRANT SELECT ON view_lead_follow_up TO service_role;
