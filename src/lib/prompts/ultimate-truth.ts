// Ultimate Truth Prompt Component
// Aligns Facebook CAPI, HubSpot, and AnyTrack data to find single source of truth

export const ULTIMATE_TRUTH_PROMPT = `
=== ULTIMATE TRUTH - DATA ALIGNMENT RULES ===

PROBLEM: Three systems track the same events differently:
- Facebook CAPI: Hashed PII, event names (Purchase, Lead, InitiateCheckout)
- HubSpot: Raw PII, lifecycle stages, deal stages
- AnyTrack: Raw PII, attribution data, event names

SOLUTION: Find the "Ultimate Truth" by aligning all sources

ALIGNMENT LOGIC (Priority Order):

1. EVENT MATCHING (by email, phone, external_id, time window ±7 days)
   - Match events across all three sources
   - Use email as primary key (most reliable)
   - Fallback to phone if email missing
   - Use external_id (HubSpot contact ID) if available
   - Time window: ±7 days (events can arrive at different times)

2. DATA RECONCILIATION (When sources disagree):
   - Attribution: AnyTrack > HubSpot > Facebook (AnyTrack has best attribution)
   - PII: HubSpot > AnyTrack > Facebook (HubSpot has most complete PII)
   - Conversion Value: Highest value from all sources
   - Conversion Status: HubSpot deal closed_won is source of truth
   - Event Time: Earliest timestamp from all sources

3. ATTRIBUTION TRUTH:
   - Source: attribution_events.source (from AnyTrack)
   - Medium: attribution_events.medium (from AnyTrack)
   - Campaign: attribution_events.campaign (from AnyTrack)
   - FB Campaign ID: attribution_events.fb_campaign_id (from AnyTrack/Facebook)
   - FB Ad ID: attribution_events.fb_ad_id (from AnyTrack/Facebook)
   - If AnyTrack missing, use HubSpot first_touch_source

4. PII TRUTH:
   - Email: contacts.email (from HubSpot - most complete)
   - Phone: contacts.phone (from HubSpot - normalized)
   - Name: contacts.first_name + last_name (from HubSpot)
   - If HubSpot missing, use AnyTrack raw data

5. CONVERSION TRUTH:
   - Deal ID: deals.hubspot_deal_id (HubSpot deal is source of truth)
   - Closed Date: deals.close_date (HubSpot)
   - Value: Highest value from deals.deal_value, attribution_events.value, capi_events_enriched.value
   - Status: deals.status (closed_won/closed_lost from HubSpot)

CONFIDENCE SCORING (0-100):
- Has email: +25 points
- Has phone: +20 points
- Has fbp cookie: +30 points
- Has fbc cookie: +15 points
- Has external_id: +10 points
- Multiple sources agree: +20 points
- Time alignment (±1 day): +10 points

CRITICAL RULES:
- ALWAYS query LIVE data from all three sources
- NEVER use mock or test data
- When sources conflict, use priority rules above
- Calculate confidence score for every aligned event
- Flag low-confidence alignments (< 60%) for manual review

QUERY PATTERN:
1. Find event in AnyTrack (events table, source='anytrack')
2. Find matching contact in HubSpot (contacts table, email match)
3. Find matching CAPI event (capi_events_enriched, email hash match)
4. Align data using priority rules
5. Calculate confidence score
6. Store in unified view or ultimate_truth_events table
`;
