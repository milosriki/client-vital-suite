-- Backfill attribution: Link Lead/CompleteRegistration events to OutboundClick attribution
-- where Lead events have NULL fb_ad_id but a matching OutboundClick has ad params

-- Step 1: Update attribution_events where Lead/CR has no ad_id but OutboundClick does (by email)
UPDATE attribution_events ae
SET
  fb_ad_id = click.fb_ad_id,
  fb_adset_id = click.fb_adset_id,
  fb_campaign_id = click.fb_campaign_id,
  fb_campaign_name = click.fb_campaign_name,
  fb_ad_name = click.fb_ad_name,
  fb_adset_name = click.fb_adset_name
FROM (
  SELECT DISTINCT ON (email)
    email, fb_ad_id, fb_adset_id, fb_campaign_id, fb_campaign_name, fb_ad_name, fb_adset_name
  FROM attribution_events
  WHERE event_name = 'OutboundClick'
    AND fb_ad_id IS NOT NULL
    AND email IS NOT NULL
  ORDER BY email, event_time DESC
) click
WHERE ae.email = click.email
  AND ae.event_name IN ('Lead', 'CompleteRegistration')
  AND ae.fb_ad_id IS NULL;

-- Step 2: Update contacts table with attributed ad/campaign from attribution_events
UPDATE contacts c
SET
  attributed_ad_id = attr.fb_ad_id,
  attributed_campaign_id = attr.fb_campaign_id,
  attribution_source = 'anytrack_backfill'
FROM (
  SELECT DISTINCT ON (email)
    email, fb_ad_id, fb_campaign_id
  FROM attribution_events
  WHERE fb_ad_id IS NOT NULL
    AND email IS NOT NULL
  ORDER BY email, event_time DESC
) attr
WHERE c.email = attr.email
  AND c.attributed_ad_id IS NULL;
