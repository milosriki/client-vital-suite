/**
 * HUBSPOT FIELD MAPPING — Single Source of Truth
 *
 * This module consolidates and documents ALL HubSpot → Supabase field mappings
 * across the 5 sync functions. Previously each function had its own mapping;
 * this creates a shared truth that all functions can reference.
 *
 * ============================================================================
 * AUDIT: 5 HubSpot Sync Functions vs Field Coverage
 * ============================================================================
 *
 * | Field                  | sync-hubspot-leads | sync-hubspot-contacts | sync-hubspot-data | sync-hubspot-to-supabase | hubspot-webhook |
 * |------------------------|--------------------|-----------------------|-------------------|--------------------------|-----------------|
 * | email                  | ✅                 | ✅                    | ✅                | ✅                       | ✅              |
 * | phone                  | ✅                 | ✅                    | ✅                | ✅ (+ mobilephone)       | ✅              |
 * | first_name / last_name | ✅                 | ✅                    | ❌ (no firstname) | ✅                       | ✅              |
 * | lifecycle_stage        | ✅                 | ✅                    | ✅                | ✅                       | ✅              |
 * | hubspot_owner_id       | ✅                 | ✅                    | ✅                | ✅                       | ✅              |
 * | call_status            | ✅                 | ✅                    | ❌                | ✅                       | ❌              |
 * | raw_status             | ✅                 | ✅                    | ❌                | ✅                       | ❌              |
 * | company_name           | ✅ (company→name)  | ❌                    | ❌                | ✅                       | ❌              |
 * | utm_source             | ❌                 | ❌                    | ❌                | ✅                       | ❌              |
 * | utm_medium             | ❌                 | ❌                    | ❌                | ✅                       | ❌              |
 * | utm_campaign           | ❌                 | ❌                    | ❌                | ✅                       | ❌              |
 * | utm_content            | ❌                 | ❌                    | ❌                | ✅                       | ❌              |
 * | utm_term               | ❌                 | ❌                    | ❌                | ✅                       | ❌              |
 * | fb_ad_id               | ❌                 | ❌                    | ❌                | ✅ (facebook_ad_id)      | ❌              |
 * | fb_campaign_id         | ❌                 | ❌                    | ❌                | ✅ (facebook_campaign_id)| ❌              |
 * | attributed_ad_id       | ❌                 | ❌                    | ❌                | ✅                       | ✅ (enrichment) |
 * | attribution_source     | ❌                 | ❌                    | ❌                | ✅                       | ✅ (enrichment) |
 * | facebook_id (atclid)   | ❌                 | ❌                    | ❌                | ✅                       | ❌              |
 * | google_id (satid)      | ❌                 | ❌                    | ❌                | ✅                       | ❌              |
 * | lead_score             | ❌                 | ❌                    | ❌                | ✅                       | ❌              |
 * | assigned_coach         | ❌                 | ❌                    | ❌                | ✅                       | ❌              |
 * | owner_name             | ❌                 | ❌                    | ❌                | ✅ (from ownerMap)       | ❌              |
 * | num_associated_deals   | ❌                 | ❌                    | ❌                | ✅                       | ❌              |
 * | total_deal_value       | ❌                 | ❌                    | ❌                | ✅ (total_revenue)       | ❌              |
 * | email_opt_out          | ❌                 | ❌                    | ❌                | ✅                       | ❌              |
 * | onConflict key used    | hubspot_contact_id | hubspot_contact_id    | email             | hubspot_contact_id       | hubspot_deal_id |
 *
 * ============================================================================
 * KEY GAPS IDENTIFIED:
 * ============================================================================
 * 1. UTM fields only set by sync-hubspot-to-supabase — all other syncs LOSE attribution!
 * 2. fb_ad_id only set by sync-hubspot-to-supabase — 4 of 5 sync functions miss this
 * 3. sync-hubspot-data uses email as onConflict (not hubspot_contact_id) — inconsistent
 * 4. sync-hubspot-data does NOT fetch firstname/lastname from HubSpot properties
 * 5. company_name mapping differs: sync-hubspot-leads uses props.company directly;
 *    sync-hubspot-to-supabase uses props.company_name; they may map to same HubSpot field
 *
 * RECOMMENDATION: ALL syncs should use this shared mapping module.
 */

// ============================================================================
// HUBSPOT PROPERTY NAMES (what to request from HubSpot API)
// ============================================================================

/** Core identity properties — required by ALL sync operations */
export const HS_PROPS_IDENTITY = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "mobilephone",
  "hs_object_id",
  "hubspot_owner_id",
  "lifecyclestage",
  "hs_lead_status",
  "createdate",
  "lastmodifieddate",
] as const;

/** Attribution/traffic-source properties — CRITICAL for Facebook attribution */
export const HS_PROPS_ATTRIBUTION = [
  // Direct ad IDs (AnyTrack injects these via HubSpot integration)
  "facebook_ad_id",        // AnyTrack → HubSpot custom prop: exact ad ID
  "facebook_campaign_id",  // AnyTrack → HubSpot custom prop: campaign ID
  "ad_id",                 // Legacy fallback name some accounts use
  "campaign_id",           // Legacy fallback name
  // AnyTrack click IDs
  "atclid",                // AnyTrack client-side click ID (maps to facebook_id in contacts)
  "satid",                 // AnyTrack server-side click ID (maps to google_id in contacts)
  // UTM parameters (from landing page)
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  // HubSpot native analytics
  "hs_analytics_source",
  "hs_analytics_source_data_1",
  "hs_analytics_first_touch_converting_campaign",
  "hs_analytics_last_touch_converting_campaign",
  "hs_analytics_first_url",
  "hs_analytics_last_url",
  "hs_latest_source",
  "hs_latest_source_data_1",
  "hs_latest_source_data_2",
  "hs_google_click_id",
  "fbc",  // Facebook click cookie
  "fbp",  // Facebook browser ID cookie
] as const;

/** Lead management properties */
export const HS_PROPS_LEAD = [
  "call_status",        // PTD custom: agent-entered call outcome
  "company",
  "company_name",
  "assigned_coach",
  "fitness_goals",
  "custom_lifecycle_stage",
  "first_conversion_date",
  "num_associated_deals",
  "total_revenue",
  "num_form_submissions",
  "num_conversion_events",
  "recent_conversion_event_name",
  "recent_conversion_date",
  "hs_email_opt_out",
  "hs_email_domain",
  "notes_last_contacted",
  "hs_last_sales_activity_date",
] as const;

/** All properties for a full contact sync */
export const HS_PROPS_CONTACTS_FULL = [
  ...HS_PROPS_IDENTITY,
  ...HS_PROPS_ATTRIBUTION,
  ...HS_PROPS_LEAD,
] as const;

// ============================================================================
// SUPABASE COLUMN MAPPINGS (HubSpot prop → contacts table column)
// ============================================================================

export interface ContactUpsertRow {
  hubspot_contact_id:    string;
  email:                 string | null;
  first_name:            string | null;
  last_name:             string | null;
  phone:                 string | null;
  company_name:          string | null;
  lifecycle_stage:       string | null;
  hubspot_owner_id:      string | null;
  call_status:           string | null;
  raw_status:            string | null;
  // Attribution (the critical fields)
  fb_ad_id:              string | null;
  fb_campaign_id:        string | null;
  attributed_ad_id:      string | null;
  attributed_campaign_id: string | null;
  attributed_adset_id:   string | null;
  attribution_source:    string | null;
  facebook_id:           string | null;  // atclid — AnyTrack client click ID
  google_id:             string | null;  // satid  — AnyTrack server click ID
  // UTM
  utm_source:            string | null;
  utm_medium:            string | null;
  utm_campaign:          string | null;
  utm_content:           string | null;
  utm_term:              string | null;
  // Engagement
  num_associated_deals:  number | null;
  total_deal_value:      number | null;
  email_opt_out:         boolean | null;
  email_domain:          string | null;
  // Timestamps
  last_contacted_at:     string | null;
  updated_at:            string;
}

// ============================================================================
// MAPPING FUNCTION: HubSpot contact → contacts table row
// Use this in ALL 5 sync functions to guarantee consistent field mapping.
// ============================================================================

/**
 * Maps raw HubSpot contact properties to a Supabase contacts row.
 *
 * Priority for attribution fields (highest to lowest):
 *   1. facebook_ad_id (AnyTrack-injected via HubSpot integration)
 *   2. ad_id (legacy fallback)
 *   3. hs_analytics_source_data_1 (HubSpot native — may contain ad ID in some setups)
 *
 * @param contactId  HubSpot contact ID (hs_object_id)
 * @param props      Raw HubSpot contact properties object
 */
export function mapHubSpotContactToRow(
  contactId: string,
  props: Record<string, string | null | undefined>,
): ContactUpsertRow {
  // --- Status normalization ---
  const rawStatus = props.call_status || props.hs_lead_status || "NEW";
  const normalizedStatus = normalizeCallStatus(rawStatus);

  // --- Attribution: prioritize AnyTrack-injected ad ID ---
  const bestAdId =
    props.facebook_ad_id ||
    props.ad_id ||
    props.hs_analytics_source_data_1 ||
    null;

  const bestCampaignId =
    props.facebook_campaign_id ||
    props.campaign_id ||
    null;

  return {
    hubspot_contact_id:    contactId,
    email:                 props.email || null,
    first_name:            props.firstname || null,
    last_name:             props.lastname || null,
    phone:                 props.phone || props.mobilephone || null,
    company_name:          props.company || props.company_name || null,
    lifecycle_stage:       props.lifecyclestage || null,
    hubspot_owner_id:      props.hubspot_owner_id || null,
    call_status:           props.call_status || null,
    raw_status:            rawStatus,
    // Attribution
    fb_ad_id:              bestAdId,
    fb_campaign_id:        bestCampaignId,
    attributed_ad_id:      bestAdId,          // Same: direct from HubSpot sync = ad-level truth
    attributed_campaign_id: bestCampaignId,
    attributed_adset_id:   props.facebook_adset_id || null,
    attribution_source:    bestAdId ? "hubspot_sync" : null,
    facebook_id:           props.atclid || null,
    google_id:             props.satid || null,
    // UTM
    utm_source:            props.utm_source || null,
    utm_medium:            props.utm_medium || null,
    utm_campaign:          props.utm_campaign || null,
    utm_content:           props.utm_content || null,
    utm_term:              props.utm_term || null,
    // Engagement
    num_associated_deals:  props.num_associated_deals ? parseInt(props.num_associated_deals) : null,
    total_deal_value:      props.total_revenue ? parseFloat(props.total_revenue) : null,
    email_opt_out:         props.hs_email_opt_out === "true" || props.hs_email_opt_out === "1" || false,
    email_domain:          props.hs_email_domain || null,
    // Timestamps
    last_contacted_at:     props.lastmodifieddate || null,
    updated_at:            new Date().toISOString(),
  };
}

// ============================================================================
// STATUS NORMALIZATION — shared across all 5 sync functions
// ============================================================================

const STATUS_MAP: Record<string, string> = {
  connected:             "CONNECTED",
  completed:             "CONNECTED",
  busy:                  "ATTEMPTED",
  no_answer:             "ATTEMPTED",
  left_voicemail:        "LEFT_VOICEMAIL",
  bad_timing:            "BAD_TIMING",
  wrong_number:          "WRONG_NUMBER",
  not_interested:        "DISQUALIFIED",
  qualified:             "QUALIFIED",
  new:                   "NEW",
  open:                  "NEW",
  attempted_to_contact:  "ATTEMPTED",
};

export function normalizeCallStatus(rawStatus: string): string {
  const key = (rawStatus || "NEW").toLowerCase().replace(/[ -]/g, "_");
  return STATUS_MAP[key] ?? "NEW";
}

// ============================================================================
// ATTRIBUTION SOURCE RECONCILIATION
// The 5-source truth hierarchy used when writing attribution_source to contacts
// ============================================================================

/**
 * Attribution sources in descending confidence order.
 * Use this enum when setting attribution_source in any sync function.
 */
export const ATTRIBUTION_SOURCES = {
  /** AnyTrack pixel + HubSpot campaign cross-verified = ABSOLUTE TRUTH (100%) */
  ANYTRACK_CROSS_VERIFIED:  "anytrack_cross_verified",
  /** AnyTrack pixel direct fb_ad_id via email match (75%) */
  ANYTRACK_EMAIL_MATCH:     "anytrack",
  /** AnyTrack pixel fb_ad_id via phone normalization match (75%) */
  ANYTRACK_PHONE_MATCH:     "anytrack_phone_match",
  /** FormSubmit → Lead AnyTrack chain (75%) */
  FORMSUBMIT_LEAD_CHAIN:    "formsubmit_lead_chain",
  /** Direct from HubSpot contact properties (facebook_ad_id field) (60%) */
  HUBSPOT_SYNC:             "hubspot_sync",
  /** UTM parameters from landing page, Facebook source (50%) */
  UTM_FACEBOOK:             "utm_facebook",
  /** UTM parameters, generic source (35%) */
  UTM_GENERIC:              "utm_generic",
  /** No attribution data (0%) */
  NONE:                     "none",
} as const;

export type AttributionSource = typeof ATTRIBUTION_SOURCES[keyof typeof ATTRIBUTION_SOURCES];

// ============================================================================
// DIFFERENCES SUMMARY: Why 5 functions exist and what each does
// ============================================================================
//
// 1. sync-hubspot-leads (sync-hubspot-leads/index.ts)
//    - Trigger: Manual / cron daily
//    - Scope:   Last 24h modified contacts only
//    - Missing: UTMs, fb_ad_id, company_name
//    - onConflict: hubspot_contact_id
//    - FIX: Should import mapHubSpotContactToRow() from this module
//
// 2. sync-hubspot-contacts (sync-hubspot-contacts/index.ts)
//    - Trigger: Manual / cron daily
//    - Scope:   Last 24h modified contacts only
//    - Missing: UTMs, fb_ad_id, attribution fields, company_name
//    - onConflict: hubspot_contact_id
//    - NOTE: Uses HubSpotSyncManager (shared), but still missing attribution props
//    - FIX: Should request HS_PROPS_ATTRIBUTION + HS_PROPS_LEAD
//
// 3. sync-hubspot-data (sync-hubspot-data/index.ts)
//    - Trigger: Manual full sync
//    - Scope:   All contacts + deals + meetings
//    - Missing: UTMs, fb_ad_id, firstname, lastname, all attribution
//    - onConflict: email (INCONSISTENT — use hubspot_contact_id!)
//    - NOTE: Also syncs deals and appointments — unique among the 5
//    - FIX: Switch onConflict to hubspot_contact_id; add attribution props
//
// 4. sync-hubspot-to-supabase (sync-hubspot-to-supabase/index.ts)
//    - Trigger: Manual / cron
//    - Scope:   All contacts (paginated), deals, calls — most complete sync
//    - Coverage: ✅ All UTMs, ✅ fb_ad_id, ✅ attribution enrichment from attribution_events
//    - onConflict: hubspot_contact_id
//    - NOTE: This is the gold standard — others should match this
//    - STATUS: Already uses the shared HUBSPOT_PROPERTIES from hubspot-sync-manager.ts
//
// 5. hubspot-webhook (hubspot-webhook/index.ts)
//    - Trigger: Real-time HubSpot webhook (deal/contact property changes)
//    - Scope:   Single contact/deal per event
//    - Coverage: Enriches attribution from attribution_events on deal upsert
//    - NOTE: Calls enrichDealAttribution() which queries attribution_events by email/phone
//    - STATUS: Good attribution enrichment, but only fires on deal stage changes
