-- View: Lost deals in last 90 days for follow-up
-- Joins to contacts where possible, extracts phone from deal_name as fallback
CREATE OR REPLACE VIEW view_lost_deal_followups AS
SELECT
  d.id AS deal_id, d.deal_name, d.amount, d.close_date,
  d.created_at AS deal_created_at, d.contact_id,
  EXTRACT(DAY FROM NOW() - d.close_date)::int AS days_since_lost,
  c.first_name AS contact_first_name, c.last_name AS contact_last_name,
  c.email AS contact_email,
  COALESCE(c.phone, (regexp_match(d.deal_name, E'PHONE(\\+\\d[\\d ]+)'))[1]) AS contact_phone,
  c.lifecycle_stage,
  CASE
    WHEN d.contact_id IS NOT NULL AND EXTRACT(DAY FROM NOW() - d.close_date) <= 14 THEN 'HOT'
    WHEN d.contact_id IS NOT NULL AND EXTRACT(DAY FROM NOW() - d.close_date) <= 30 THEN 'WARM'
    WHEN d.contact_id IS NOT NULL THEN 'COOL'
    ELSE 'NO_CONTACT'
  END AS followup_priority
FROM deals d LEFT JOIN contacts c ON d.contact_id = c.id
WHERE d.stage = 'closedlost' AND d.close_date >= NOW() - INTERVAL '90 days'
ORDER BY d.close_date DESC;

GRANT SELECT ON view_lost_deal_followups TO authenticated, anon;
