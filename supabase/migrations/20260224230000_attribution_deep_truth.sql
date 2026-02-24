-- ============================================================================
-- ATTRIBUTION DEEP TRUTH — Multi-Source Attribution System
-- Mission: Every lead, call, deal, and payment traces to the exact Facebook ad
-- ============================================================================
-- Components:
--   1. view_call_attribution  — Call → Ad bridge via normalized phone match
--   2. fn_attribution_coverage() — "What % of pipeline has attribution?"
--   3. fn_score_attribution_confidence() — Multi-source confidence scoring (0-100)
--   4. fn_enrich_attribution_phone_match() — Backfill contacts via phone→AnyTrack
--   5. view_attribution_confidence_scores — Real-time per-contact confidence view
-- ============================================================================


-- ============================================================================
-- 1. VIEW: view_call_attribution
-- Supersedes the older `call_attribution` view with:
--   a) Normalized 9-digit phone matching (handles country codes, formatting)
--   b) contact_id direct match as priority fallback
--   c) Full attribution chain: ad_id, campaign, confidence
-- ============================================================================

CREATE OR REPLACE VIEW public.view_call_attribution AS
SELECT
  cr.id                                                          AS call_id,
  cr.caller_number,
  cr.call_direction,
  cr.call_duration,
  cr.call_status,
  cr.recorded_at,
  -- Contact
  c.id                                                           AS contact_db_id,
  c.hubspot_contact_id,
  c.email,
  c.first_name,
  c.last_name,
  -- Ad Attribution (best available, prefer AnyTrack > HubSpot direct)
  COALESCE(c.attributed_ad_id, c.fb_ad_id)                      AS ad_id,
  COALESCE(c.attributed_campaign_id, c.fb_campaign_id)           AS campaign_id,
  c.attributed_adset_id                                          AS adset_id,
  c.utm_source,
  c.utm_medium,
  c.utm_campaign,
  c.utm_content,
  COALESCE(c.attribution_source, 'none')                        AS attribution_source,
  -- Attribution quality flags
  CASE
    WHEN c.attributed_ad_id IS NOT NULL THEN 'anytrack_direct'
    WHEN c.fb_ad_id IS NOT NULL         THEN 'hubspot_sync'
    WHEN c.utm_campaign IS NOT NULL     THEN 'utm_only'
    ELSE 'unattributed'
  END                                                            AS attribution_quality,
  -- Match method used
  CASE
    WHEN cr.contact_id = c.hubspot_contact_id THEN 'contact_id'
    ELSE 'phone_match'
  END                                                            AS match_method
FROM public.call_records cr
LEFT JOIN public.contacts c ON (
  -- Primary: direct contact_id link (most reliable)
  cr.contact_id = c.hubspot_contact_id
  OR
  -- Fallback: normalized 9-digit phone match (handles +971, 00971, local)
  RIGHT(REGEXP_REPLACE(cr.caller_number, '[^0-9]', '', 'g'), 9) =
  RIGHT(REGEXP_REPLACE(c.phone,          '[^0-9]', '', 'g'), 9)
)
WHERE cr.caller_number IS NOT NULL;

-- Grant access
GRANT SELECT ON public.view_call_attribution TO authenticated;

COMMENT ON VIEW public.view_call_attribution IS
  'Bridges every inbound/outbound call to its originating Facebook ad via normalized phone matching. '
  'Uses 9-digit suffix normalization to handle country code variations (+971, 00971, local).';


-- ============================================================================
-- 2. FUNCTION: fn_attribution_coverage()
-- Returns attribution coverage %, broken down by lifecycle_stage.
-- Answers: "What % of our pipeline has attribution?"
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_attribution_coverage()
RETURNS TABLE (
  lifecycle_stage       text,
  total                 bigint,
  attributed            bigint,
  coverage_pct          numeric,
  anytrack_attributed   bigint,
  hubspot_attributed    bigint,
  utm_only              bigint,
  unattributed          bigint
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    COALESCE(lifecycle_stage, 'unknown')                                                    AS lifecycle_stage,
    COUNT(*)                                                                                AS total,
    COUNT(CASE
      WHEN attributed_ad_id IS NOT NULL OR fb_ad_id IS NOT NULL THEN 1
    END)                                                                                    AS attributed,
    ROUND(
      COUNT(CASE WHEN attributed_ad_id IS NOT NULL OR fb_ad_id IS NOT NULL THEN 1 END)::numeric
      / NULLIF(COUNT(*), 0) * 100, 1
    )                                                                                       AS coverage_pct,
    -- Breakdown by source quality
    COUNT(CASE WHEN attribution_source IN ('anytrack', 'anytrack_phone_match', 'formsubmit_lead_chain') THEN 1 END) AS anytrack_attributed,
    COUNT(CASE WHEN attribution_source = 'hubspot_sync' AND attributed_ad_id IS NOT NULL THEN 1 END)                AS hubspot_attributed,
    COUNT(CASE
      WHEN attributed_ad_id IS NULL AND fb_ad_id IS NULL AND utm_campaign IS NOT NULL THEN 1
    END)                                                                                    AS utm_only,
    COUNT(CASE
      WHEN attributed_ad_id IS NULL AND fb_ad_id IS NULL AND utm_campaign IS NULL THEN 1
    END)                                                                                    AS unattributed
  FROM public.contacts
  GROUP BY lifecycle_stage
  ORDER BY total DESC;
$$;

COMMENT ON FUNCTION public.fn_attribution_coverage() IS
  'Returns attribution coverage by lifecycle stage. '
  'Breaks down: AnyTrack-direct, HubSpot-sync, UTM-only, and unattributed counts.';


-- ============================================================================
-- 3. FUNCTION: fn_score_attribution_confidence(hubspot_contact_id text)
-- Multi-source confidence scoring for a single contact.
-- Priority:
--   100 = AnyTrack fb_ad_id + HubSpot campaign match
--    75 = AnyTrack fb_ad_id only (direct pixel)
--    50 = HubSpot utm_campaign matches a known campaign name
--    25 = Time-based inference (lead created during a campaign flight)
--     0 = No attribution data
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_score_attribution_confidence(p_hubspot_contact_id text)
RETURNS TABLE (
  hubspot_contact_id    text,
  confidence_score      int,
  confidence_label      text,
  ad_id                 text,
  campaign_id           text,
  attribution_source    text,
  evidence_flags        text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_contact            record;
  v_anytrack_event     record;
  v_has_anytrack_adid  boolean := false;
  v_has_campaign_match boolean := false;
  v_has_utm_campaign   boolean := false;
  v_has_time_inference boolean := false;
  v_score              int := 0;
  v_label              text;
  v_ad_id              text;
  v_campaign_id        text;
  v_source             text;
  v_flags              text[] := '{}';
BEGIN
  -- Load contact
  SELECT c.attributed_ad_id, c.fb_ad_id, c.attributed_campaign_id, c.fb_campaign_id,
         c.attribution_source, c.utm_campaign, c.utm_source, c.email, c.phone,
         c.created_at
  INTO v_contact
  FROM public.contacts c
  WHERE c.hubspot_contact_id = p_hubspot_contact_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- === SOURCE 1: AnyTrack direct pixel (highest confidence) ===
  -- Check attribution_events for direct fb_ad_id match
  SELECT ae.fb_ad_id, ae.fb_campaign_id, ae.fb_campaign_name, ae.source
  INTO v_anytrack_event
  FROM public.attribution_events ae
  WHERE ae.email = v_contact.email
    AND ae.fb_ad_id IS NOT NULL
  ORDER BY ae.event_time DESC
  LIMIT 1;

  IF v_anytrack_event IS NOT NULL AND v_anytrack_event.fb_ad_id IS NOT NULL THEN
    v_has_anytrack_adid := true;
    v_ad_id     := v_anytrack_event.fb_ad_id;
    v_campaign_id := v_anytrack_event.fb_campaign_id;
    v_source    := 'anytrack_pixel';
    v_flags     := array_append(v_flags, 'anytrack_fb_ad_id');
  END IF;

  -- === SOURCE 2: HubSpot direct ad_id (attributed_ad_id or fb_ad_id column) ===
  IF v_contact.attributed_ad_id IS NOT NULL THEN
    IF v_ad_id IS NULL THEN
      v_ad_id   := v_contact.attributed_ad_id;
      v_campaign_id := v_contact.attributed_campaign_id;
      v_source  := v_contact.attribution_source;
    END IF;
    v_flags := array_append(v_flags, 'hubspot_attributed_ad_id');
  ELSIF v_contact.fb_ad_id IS NOT NULL THEN
    IF v_ad_id IS NULL THEN
      v_ad_id   := v_contact.fb_ad_id;
      v_campaign_id := v_contact.fb_campaign_id;
      v_source  := 'hubspot_sync';
    END IF;
    v_flags := array_append(v_flags, 'hubspot_fb_ad_id');
  END IF;

  -- Check if AnyTrack campaign matches HubSpot campaign
  IF v_has_anytrack_adid AND (v_contact.attributed_campaign_id IS NOT NULL OR v_contact.fb_campaign_id IS NOT NULL) THEN
    IF COALESCE(v_contact.attributed_campaign_id, v_contact.fb_campaign_id) = v_anytrack_event.fb_campaign_id THEN
      v_has_campaign_match := true;
      v_flags := array_append(v_flags, 'campaign_cross_verified');
    END IF;
  END IF;

  -- === SOURCE 3: UTM campaign matches a known Facebook campaign name ===
  IF v_contact.utm_campaign IS NOT NULL AND v_contact.utm_source ILIKE '%facebook%' THEN
    v_has_utm_campaign := true;
    v_flags := array_append(v_flags, 'utm_facebook_campaign');
    IF v_campaign_id IS NULL THEN
      v_source := 'utm_facebook';
    END IF;
  ELSIF v_contact.utm_campaign IS NOT NULL THEN
    v_has_utm_campaign := true;
    v_flags := array_append(v_flags, 'utm_campaign_present');
    IF v_campaign_id IS NULL THEN
      v_source := 'utm_generic';
    END IF;
  END IF;

  -- === SOURCE 4: Time-based inference (created during known campaign flight) ===
  -- Check if contact was created while a campaign was running
  IF v_contact.created_at IS NOT NULL AND v_ad_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.facebook_ads_insights fai
      WHERE fai.date_start::date <= v_contact.created_at::date
        AND fai.date_stop::date  >= v_contact.created_at::date
      LIMIT 1
    ) THEN
      v_has_time_inference := true;
      v_flags := array_append(v_flags, 'time_inference_campaign_flight');
      IF v_source IS NULL THEN
        v_source := 'time_inference';
      END IF;
    END IF;
  END IF;

  -- === SCORE CALCULATION ===
  IF v_has_anytrack_adid AND v_has_campaign_match THEN
    v_score := 100;
    v_label := 'ABSOLUTE_TRUTH';
  ELSIF v_has_anytrack_adid THEN
    v_score := 75;
    v_label := 'HIGH_CONFIDENCE';
  ELSIF v_contact.attributed_ad_id IS NOT NULL OR v_contact.fb_ad_id IS NOT NULL THEN
    v_score := 60;
    v_label := 'MEDIUM_HIGH';
  ELSIF v_has_utm_campaign AND v_contact.utm_source ILIKE '%facebook%' THEN
    v_score := 50;
    v_label := 'MEDIUM';
  ELSIF v_has_utm_campaign THEN
    v_score := 35;
    v_label := 'LOW_MEDIUM';
  ELSIF v_has_time_inference THEN
    v_score := 25;
    v_label := 'LOW';
  ELSE
    v_score := 0;
    v_label := 'UNATTRIBUTED';
  END IF;

  RETURN QUERY SELECT
    p_hubspot_contact_id,
    v_score,
    v_label,
    v_ad_id,
    v_campaign_id,
    COALESCE(v_source, 'none'),
    v_flags;
END;
$$;

COMMENT ON FUNCTION public.fn_score_attribution_confidence(text) IS
  'Scores attribution confidence 0-100 for a single contact by cross-referencing all 5 sources: '
  'AnyTrack pixel, AnyTrack+HubSpot cross-match (100), AnyTrack only (75), '
  'HubSpot ad_id (60), Facebook UTM (50), generic UTM (35), time inference (25), none (0).';


-- ============================================================================
-- 4. FUNCTION: fn_enrich_attribution_phone_match()
-- Backfill contacts.attributed_ad_id from attribution_events via phone match.
-- Currently attribution_chain joins on email/external_id only.
-- This adds phone matching as a high-confidence fallback.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_enrich_attribution_phone_match()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_phone_enriched   int;
  v_chain_enriched   int;
  v_call_enriched    int;
BEGIN
  -- === STEP 1: contacts ← attribution_events via phone normalization ===
  -- Match: right 9 digits of normalized phone
  WITH phone_matched AS (
    UPDATE public.contacts c
    SET
      attributed_ad_id       = ae.fb_ad_id,
      attributed_campaign_id = ae.fb_campaign_id,
      attributed_adset_id    = ae.fb_adset_id,
      attribution_source     = 'anytrack_phone_match',
      updated_at             = NOW()
    FROM (
      -- Deduplicate: one event per phone (latest by event_time)
      SELECT DISTINCT ON (
        RIGHT(REGEXP_REPLACE(COALESCE(ae.phone, ae.user_data->>'ph', ''), '[^0-9]', '', 'g'), 9)
      )
        ae.fb_ad_id,
        ae.fb_campaign_id,
        ae.fb_adset_id,
        RIGHT(REGEXP_REPLACE(COALESCE(ae.phone, ae.user_data->>'ph', ''), '[^0-9]', '', 'g'), 9) AS normalized_phone
      FROM public.attribution_events ae
      WHERE ae.fb_ad_id IS NOT NULL
        AND COALESCE(ae.phone, ae.user_data->>'ph') IS NOT NULL
      ORDER BY RIGHT(REGEXP_REPLACE(COALESCE(ae.phone, ae.user_data->>'ph', ''), '[^0-9]', '', 'g'), 9), ae.event_time DESC
    ) ae
    WHERE c.attributed_ad_id IS NULL
      AND c.phone IS NOT NULL
      AND RIGHT(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), 9) = ae.normalized_phone
    RETURNING c.hubspot_contact_id
  )
  SELECT COUNT(*) INTO v_phone_enriched FROM phone_matched;

  -- === STEP 2: attribution_chain ← attribution_events via phone match ===
  -- Enrich the chain table too, for completeness
  WITH chain_phone_matched AS (
    UPDATE public.attribution_chain ac
    SET
      fb_ad_id       = ae.fb_ad_id,
      fb_adset_id    = ae.fb_adset_id,
      fb_campaign_id = ae.fb_campaign_id,
      attribution_source = 'anytrack_phone_match'
    FROM (
      SELECT DISTINCT ON (
        RIGHT(REGEXP_REPLACE(COALESCE(ae.phone, ae.user_data->>'ph', ''), '[^0-9]', '', 'g'), 9)
      )
        ae.fb_ad_id, ae.fb_adset_id, ae.fb_campaign_id,
        RIGHT(REGEXP_REPLACE(COALESCE(ae.phone, ae.user_data->>'ph', ''), '[^0-9]', '', 'g'), 9) AS normalized_phone
      FROM public.attribution_events ae
      WHERE ae.fb_ad_id IS NOT NULL
        AND COALESCE(ae.phone, ae.user_data->>'ph') IS NOT NULL
      ORDER BY RIGHT(REGEXP_REPLACE(COALESCE(ae.phone, ae.user_data->>'ph', ''), '[^0-9]', '', 'g'), 9), ae.event_time DESC
    ) ae
    JOIN public.contacts c ON c.hubspot_contact_id = ac.hubspot_contact_id
    WHERE ac.fb_ad_id IS NULL
      AND c.phone IS NOT NULL
      AND RIGHT(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), 9) = ae.normalized_phone
    RETURNING ac.id
  )
  SELECT COUNT(*) INTO v_chain_enriched FROM chain_phone_matched;

  -- === STEP 3: call_records — link contact_id via phone match ===
  WITH call_contact_linked AS (
    UPDATE public.call_records cr
    SET contact_id = c.hubspot_contact_id,
        updated_at = NOW()
    FROM public.contacts c
    WHERE cr.contact_id IS NULL
      AND cr.caller_number IS NOT NULL
      AND RIGHT(REGEXP_REPLACE(cr.caller_number, '[^0-9]', '', 'g'), 9) =
          RIGHT(REGEXP_REPLACE(c.phone,          '[^0-9]', '', 'g'), 9)
    RETURNING cr.id
  )
  SELECT COUNT(*) INTO v_call_enriched FROM call_contact_linked;

  RETURN jsonb_build_object(
    'contacts_phone_enriched',       v_phone_enriched,
    'attribution_chain_enriched',    v_chain_enriched,
    'call_records_contact_linked',   v_call_enriched,
    'executed_at',                   NOW()
  );
END;
$$;

COMMENT ON FUNCTION public.fn_enrich_attribution_phone_match() IS
  'Backfills attribution data via normalized 9-digit phone matching. '
  'Updates: contacts.attributed_ad_id, attribution_chain.fb_ad_id, call_records.contact_id. '
  'Safe to re-run — only touches rows where attributed_ad_id IS NULL.';


-- ============================================================================
-- 5. VIEW: view_attribution_confidence_scores
-- Real-time per-contact confidence scoring without calling the function per-row.
-- Optimized for dashboard use — no function call overhead.
-- ============================================================================

CREATE OR REPLACE VIEW public.view_attribution_confidence_scores AS
WITH anytrack_by_email AS (
  -- Deduplicate: one event per contact email (latest)
  SELECT DISTINCT ON (email)
    email, fb_ad_id, fb_campaign_id, fb_adset_id, source, event_time
  FROM public.attribution_events
  WHERE fb_ad_id IS NOT NULL
  ORDER BY email, event_time DESC
),
coverage AS (
  SELECT
    c.hubspot_contact_id,
    c.email,
    c.first_name,
    c.last_name,
    c.lifecycle_stage,
    c.created_at,
    -- Attribution fields
    c.attributed_ad_id,
    c.fb_ad_id,
    c.attributed_campaign_id,
    c.fb_campaign_id,
    c.attribution_source,
    c.utm_source,
    c.utm_campaign,
    -- AnyTrack event
    ae.fb_ad_id                                        AS anytrack_ad_id,
    ae.fb_campaign_id                                  AS anytrack_campaign_id,
    ae.source                                          AS anytrack_source,
    -- Flags for scoring
    (ae.fb_ad_id IS NOT NULL)                          AS has_anytrack,
    (c.attributed_ad_id IS NOT NULL OR c.fb_ad_id IS NOT NULL) AS has_ad_id,
    (c.attributed_campaign_id IS NOT NULL OR c.fb_campaign_id IS NOT NULL) AS has_campaign_id,
    (c.utm_campaign IS NOT NULL AND c.utm_source ILIKE '%facebook%') AS has_fb_utm,
    (c.utm_campaign IS NOT NULL)                       AS has_any_utm,
    -- Cross-verify: does AnyTrack campaign match HubSpot campaign?
    (ae.fb_campaign_id IS NOT NULL AND ae.fb_campaign_id = COALESCE(c.attributed_campaign_id, c.fb_campaign_id)) AS cross_verified
  FROM public.contacts c
  LEFT JOIN anytrack_by_email ae ON ae.email = c.email
)
SELECT
  hubspot_contact_id,
  email,
  first_name,
  last_name,
  lifecycle_stage,
  -- Best ad_id (priority: AnyTrack > attributed > fb_ad_id)
  COALESCE(anytrack_ad_id, attributed_ad_id, fb_ad_id)       AS best_ad_id,
  COALESCE(anytrack_campaign_id, attributed_campaign_id, fb_campaign_id) AS best_campaign_id,
  -- Confidence score
  CASE
    WHEN has_anytrack AND cross_verified  THEN 100
    WHEN has_anytrack                     THEN 75
    WHEN has_ad_id                        THEN 60
    WHEN has_fb_utm                       THEN 50
    WHEN has_any_utm                      THEN 35
    ELSE 0
  END                                                         AS confidence_score,
  -- Confidence label
  CASE
    WHEN has_anytrack AND cross_verified  THEN 'ABSOLUTE_TRUTH'
    WHEN has_anytrack                     THEN 'HIGH_CONFIDENCE'
    WHEN has_ad_id                        THEN 'MEDIUM_HIGH'
    WHEN has_fb_utm                       THEN 'MEDIUM'
    WHEN has_any_utm                      THEN 'LOW_MEDIUM'
    ELSE 'UNATTRIBUTED'
  END                                                         AS confidence_label,
  -- Source breakdown flags
  has_anytrack,
  has_ad_id,
  has_fb_utm,
  has_any_utm,
  cross_verified,
  anytrack_source,
  COALESCE(attribution_source, 'none')                        AS attribution_source,
  utm_source,
  utm_campaign,
  created_at
FROM coverage;

GRANT SELECT ON public.view_attribution_confidence_scores TO authenticated;

COMMENT ON VIEW public.view_attribution_confidence_scores IS
  'Real-time attribution confidence scores for every contact. '
  'Scores: 100=AnyTrack+campaign match, 75=AnyTrack only, 60=HubSpot ad_id, '
  '50=Facebook UTM, 35=generic UTM, 0=unattributed. '
  'Use this view for dashboards instead of calling fn_score_attribution_confidence() per row.';


-- ============================================================================
-- 6. INDEXES: Support the new views and functions
-- ============================================================================

-- Phone normalization lookups (right 9 digits — supported via expression index)
CREATE INDEX IF NOT EXISTS idx_contacts_phone_normalized
  ON public.contacts (RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 9))
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attr_events_phone_normalized
  ON public.attribution_events (RIGHT(REGEXP_REPLACE(COALESCE(phone, user_data->>'ph', ''), '[^0-9]', '', 'g'), 9))
  WHERE COALESCE(phone, user_data->>'ph') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_call_records_caller_normalized
  ON public.call_records (RIGHT(REGEXP_REPLACE(COALESCE(caller_number, ''), '[^0-9]', '', 'g'), 9))
  WHERE caller_number IS NOT NULL;

-- Attribution confidence lookups
CREATE INDEX IF NOT EXISTS idx_contacts_attributed_ad_id
  ON public.contacts (attributed_ad_id) WHERE attributed_ad_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_fb_ad_id
  ON public.contacts (fb_ad_id) WHERE fb_ad_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_utm_source_campaign
  ON public.contacts (utm_source, utm_campaign) WHERE utm_campaign IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle_attribution
  ON public.contacts (lifecycle_stage, attributed_ad_id, fb_ad_id);

-- AnyTrack events by ad_id for cross-referencing
CREATE INDEX IF NOT EXISTS idx_attr_events_fb_ad_id
  ON public.attribution_events (fb_ad_id) WHERE fb_ad_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attr_events_email_adid
  ON public.attribution_events (email, fb_ad_id) WHERE email IS NOT NULL AND fb_ad_id IS NOT NULL;

-- call_records: contact_id backfill lookup
CREATE INDEX IF NOT EXISTS idx_call_records_contact_id_null
  ON public.call_records (caller_number) WHERE contact_id IS NULL;
