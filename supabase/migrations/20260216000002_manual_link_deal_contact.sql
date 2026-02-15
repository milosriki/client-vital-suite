-- Links a HubSpot deal to its contact via HubSpot IDs
-- Called by hubspot-webhook-receiver on deal.associationChange events
-- Parameters use HubSpot string IDs (not Supabase UUIDs)
CREATE OR REPLACE FUNCTION public.manual_link_deal_contact(
  p_deal_id TEXT,
  p_contact_id TEXT
) RETURNS void AS $$
BEGIN
  UPDATE deals
  SET contact_id = c.id,
      updated_at = NOW()
  FROM contacts c
  WHERE deals.hubspot_deal_id = p_deal_id
    AND c.hubspot_contact_id = p_contact_id
    AND (deals.contact_id IS NULL OR deals.contact_id != c.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
