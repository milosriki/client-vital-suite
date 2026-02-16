-- Link attribution_events to contacts by email/phone match
CREATE OR REPLACE FUNCTION link_attribution_contacts()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  attr_linked int;
  stripe_linked int;
BEGIN
  -- Link attribution_events
  WITH updated AS (
    UPDATE attribution_events ae
    SET contact_id = c.id
    FROM contacts c
    WHERE ae.contact_id IS NULL
      AND ((ae.email IS NOT NULL AND ae.email = c.email)
        OR (ae.phone IS NOT NULL AND ae.phone = c.phone))
    RETURNING ae.id
  )
  SELECT COUNT(*) INTO attr_linked FROM updated;

  -- Link stripe_transactions
  WITH updated AS (
    UPDATE stripe_transactions st
    SET contact_id = c.id
    FROM contacts c
    WHERE st.contact_id IS NULL
      AND st.customer_email IS NOT NULL
      AND st.customer_email = c.email
    RETURNING st.id
  )
  SELECT COUNT(*) INTO stripe_linked FROM updated;

  RETURN jsonb_build_object(
    'attribution_events_linked', attr_linked,
    'stripe_transactions_linked', stripe_linked
  );
END;
$$;
