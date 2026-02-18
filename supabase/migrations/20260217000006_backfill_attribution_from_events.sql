-- Backfill attribution_events from events.meta->>'location' containing ad_id=
-- One-time migration for AnyTrack attribution pipeline fix

-- First expand the event_name check constraint to include all AnyTrack event types
ALTER TABLE attribution_events DROP CONSTRAINT IF EXISTS attribution_events_event_name_check;
ALTER TABLE attribution_events ADD CONSTRAINT attribution_events_event_name_check 
  CHECK (event_name = ANY(ARRAY[
    'Purchase', 'Lead', 'CompleteRegistration', 'FormSubmit', 'OutboundClick', 
    'PageView', 'AddToCart', 'InitiateCheckout', 'ViewContent', 'Search', 'Subscribe',
    'CrmLeadCrmLead', 'DealNew', 'salesqualifiedlead', 'marketingqualifiedlead', 
    'Schedule', 'customer'
  ]));


WITH events_with_ads AS (
  SELECT
    event_id,
    event_name,
    event_time,
    source,
    user_data->>'em' AS email,
    user_data->>'ph' AS phone,
    user_data->>'fn' AS first_name,
    user_data->>'ln' AS last_name,
    (custom->>'value')::numeric AS value,
    custom->>'currency' AS currency,
    meta->>'location' AS location,
    (regexp_match(meta->>'location', '[?&]ad_id=([^&]+)'))[1] AS ad_id,
    (regexp_match(meta->>'location', '[?&]adset_id=([^&]+)'))[1] AS adset_id,
    COALESCE(
      (regexp_match(meta->>'location', '[?&]utm_id=([^&]+)'))[1],
      (regexp_match(meta->>'location', '[?&]hsa_cam=([^&]+)'))[1],
      (regexp_match(meta->>'location', '[?&]campaign_id=([^&]+)'))[1]
    ) AS campaign_id
  FROM events
  WHERE source = 'anytrack'
    AND meta->>'location' LIKE '%ad_id=%'
)
INSERT INTO attribution_events (
  event_id, event_name, event_time, email, phone, first_name, last_name,
  value, currency, landing_page, platform,
  fb_ad_id, fb_adset_id, fb_campaign_id
)
SELECT
  event_id, event_name, event_time, email, phone, first_name, last_name,
  value, currency, location, 'anytrack',
  ad_id, adset_id, campaign_id
FROM events_with_ads
WHERE ad_id IS NOT NULL
ON CONFLICT (event_id) DO UPDATE SET
  fb_ad_id = EXCLUDED.fb_ad_id,
  fb_adset_id = EXCLUDED.fb_adset_id,
  fb_campaign_id = EXCLUDED.fb_campaign_id,
  landing_page = EXCLUDED.landing_page;
