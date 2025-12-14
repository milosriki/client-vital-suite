// Unified Data Schema - Single Source of Truth
// All agents MUST use this schema for consistency

export const UNIFIED_DATA_SCHEMA = {
  // Primary Tables (LIVE DATA ONLY)
  TABLES: {
    CONTACTS: 'contacts', // HubSpot contacts synced to Supabase
    DEALS: 'deals', // HubSpot deals synced to Supabase
    CALLS: 'call_records', // CallGear + HubSpot calls
    APPOINTMENTS: 'appointments', // Calendly appointments
    HEALTH_SCORES: 'client_health_scores', // Calculated health scores
    ATTRIBUTION: 'attribution_events', // AnyTrack + Facebook attribution
    EVENTS: 'events', // All events (AnyTrack, HubSpot, Facebook)
    CAPI_EVENTS: 'capi_events_enriched', // Facebook CAPI events
  },

  // Standard Field Mappings (Use these field names consistently)
  FIELDS: {
    // Contact Fields
    EMAIL: 'email', // Primary identifier
    PHONE: 'phone', // Normalized phone number
    FIRST_NAME: 'first_name',
    LAST_NAME: 'last_name',
    LIFECYCLE_STAGE: 'lifecycle_stage', // lead, mql, sql, opportunity, customer
    LEAD_STATUS: 'lead_status', // new, appointment_set, appointment_held, closed
    OWNER_ID: 'owner_id', // HubSpot owner ID
    OWNER_NAME: 'owner_name', // HubSpot owner name
    
    // Deal Fields
    DEAL_STAGE: 'stage', // HubSpot deal stage ID
    DEAL_STATUS: 'status', // open, closed_won, closed_lost
    DEAL_VALUE: 'deal_value', // AED amount
    CLOSE_DATE: 'close_date',
    
    // Attribution Fields (Use AnyTrack as source of truth)
    ATTRIBUTION_SOURCE: 'source', // From attribution_events (AnyTrack)
    ATTRIBUTION_MEDIUM: 'medium', // From attribution_events
    ATTRIBUTION_CAMPAIGN: 'campaign', // From attribution_events
    FB_CAMPAIGN_ID: 'fb_campaign_id', // From attribution_events
    FB_AD_ID: 'fb_ad_id', // From attribution_events
    
    // Health Fields
    HEALTH_SCORE: 'health_score', // 0-100
    HEALTH_ZONE: 'health_zone', // purple, green, yellow, red
    CHURN_RISK: 'churn_risk_score', // 0-100
  },

  // Data Priority Rules (When sources conflict)
  PRIORITY: {
    ATTRIBUTION: 'anytrack > hubspot > facebook', // AnyTrack has best attribution
    PII: 'hubspot > anytrack > facebook', // HubSpot has most complete PII
    CONVERSION: 'hubspot', // HubSpot deal closed_won is source of truth
    HEALTH: 'client_health_scores', // Calculated table is source of truth
  },
};

export const UNIFIED_SCHEMA_PROMPT = `
=== UNIFIED DATA SCHEMA (SINGLE SOURCE OF TRUTH) ===

PRIMARY TABLES (ALWAYS QUERY LIVE DATA):
- contacts: HubSpot contacts (email, lifecycle_stage, owner_name, lead_status)
- deals: HubSpot deals (stage, status, deal_value, close_date)
- call_records: All calls (caller_number, transcription, call_outcome)
- appointments: Calendly appointments (scheduled_at, status)
- client_health_scores: Calculated health (health_score, health_zone, churn_risk_score)
- attribution_events: Attribution data (source, campaign, platform, fb_campaign_id)
- events: All events (AnyTrack, HubSpot, Facebook)
- capi_events_enriched: Facebook CAPI events (hashed PII)

STANDARD FIELD NAMES (Use consistently):
- Email: contacts.email (primary identifier)
- Lifecycle Stage: contacts.lifecycle_stage (lead, mql, sql, opportunity, customer)
- Deal Stage: deals.stage (HubSpot stage ID - use formatDealStage() to convert)
- Attribution Source: attribution_events.source (from AnyTrack - BEST attribution)
- Health Score: client_health_scores.health_score (0-100)

DATA PRIORITY RULES (When sources conflict):
1. Attribution: AnyTrack > HubSpot > Facebook (AnyTrack has best attribution data)
2. PII: HubSpot > AnyTrack > Facebook (HubSpot has most complete contact data)
3. Conversion: HubSpot deals.closed_won is source of truth
4. Health: client_health_scores table is calculated source of truth

CRITICAL RULES:
- ALWAYS query LIVE data from Supabase tables
- NEVER use cached, mock, or test data
- Use unified field names from this schema
- When attribution conflicts, prefer AnyTrack
- When PII conflicts, prefer HubSpot
- When conversion conflicts, HubSpot deal status is truth
`;
