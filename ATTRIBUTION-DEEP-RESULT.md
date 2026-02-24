# ATTRIBUTION DEEP TRUTH: Result Report

## 1. Call → Ad Attribution Bridge (P0)
**Implemented:** `view_call_attribution`
We created a new SQL view that supersedes the legacy `call_attribution`. It introduces robust phone matching to link CallGear records to Facebook Ads via HubSpot contacts.
- **Match Logic:** Prioritizes exact `hubspot_contact_id` match. If missing, falls back to a 9-digit suffix normalization (`RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9)`), reliably mapping localized caller IDs (e.g. `+971`, `00971`) to stored contact phones.
- **Output:** Extracts full attribution metadata (`ad_id`, `campaign_id`, `utm_source`, etc.) directly into call reporting.

## 2. Attribution Coverage Dashboard Query (P0)
**Implemented:** `fn_attribution_coverage()`
This SQL function provides a real-time summary of attribution health across the sales pipeline.
- **Outputs:** Grouped by `lifecycle_stage`, it returns total counts, total attributed, and a `coverage_pct`.
- **Granularity:** Distinguishes between AnyTrack-direct, HubSpot-sync, and UTM-only attributions to highlight data quality drops.

## 3. Multi-Source Attribution Reconciler (P1)
**Implemented:** `fn_score_attribution_confidence(hubspot_contact_id)` & `view_attribution_confidence_scores`
We built a confidence scoring system representing the **Absolute Truth** hierarchy:
- **100 (Absolute Truth):** AnyTrack direct pixel matches HubSpot campaign name.
- **75 (High Confidence):** AnyTrack direct pixel (`fb_ad_id` present).
- **60 (Medium High):** HubSpot direct sync (custom `facebook_ad_id` property).
- **50 (Medium):** Facebook-specific UTM parameters.
- **35 (Low Medium):** Generic UTMs.
- **25 (Low):** Time-based inference (lead created during campaign flight).
- **0:** Unattributed.

*Note: The view is pre-computed and optimized for dashboard use, while the function can be used for deep single-contact debugging.*

## 4. Phone-Based Attribution Enrichment (P1)
**Implemented:** `fn_enrich_attribution_phone_match()`
This SQL function safely backfills `contacts`, `attribution_chain`, and `call_records`.
- It uses the same 9-digit normalized phone matching to link isolated AnyTrack events directly to contacts missing `attributed_ad_id`.

## 5. HubSpot Sync Field Mapping Consolidation (P2)
**Implemented:** `supabase/functions/_shared/hubspot-field-mapping.ts`
We audited the 5 scattered HubSpot sync functions and created a single canonical mapping module.
- **The Gap:** Found that 4 out of 5 sync functions (like `sync-hubspot-leads` and `sync-hubspot-contacts`) were dropping critical attribution fields (UTMs, `facebook_ad_id`) because they weren't querying them. Only `sync-hubspot-to-supabase` was capturing the full picture.
- **The Fix:** The shared module provides `HS_PROPS_ATTRIBUTION` and `mapHubSpotContactToRow()` to ensure all syncs uniformly write Facebook attribution data.

## Verification
- **Build:** `npm run build` passes (0 errors).
- **Typecheck:** `npx tsc --noEmit` passes (0 errors).
- **Migration:** Safe, idempotent migration `20260224230000_attribution_deep_truth.sql` generated and ready for `supabase db push`.