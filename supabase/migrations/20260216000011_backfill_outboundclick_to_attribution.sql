-- First: Update check constraint to allow OutboundClick and PageView event types
ALTER TABLE attribution_events DROP CONSTRAINT IF EXISTS attribution_events_event_name_check;
ALTER TABLE attribution_events ADD CONSTRAINT attribution_events_event_name_check
  CHECK (event_name IN ('Purchase', 'Lead', 'CompleteRegistration', 'FormSubmit', 'OutboundClick', 'PageView', 'AddToCart', 'InitiateCheckout', 'ViewContent', 'Search', 'Subscribe'));

-- Backfill: Extract OutboundClick events from events table into attribution_events
-- These have ad_id in meta->attributions[0]->params->ad_id

INSERT INTO attribution_events (
  event_id, event_name, event_time, email, phone, first_name, last_name,
  value, currency, source, medium, campaign,
  utm_source, utm_medium, utm_campaign, utm_content,
  landing_page, platform,
  fb_ad_id, fb_campaign_id, fb_adset_id, fb_campaign_name
)
SELECT
  e.event_id,
  e.event_name,
  e.event_time,
  e.user_data->>'em' AS email,
  e.user_data->>'ph' AS phone,
  e.user_data->>'fn' AS first_name,
  e.user_data->>'ln' AS last_name,
  COALESCE((e.custom->>'value')::numeric, 0) AS value,
  COALESCE(e.custom->>'currency', 'AED') AS currency,
  COALESCE(e.meta->'attributions'->0->>'source', e.custom->>'source_attribution', 'anytrack') AS source,
  COALESCE(e.meta->'attributions'->0->>'medium', e.custom->>'medium') AS medium,
  e.meta->'attributions'->0->>'campaign' AS campaign,
  e.meta->'attributions'->0->>'source' AS utm_source,
  e.meta->'attributions'->0->>'medium' AS utm_medium,
  e.meta->'attributions'->0->>'campaign' AS utm_campaign,
  e.meta->'attributions'->0->>'content' AS utm_content,
  COALESCE(e.meta->>'location', e.meta->'attributions'->0->>'page') AS landing_page,
  'anytrack' AS platform,
  COALESCE(
    e.meta->'attributions'->0->'params'->>'ad_id',
    e.meta->'attributions'->0->>'creative'
  ) AS fb_ad_id,
  COALESCE(
    e.meta->'attributions'->0->'params'->>'utm_id',
    e.meta->'attributions'->0->'params'->>'hsa_cam',
    e.meta->'attributions'->0->>'campaign'
  ) AS fb_campaign_id,
  e.meta->'attributions'->0->'params'->>'adset_id' AS fb_adset_id,
  e.meta->'attributions'->0->>'content' AS fb_campaign_name
FROM events e
WHERE e.event_name = 'OutboundClick'
  AND e.source = 'anytrack'
  AND jsonb_array_length(COALESCE(e.meta->'attributions', '[]'::jsonb)) > 0
ON CONFLICT (event_id) DO UPDATE SET
  fb_ad_id = EXCLUDED.fb_ad_id,
  fb_campaign_id = EXCLUDED.fb_campaign_id,
  fb_adset_id = EXCLUDED.fb_adset_id,
  fb_campaign_name = EXCLUDED.fb_campaign_name;

-- Now re-run the Lead linkage with the newly populated OutboundClick attribution
-- Match by fbclid in the events table (OutboundClick and Lead share fbclid when same user)
-- Also try matching by external_id / client_id
UPDATE attribution_events ae_lead
SET
  fb_ad_id = ae_click.fb_ad_id,
  fb_adset_id = ae_click.fb_adset_id,
  fb_campaign_id = ae_click.fb_campaign_id,
  fb_campaign_name = ae_click.fb_campaign_name
FROM attribution_events ae_click
WHERE ae_lead.event_name IN ('Lead', 'CompleteRegistration')
  AND ae_lead.fb_ad_id IS NULL
  AND ae_click.event_name = 'OutboundClick'
  AND ae_click.fb_ad_id IS NOT NULL
  -- Match by landing page domain or close event_time (within 30 min)
  AND ae_lead.landing_page IS NOT NULL
  AND ae_click.landing_page IS NOT NULL
  AND ae_lead.event_time::timestamp - ae_click.event_time::timestamp BETWEEN INTERVAL '0 seconds' AND INTERVAL '30 minutes';
