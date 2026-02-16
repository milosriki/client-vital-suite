-- ATTRIBUTION CHAIN: FormSubmit (has ad_id) → Lead (same external_id, has HubSpot ID) → contacts
-- This is the discovered bridge: FormSubmit and Lead share external_id in AnyTrack events.
-- Lead event_id format: "c-{hubspot_contact_id}-Contact_lifecyclestage_lead"

-- Step 1: Create a materialized mapping table for the attribution chain
CREATE TABLE IF NOT EXISTS attribution_chain (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  hubspot_contact_id text NOT NULL,
  external_id text NOT NULL,
  form_event_id text,
  lead_event_id text,
  fb_ad_id text,
  fb_adset_id text,
  fb_campaign_id text,
  fb_campaign_name text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  landing_page text,
  tracking_group text,
  attribution_source text DEFAULT 'formsubmit_lead_chain',
  form_time timestamptz,
  lead_time timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(hubspot_contact_id, form_event_id)
);

-- Step 2: Populate from the FormSubmit → Lead join
INSERT INTO attribution_chain (
  hubspot_contact_id, external_id, form_event_id, lead_event_id,
  fb_ad_id, fb_adset_id, fb_campaign_id, fb_campaign_name,
  utm_source, utm_medium, utm_campaign, utm_content,
  landing_page, tracking_group, form_time, lead_time
)
SELECT
  -- Extract HubSpot contact ID from Lead event_id: "c-186431160909-Contact_lifecyclestage_lead"
  split_part(l.event_id, '-', 2) AS hubspot_contact_id,
  f.user_data->>'external_id' AS external_id,
  f.event_id AS form_event_id,
  l.event_id AS lead_event_id,
  -- Ad params from FormSubmit attributions
  COALESCE(
    f.meta->'attributions'->0->'params'->>'ad_id',
    f.meta->'attributions'->0->>'creative'
  ) AS fb_ad_id,
  f.meta->'attributions'->0->'params'->>'adset_id' AS fb_adset_id,
  COALESCE(
    f.meta->'attributions'->0->'params'->>'utm_id',
    f.meta->'attributions'->0->'params'->>'hsa_cam',
    f.meta->'attributions'->0->>'campaign'
  ) AS fb_campaign_id,
  f.meta->'attributions'->0->>'content' AS fb_campaign_name,
  -- UTM from attributions
  f.meta->'attributions'->0->>'source' AS utm_source,
  f.meta->'attributions'->0->>'medium' AS utm_medium,
  f.meta->'attributions'->0->>'campaign' AS utm_campaign,
  f.meta->'attributions'->0->>'content' AS utm_content,
  -- Landing page
  f.meta->>'location' AS landing_page,
  f.meta->>'tracking_group' AS tracking_group,
  f.event_time AS form_time,
  l.event_time AS lead_time
FROM events f
JOIN (
  -- Deduplicate: one Lead per external_id (latest)
  SELECT DISTINCT ON (user_data->>'external_id')
    event_id, user_data, event_time
  FROM events
  WHERE event_name IN ('Lead', 'CrmLeadCrmLead')
    AND source = 'anytrack'
    AND event_id LIKE 'c-%'
  ORDER BY user_data->>'external_id', event_time DESC
) l ON (f.user_data->>'external_id' = l.user_data->>'external_id')
WHERE f.event_name = 'FormSubmit'
  AND f.source = 'anytrack'
ON CONFLICT (hubspot_contact_id, form_event_id) DO UPDATE SET
  fb_ad_id = EXCLUDED.fb_ad_id,
  fb_adset_id = EXCLUDED.fb_adset_id,
  fb_campaign_id = EXCLUDED.fb_campaign_id;

-- Also populate from Schedule events (Calendly bookings) → Lead chain
INSERT INTO attribution_chain (
  hubspot_contact_id, external_id, form_event_id, lead_event_id,
  fb_ad_id, fb_adset_id, fb_campaign_id, fb_campaign_name,
  utm_source, utm_medium, utm_campaign, utm_content,
  landing_page, tracking_group, form_time, lead_time
)
SELECT
  split_part(l.event_id, '-', 2) AS hubspot_contact_id,
  s.user_data->>'external_id' AS external_id,
  s.event_id AS form_event_id,
  l.event_id AS lead_event_id,
  COALESCE(
    s.meta->'attributions'->0->'params'->>'ad_id',
    s.meta->'attributions'->0->>'creative'
  ) AS fb_ad_id,
  s.meta->'attributions'->0->'params'->>'adset_id' AS fb_adset_id,
  COALESCE(
    s.meta->'attributions'->0->'params'->>'utm_id',
    s.meta->'attributions'->0->'params'->>'hsa_cam'
  ) AS fb_campaign_id,
  s.meta->'attributions'->0->>'content' AS fb_campaign_name,
  s.meta->'attributions'->0->>'source' AS utm_source,
  s.meta->'attributions'->0->>'medium' AS utm_medium,
  s.meta->'attributions'->0->>'campaign' AS utm_campaign,
  s.meta->'attributions'->0->>'content' AS utm_content,
  s.meta->>'location' AS landing_page,
  s.meta->>'tracking_group' AS tracking_group,
  s.event_time AS form_time,
  l.event_time AS lead_time
FROM events s
JOIN (
  SELECT DISTINCT ON (user_data->>'external_id')
    event_id, user_data, event_time
  FROM events
  WHERE event_name IN ('Lead', 'CrmLeadCrmLead')
    AND source = 'anytrack'
    AND event_id LIKE 'c-%'
  ORDER BY user_data->>'external_id', event_time DESC
) l ON (s.user_data->>'external_id' = l.user_data->>'external_id')
WHERE s.event_name = 'Schedule'
  AND s.source = 'anytrack'
ON CONFLICT (hubspot_contact_id, form_event_id) DO NOTHING;

-- Step 3: Update contacts with attribution from the chain
UPDATE contacts c
SET
  attributed_ad_id = ac.fb_ad_id,
  attributed_campaign_id = ac.fb_campaign_id,
  attributed_adset_id = ac.fb_adset_id,
  attribution_source = 'formsubmit_lead_chain'
FROM (
  SELECT DISTINCT ON (hubspot_contact_id)
    hubspot_contact_id, fb_ad_id, fb_campaign_id, fb_adset_id
  FROM attribution_chain
  WHERE fb_ad_id IS NOT NULL
  ORDER BY hubspot_contact_id, form_time DESC
) ac
WHERE c.hubspot_contact_id = ac.hubspot_contact_id
  AND c.attributed_ad_id IS NULL;

-- Step 4: Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_attribution_chain_hs_id ON attribution_chain(hubspot_contact_id);
CREATE INDEX IF NOT EXISTS idx_attribution_chain_ext_id ON attribution_chain(external_id);

-- Step 5: Create a comprehensive attribution view joining everything
CREATE OR REPLACE VIEW view_full_attribution AS
SELECT
  c.hubspot_contact_id,
  c.email,
  c.first_name,
  c.last_name,
  c.phone,
  c.lifecycle_stage,
  c.owner_name AS setter_name,
  c.assigned_coach AS coach_name,
  -- Attribution (best available)
  COALESCE(c.attributed_ad_id, ac.fb_ad_id) AS ad_id,
  COALESCE(c.attributed_campaign_id, ac.fb_campaign_id) AS campaign_id,
  COALESCE(c.attributed_adset_id, ac.fb_adset_id) AS adset_id,
  COALESCE(c.attribution_source, ac.attribution_source, 'none') AS attribution_method,
  c.utm_source,
  c.utm_medium,
  c.utm_campaign,
  c.facebook_id AS anytrack_client_id,
  c.google_id AS anytrack_server_id,
  -- Revenue
  c.total_deal_value,
  c.closed_deal_value,
  c.num_associated_deals,
  -- Timing
  c.created_at AS contact_created,
  c.first_conversion_date,
  ac.form_time AS form_submitted_at,
  ac.lead_time AS became_lead_at,
  ac.tracking_group AS form_source,
  ac.landing_page
FROM contacts c
LEFT JOIN (
  SELECT DISTINCT ON (hubspot_contact_id)
    hubspot_contact_id, fb_ad_id, fb_campaign_id, fb_adset_id,
    attribution_source, form_time, lead_time, tracking_group, landing_page
  FROM attribution_chain
  ORDER BY hubspot_contact_id, form_time DESC
) ac ON c.hubspot_contact_id = ac.hubspot_contact_id;
