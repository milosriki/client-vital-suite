# PRD: Phase 1 — Attribution Truth Engine & Data Integrity

## Context
Working directory: /Users/milosvukovic/client-vital-suite
Supabase project ref: ztjndilxurtsfqdsvfds (Mumbai ap-south-1)
Attribution has 5 sources: Meta Ads, AnyTrack, HubSpot CRM, HubSpot Lead Forms, Stape CAPI.
The goal is ABSOLUTE TRUTH: every lead, call, deal, and payment traces back to the exact Facebook ad.

## Tasks

- [x] Create update-currency-rates edge function: Fetches from https://open.er-api.com/v6/latest/AED (free, no key). Stores rates in org_memory_kv table (key: 'fx_rates', value: JSON with usd, eur, gbp rates). Then update stripe-dashboard-data/index.ts lines 12-13 to read from org_memory_kv instead of hardcoded 3.67/4.00.
- [x] Create SQL migration for view_call_attribution: JOIN call_records to contacts via phone number matching (normalize both sides, match last 9 digits). Include ad_id, campaign_id, utm_source from contacts. This answers "which call came from which ad?"
- [ ] Create SQL migration for view_attribution_coverage: Shows % of contacts with attribution data by lifecycle_stage. Answers "how much of our pipeline has ad tracking?"
- [ ] Create attribution confidence scoring function: Score each contact's attribution confidence (100%=AnyTrack fb_ad_id + HubSpot match, 75%=AnyTrack only, 50%=UTM campaign match, 25%=time-based inference, 0%=no data). Store as attributed_confidence on contacts table.
- [ ] Wire churn prediction to alerts: Read supabase/functions/ml-churn-score/index.ts. If churn_probability > 0.7, INSERT into proactive_insights table with type='churn_alert' and the client details.
- [ ] Make NorthStarWidget configurable: In src/components/dashboard/bi/NorthStarWidget.tsx line 57, replace hardcoded "500k ARR" with a prop that defaults to reading from org_memory_kv.
- [ ] Run npm run build && npx tsc --noEmit to verify zero errors
- [ ] Git commit: "feat: phase 1 - attribution truth engine, currency rates, churn alerts"
