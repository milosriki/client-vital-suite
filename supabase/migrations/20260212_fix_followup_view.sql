-- Adjust Follow-up Queue for High-Speed Re-engagement
-- Rule: If score > 60, re-engage after 4 hours of silence. 
-- Otherwise, stick to the 24-hour default to avoid being spammy.

CREATE OR REPLACE VIEW v_followup_queue AS
SELECT
  ci.phone,
  ci.lead_score,
  ci.dominant_pain,
  ci.followup_stage,
  ci.followup_count,
  ci.last_lead_message_at,
  EXTRACT(EPOCH FROM (NOW() - ci.last_lead_message_at)) / 3600
    AS hours_inactive
FROM conversation_intelligence ci
WHERE (
        (ci.lead_score > 60 AND ci.last_lead_message_at < NOW() - INTERVAL '4 hours')
        OR 
        (ci.last_lead_message_at < NOW() - INTERVAL '24 hours')
      )
  AND ci.followup_stage != 'exhausted'
  AND ci.conversation_phase NOT IN ('booked', 'lost')
ORDER BY ci.last_lead_message_at ASC;
