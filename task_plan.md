# TASK PLAN — Fix Attribution Pipeline (Ad → Lead → Call → Deal → Revenue)

## Date: 2026-02-11

## Goal

Answer the question: **"Which Facebook ad is making me money?"** — with real, verified numbers from ad spend through to Stripe payment.

---

## Phase 1: Fix VisualDNA ROAS (Quick Win)

**Status**: `DONE`
**Severity**: HIGH — Dashboard actively showing 0 ROAS for all creatives
**Effort**: Small (1-2 hours)

### Tasks

- [x] Fix VisualDNA.tsx — wire `purchase_value` from facebook_ads_insights into ad objects
- [x] Compute platformRoas correctly: `purchase_value / spend` (or use `purchase_roas` field directly)
- [ ] Verify VisualDNA displays real ROAS per creative on MarketingIntelligence page

### Files to Modify

- `src/components/dashboard/VisualDNA.tsx`
- `src/pages/MarketingIntelligence.tsx` (wherever ad objects are constructed)

---

## Phase 2: Store campaign_id and adset_id in Facebook Insights

**Status**: `DONE`
**Severity**: HIGH — Currently only stores campaign_name (fragile string matching)
**Effort**: Small (1-2 hours)

### Tasks

- [x] Update `fetch-facebook-insights` to request `campaign_id` and `adset_id` from Pipeboard/Meta API
- [x] Add `campaign_id` and `adset_id` columns to `facebook_ads_insights` upsert
- [ ] Create migration to add columns if not present

### Files to Modify

- `supabase/functions/fetch-facebook-insights/index.ts`
- New migration SQL file

---

## Phase 3: Add ad_id Attribution to Contacts

**Status**: `PARTIAL` — AnyTrack webhook now populates fb_ad_id in attribution_events. Contacts table columns + HubSpot sync still pending.
**Severity**: CRITICAL — Cannot trace which ad created which lead
**Effort**: Medium (2-4 hours)

### Tasks

- [ ] Add `attributed_ad_id` and `attributed_campaign_id` columns to `contacts` table
- [ ] Update `sync-hubspot-to-supabase` to populate from attribution_events when contact is synced
- [x] Update `anytrack-webhook` to set fb_ad_id in attribution_events from fbclid/clickId
- [ ] Create migration for new columns + index

### Files to Modify

- `supabase/functions/sync-hubspot-to-supabase/index.ts`
- `supabase/functions/anytrack-webhook/index.ts`
- New migration SQL file

---

## Phase 4: Compute CPL and CPO Metrics

**Status**: `DONE`
**Severity**: HIGH — Key metrics completely missing
**Effort**: Medium (2-4 hours)

### Tasks

- [x] Add CPL computation: `ad_spend / leads_generated` per campaign and per ad
- [x] Add CPO computation: `ad_spend / deals_created` per campaign and per ad
- [ ] Wire into `daily_business_metrics` table or new summary view
- [x] Display CPL and CPO on KPIGrid, CampaignMoneyMap, and MarketingIntelligence dashboards
- [x] Add to funnel-stage-tracker output

### Files to Modify

- `supabase/functions/funnel-stage-tracker/index.ts`
- `supabase/functions/financial-analytics/index.ts`
- `src/components/dashboard/KPIGrid.tsx`
- `src/pages/CampaignMoneyMap.tsx`

---

## Phase 5: Link Deals to Stripe Payments

**Status**: `pending`
**Severity**: CRITICAL — Cannot verify if deal amount matches actual payment
**Effort**: Large (4-8 hours)

### Tasks

- [ ] Add `stripe_invoice_id` and `stripe_charge_id` columns to `deals` table
- [ ] Create/update edge function that matches deals to Stripe payments:
  - Match by contact email → Stripe customer → charges/invoices
  - Match by deal amount + close date proximity
  - Store the link on the deal record
- [ ] Add reconciliation status: `verified` / `unverified` / `mismatch`
- [ ] Update data-reconciler to use verified revenue instead of estimated
- [ ] Create migration for new columns

### Files to Modify

- `supabase/functions/enrich-with-stripe/index.ts` (extend to do deal matching)
- `supabase/functions/data-reconciler/index.ts` (fix duplicate variables, use verified revenue)
- New migration SQL file

---

## Phase 6: Link Calls to Ads and Deals

**Status**: `pending`
**Severity**: CRITICAL — Calls completely orphaned from attribution
**Effort**: Medium (3-5 hours)

### Tasks

- [ ] When `fetch-callgear-data` finds a contact match, look up their `attributed_ad_id` and `attributed_campaign_id` and store on call_record
- [ ] Add `campaign_id` and `deal_id` columns to `call_records` table
- [ ] After finding contact, query deals where `contact_id = X` and link to most relevant (latest open) deal
- [ ] Populate `revenue_generated` field when call's contact has a closed-won deal
- [ ] Create migration for new columns

### Files to Modify

- `supabase/functions/fetch-callgear-data/index.ts`
- `supabase/functions/sync-single-call/index.ts`
- New migration SQL file

---

## Phase 7: Revenue Per Creative Dashboard

**Status**: `pending`
**Severity**: HIGH — Currently shows spend per creative but NOT revenue
**Effort**: Medium (3-5 hours)

### Tasks

- [ ] Create SQL view or RPC: `get_revenue_per_creative` that joins:
  - facebook_ads_insights (ad_id, spend)
  - attribution_events (fb_ad_id → email)
  - contacts (email → id)
  - deals (contact_id → deal_value, status=closed)
- [ ] Add TRUE ROI per ad: `(attributed_revenue - spend) / spend * 100`
- [ ] Wire into VisualDNA component for per-creative revenue display
- [ ] Add to CampaignMoneyMap page
- [ ] Add to MarketingDeepIntelligence Zone 1

### Files to Modify

- New migration (create view/RPC)
- `src/components/dashboard/VisualDNA.tsx`
- `src/pages/CampaignMoneyMap.tsx`
- `src/pages/MarketingDeepIntelligence.tsx`

---

## Phase 8: Fix Static Currency Rates

**Status**: `pending`
**Severity**: HIGH — Rates hardcoded, never update
**Effort**: Small (1-2 hours)

### Tasks

- [ ] Replace hardcoded currency table in `stripe-dashboard-data` with API call to free exchange rate service (e.g., exchangerate-api.com or Open Exchange Rates)
- [ ] Cache rates in Supabase with 24h TTL
- [ ] Fallback to current hardcoded rates if API fails

### Files to Modify

- `supabase/functions/stripe-dashboard-data/index.ts`

---

## Phase 9: Fix Churn Rate (Use Real Data)

**Status**: `pending`
**Severity**: HIGH — CLV calculation uses guessed churn rate
**Effort**: Small (1-2 hours)

### Tasks

- [ ] Count clients with 0 sessions/revenue in last 30 days vs previous 30 days
- [ ] Use actual drop-off count for monthly churn rate
- [ ] Update CLV formula in financial-analytics to use real churn

### Files to Modify

- `supabase/functions/financial-analytics/index.ts`

---

## Phase 10: Fix ultimate-aggregator Mock Data

**Status**: `pending`
**Severity**: HIGH — Returns fake creatives and contacts
**Effort**: Medium (2-3 hours)

### Tasks

- [ ] Replace hardcoded 3 creatives with query to `facebook_ads_insights` (top performers)
- [ ] Replace hardcoded 50 contacts with query to `contacts` table
- [ ] Wire to revenue_genome_7d view if it exists, or create it

### Files to Modify

- `supabase/functions/ultimate-aggregator/index.ts`

---

## Phase 11: Add deal.propertyChange Webhook

**Status**: `pending`
**Severity**: MEDIUM — Deal stage changes delayed until next sync
**Effort**: Small (1 hour)

### Tasks

- [ ] Add `deal.propertyChange` event handler in hubspot-webhook-receiver
- [ ] Route to `sync-single-deal` for real-time stage updates
- [ ] Register webhook subscription in HubSpot app settings

### Files to Modify

- `supabase/functions/hubspot-webhook-receiver/index.ts`

---

## Execution Order (Recommended)

| Priority | Phase | Effort | Impact |
| -------- | ----- | ------ | ------ |
| 1 | Phase 1: Fix VisualDNA ROAS | 1-2h | Stops misleading dashboard |
| 2 | Phase 2: Store campaign_id/adset_id | 1-2h | Enables proper joins |
| 3 | Phase 3: Ad attribution on contacts | 2-4h | Answers "which ad created this lead" |
| 4 | Phase 4: CPL and CPO metrics | 2-4h | Key missing business metrics |
| 5 | Phase 5: Deal ↔ Stripe link | 4-8h | Verifies real revenue |
| 6 | Phase 6: Call → ad/deal links | 3-5h | Completes call attribution |
| 7 | Phase 7: Revenue per creative dashboard | 3-5h | The money question answered |
| 8 | Phase 8: Live currency rates | 1-2h | Data accuracy fix |
| 9 | Phase 9: Real churn rate | 1-2h | CLV accuracy fix |
| 10 | Phase 10: Fix aggregator mocks | 2-3h | Agent data quality |
| 11 | Phase 11: Deal webhook | 1h | Real-time completeness |

**Total estimated effort: 20-38 hours across 11 phases**

After Phase 7, you will be able to answer: **"Ad X spent AED Y and generated AED Z in verified revenue = TRUE ROI of N%"**
