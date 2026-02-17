CREATE OR REPLACE VIEW view_lead_follow_up AS
WITH latest_calls AS (
  SELECT DISTINCT ON (caller_number)
    caller_number, call_status, call_outcome,
    created_at AS last_call_date, hubspot_owner_id AS last_call_agent, duration_seconds
  FROM call_records
  ORDER BY caller_number, created_at DESC
),
call_counts AS (
  SELECT caller_number, COUNT(*) AS total_calls,
    COUNT(*) FILTER (WHERE call_status = 'answered') AS answered_calls
  FROM call_records GROUP BY caller_number
),
latest_deals AS (
  SELECT DISTINCT ON (contact_id)
    contact_id, id AS deal_id, deal_name, stage AS deal_stage,
    deal_value, close_date, created_at AS deal_created, updated_at AS deal_updated
  FROM deals WHERE status != 'cancelled'
  ORDER BY contact_id, created_at DESC
)
SELECT
  c.id, c.hubspot_contact_id, c.first_name, c.last_name, c.email, c.phone, c.city,
  c.owner_name AS setter_name, c.lifecycle_stage, c.latest_traffic_source AS lead_source, c.utm_source, c.utm_campaign,
  c.created_at AS contact_created,
  EXTRACT(DAY FROM NOW() - c.created_at)::int AS days_since_created,
  lc.call_status AS last_call_status, lc.call_outcome AS last_call_outcome,
  lc.last_call_date, lc.last_call_agent,
  COALESCE(cc.total_calls, 0)::int AS total_calls,
  COALESCE(cc.answered_calls, 0)::int AS answered_calls,
  GREATEST(lc.last_call_date, ld.deal_updated, c.updated_at) AS last_activity_date,
  EXTRACT(DAY FROM NOW() - GREATEST(lc.last_call_date, ld.deal_updated, c.updated_at))::int AS days_since_last_contact,
  ld.deal_id IS NOT NULL AS has_deal, ld.deal_name, ld.deal_stage, ld.deal_value,
  ld.close_date, ld.deal_created,
  EXTRACT(DAY FROM NOW() - ld.deal_updated)::int AS days_in_deal_stage,
  c.assigned_coach,
  (c.lifecycle_stage IN ('customer','opportunity') AND c.assigned_coach IS NULL) AS missing_coach,
  (c.lifecycle_stage NOT IN ('subscriber','lead','other') AND ld.deal_id IS NULL) AS missing_deal,
  (COALESCE(cc.total_calls, 0) = 0) AS no_calls_made,
  (EXTRACT(DAY FROM NOW() - GREATEST(lc.last_call_date, c.updated_at)) > 7 AND c.lifecycle_stage IN ('lead','marketingqualifiedlead')) AS going_cold,
  CASE
    WHEN EXTRACT(DAY FROM NOW() - GREATEST(lc.last_call_date, c.updated_at)) > 7 AND COALESCE(ld.deal_value, 0) > 10000 THEN 1
    WHEN COALESCE(cc.total_calls, 0) = 0 THEN 1
    WHEN EXTRACT(DAY FROM NOW() - GREATEST(lc.last_call_date, c.updated_at)) > 3 THEN 2
    WHEN c.lifecycle_stage IN ('customer','opportunity') AND c.assigned_coach IS NULL THEN 2
    ELSE 3
  END AS priority_number,
  c.attributed_ad_id, c.attribution_source
FROM contacts c
LEFT JOIN latest_calls lc ON c.phone = lc.caller_number
LEFT JOIN call_counts cc ON c.phone = cc.caller_number
LEFT JOIN latest_deals ld ON c.id = ld.contact_id
WHERE c.status != 'MERGED_DUPLICATE'
  AND c.lifecycle_stage IN ('lead','marketingqualifiedlead','salesqualifiedlead','opportunity','customer')
ORDER BY priority_number ASC, days_since_last_contact DESC NULLS LAST;
