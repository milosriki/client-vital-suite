-- Phase 5 Fix: view_lead_follow_up - Fix total_outgoing_calls always returning 0
-- STATUS: SKIPPED (no-op replacement)
-- REASON: Migration references columns that don't exist in the current remote schema:
--   - cr.called_number (call_records table may have different schema)
--   - c.hubspot_contact_id, c.city, c.owner_name, c.utm_source etc. (missing in contacts)
-- The view update has been deferred until schema is aligned.
-- Original file saved as .bak alongside this file.
-- TODO: Align call_records and contacts schemas before re-enabling.
SELECT 1; -- no-op
