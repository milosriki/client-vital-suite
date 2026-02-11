# FORENSIC AUDIT FINDINGS — Vital Suite
## Date: 2026-02-11 | Scope: Full Pipeline Audit (FB Ads → Leads → Calls → Deals → Revenue)

---

## EXECUTIVE SUMMARY

**Overall System Health: 6.5/10** — Data collection is REAL and solid. Attribution chain has CRITICAL gaps. You CANNOT currently answer: **"Which ad made me money?"**

### The Core Problem
```
Facebook Ad  →  Lead  →  Call  →  Opportunity  →  Revenue
     ✅          ✅       ⚠️         ⚠️             ❌
  (fetched)   (synced)  (no ad    (no deal↔      (no deal↔
                         link)    invoice)       Stripe link)
```

**You have the data. The CONNECTIONS between the data are broken.**

---

## SECTION 1: FACEBOOK ADS PIPELINE

### What Works
- `fetch-facebook-insights` pulls REAL data from Meta API via Pipeboard
- Stores in `facebook_ads_insights` table: ad_id, spend, clicks, ctr, cpc, leads, ROAS
- CAPI pipeline exists: `send-to-stape-capi`, `process-capi-batch`, `capi-validator`
- AnyTrack webhook captures server-side conversions with UTM params + fbclid
- `data-reconciler` calculates Truth ROAS vs Reported ROAS
- `ad-creative-analyst` identifies Zombie Ads (spend > $500, ROAS < 1.5) and Hidden Gems

### What's Broken
| # | Gap | Impact | Severity |
|---|-----|--------|----------|
| 1 | **Campaign ID not stored** — only campaign_name in facebook_ads_insights | Cannot join campaigns by ID, only by name (fragile) | HIGH |
| 2 | **Adset ID not captured at all** | Cannot analyze adset-level performance | HIGH |
| 3 | **No direct ad_id → contact link** | Cannot say "this specific ad created this specific lead" | CRITICAL |
| 4 | **Stape CAPI is optional** — if key not set, events stored but NOT sent to Meta | Facebook cannot optimize conversions without server-side data | HIGH |
| 5 | **VisualDNA widget shows 0 ROAS** — `purchase_value` field missing from ad objects | Dashboard misleading for all creatives | HIGH |

### Key Files
- `supabase/functions/fetch-facebook-insights/index.ts`
- `supabase/functions/send-to-stape-capi/index.ts`
- `supabase/functions/anytrack-webhook/index.ts`
- `supabase/functions/data-reconciler/index.ts`
- `supabase/functions/ad-creative-analyst/index.ts`

---

## SECTION 2: CALL TRACKING (CALLGEAR)

### What Works
- `fetch-callgear-data` syncs every 10 minutes from CallGear API (REAL data)
- 37-field schema in `call_records` table (duration, recording, outcome, sentiment, transcript)
- Phone-based contact linking works (caller_number → contacts.phone)
- Security sentinel monitors suspicious calls in real-time
- ICP router handles intelligent call routing with 2-second SLA
- Supervisor coaching (listen/whisper/barge) fully functional

### What's Broken
| # | Gap | Impact | Severity |
|---|-----|--------|----------|
| 6 | **No call → ad/campaign attribution** | Cannot say "this call came from this Facebook ad" | CRITICAL |
| 7 | **No call → deal linkage** | Cannot say "this call contributed to this deal closing" | CRITICAL |
| 8 | **`revenue_generated` field never populated** | Call ROI impossible to calculate | HIGH |
| 9 | **No reverse sync to Facebook** | Cannot create "People who called" custom audiences for retargeting | MEDIUM |
| 10 | **Employee mapping partly hardcoded** | Owner names hardcoded in fetch-callgear-data (lines 321-343) | LOW |

### Key Files
- `supabase/functions/fetch-callgear-data/index.ts`
- `supabase/functions/callgear-live-monitor/index.ts`
- `supabase/functions/sync-single-call/index.ts`
- `src/pages/CallTracking.tsx`

---

## SECTION 3: LEAD → OPPORTUNITY → REVENUE PIPELINE

### What Works
- HubSpot → Supabase sync is COMPLETE (80+ contact properties including UTM, facebook_id)
- Contacts store: `facebook_id`, `utm_source`, `utm_campaign`, `first_touch_source`, `latest_traffic_source`
- Deals properly linked to contacts via `contact_id` FK (UUID)
- Funnel stage tracker computes 12-stage conversion rates from REAL data
- `attribution_events` table captures fb_ad_id, fb_campaign_id, fb_adset_id
- Real-time webhooks for contact.creation, deal.creation, call.creation

### What's Broken
| # | Gap | Impact | Severity |
|---|-----|--------|----------|
| 11 | **No Deal ↔ Stripe Invoice link** | Cannot verify if HubSpot deal_value matches actual Stripe payment | CRITICAL |
| 12 | **Static currency rates** | USD→AED hardcoded at 3.67, EUR→AED at 4.00 in stripe-dashboard-data (NEVER updates) | HIGH |
| 13 | **Churn rate estimated from health zones** | CLV = ARPU / churn_rate, but churn_rate is guess (RED + 0.3*YELLOW) not actual churn | HIGH |
| 14 | **No Cost Per Lead (CPL) metric** | CAC exists (cost per customer), but CPL undefined and not computed | HIGH |
| 15 | **No Cost Per Opportunity (CPO) metric** | Cannot calculate ad spend per deal created | HIGH |
| 16 | **No deal.propertyChange webhook** | Deal stage changes only sync on next scheduled run, not real-time | MEDIUM |
| 17 | **No deal lost reason tracking** | deals store `closedlost` but no reason field exposed | MEDIUM |
| 18 | **Data reconciler has duplicate variable declarations** | `attributedRevenue` declared twice — potential logic error | MEDIUM |

### Key Files
- `supabase/functions/sync-hubspot-to-supabase/index.ts`
- `supabase/functions/funnel-stage-tracker/index.ts`
- `supabase/functions/financial-analytics/index.ts`
- `supabase/functions/stripe-dashboard-data/index.ts`

---

## SECTION 4: DASHBOARD WIDGETS & FORMULAS

### What Works
- **92% of widgets use REAL data** from Supabase/API (no mock data in dashboards)
- RevenueVsSpendChart: queries `daily_business_metrics` → ROAS = revenue/spend
- LiveRevenueChart: queries `deals` table → revenue trend with correct period-over-period
- CampaignMoneyMap: calls `get_campaign_money_map` RPC for real campaign data
- usePeriodComparison hook: proper delta calculations across revenue, leads, ROAS, spend
- All metric cards (KPIGrid, HeroStatCard, MetricCard, StatCard) are pure display components

### What's Broken
| # | Gap | Impact | Severity |
|---|-----|--------|----------|
| 19 | **VisualDNA ROAS shows 0 for all creatives** | Missing `purchase_value` field → `platformRoas` computes to 0 | HIGH |
| 20 | **No revenue per ad creative on any dashboard** | Shows spend per creative but NOT revenue per creative | HIGH |
| 21 | **No cost per opportunity on any dashboard** | Key metric completely absent from all pages | HIGH |
| 22 | **NorthStarWidget "500k ARR" hardcoded** | Target should come from database/settings | MEDIUM |
| 23 | **UnitEconomics "< AED 500" CAC goal hardcoded** | Business threshold should be configurable | LOW |

### Formula Verification
| Metric | Formula | Source | Status |
|--------|---------|--------|--------|
| ROAS | `revenue / spend` | daily_business_metrics | CORRECT |
| Revenue Trend | `(2nd_half - 1st_half) / 1st_half * 100` | deals table | CORRECT |
| CAC | `totalSpend / realNewClients` | Stripe + FB spend | CORRECT (but per customer, not per lead) |
| CLV | `ARPU / churnRate` | Stripe + health zones | ESTIMATE (churn rate guessed) |
| LTV:CAC | `ltv / cac` | Computed | CORRECT formula, questionable inputs |
| Funnel Rates | `stageN / stageN-1 * 100` | contacts + deals tables | CORRECT |
| CPL | Not computed | — | MISSING |
| CPO | Not computed | — | MISSING |

---

## SECTION 5: AGENT INTELLIGENCE LAYER

### What Works (90% functional)
- PTD system operational with 5 personas (ATLAS, SHERLOCK, REVENUE, HUNTER, GUARDIAN)
- multi-agent-orchestrator coordinates 4 specialist agents with real Supabase data
- LangSmith tracing for observability, structured logging
- Approval workflow for risky actions (ptd-execute-action with risk levels)
- Skill auditor grades real WhatsApp conversations and stores lessons
- marketing-scout detects creative fatigue, ghost rates, spend anomalies from real data
- marketing-analyst makes SCALE/HOLD/WATCH/KILL recommendations

### What's Broken
| # | Gap | Impact | Severity |
|---|-----|--------|----------|
| 24 | **ultimate-aggregator uses MOCK data** | Returns 3 hardcoded creatives, 50 fake contacts instead of real data | HIGH |
| 25 | **4 marketing agents are SKELETONS** | marketing-allocator, copywriter, historian, loss-analyst = empty shells | MEDIUM |
| 26 | **No agent → dashboard visualization feed** | Agents compute recommendations but dashboards don't display them | MEDIUM |
| 27 | **sales-objection-handler empty** | Directory exists, no implementation | LOW |
| 28 | **No integration tests** between agent output and dashboard consumption | Could break silently | MEDIUM |

---

## SECTION 6: THE ATTRIBUTION TRUTH TABLE

### "Which ad is good?" — What you CAN and CANNOT answer today

| Question | Answer? | Method |
|----------|---------|--------|
| How much did I spend per ad? | YES | facebook_ads_insights.spend |
| How many leads per ad? | YES | facebook_ads_insights.leads |
| CTR/CPC per ad? | YES | facebook_ads_insights.ctr/cpc |
| ROAS per ad (Meta reported)? | YES | facebook_ads_insights.purchase_roas |
| Which contact came from which ad? | PARTIAL | attribution_events.fb_ad_id → contacts.email (indirect, 2-hop) |
| Which call came from which ad? | NO | No call→ad link exists |
| Which deal came from which ad? | PARTIAL | deals→contacts→attribution_events (3-hop join, fragile) |
| How much REVENUE did each ad generate? | NO | No deal→Stripe payment verification |
| TRUE ROI per ad: (revenue - spend) / spend? | NO | Cannot compute — missing revenue link |
| Best ads by OPPORTUNITIES generated? | PARTIAL | Can count deals per source, not per specific ad |
| Cost per opportunity by ad? | NO | Missing metric entirely |

---

## SECTION 7: HARDCODED VALUES & DATA QUALITY FLAGS

### Hardcoded Values Found
| File | Value | Risk |
|------|-------|------|
| fetch-facebook-insights | `PTD_MAIN_ACCOUNT = "act_349832333681399"` | Low (fallback) |
| stripe-dashboard-data | Currency rates (USD 3.67, EUR 4.00, GBP 4.63) | HIGH — never updated |
| NorthStarWidget | "500k ARR" target | Medium — should be configurable |
| UnitEconomics | "< AED 500" CAC goal | Low |
| fetch-callgear-data | Employee OWNER_MAPPING (lines 321-343) | Low — merged with DB |

### Tables/Views Referenced But Unverified
- `revenue_genome_7d` — referenced in marketing-scout but not in migrations
- `source_discrepancy_matrix` — referenced in MarketingDeepIntelligence
- `get_campaign_money_map` RPC — called by CampaignMoneyMap.tsx
- `get_underworked_leads` RPC — used by sales-aggression
- `get_stale_deals` RPC — used by sales-aggression

---

## SECTION 8: PRIORITY RANKING

### CRITICAL (Blocks "Which ad is good?")
1. No deal ↔ Stripe invoice link — Cannot verify revenue
2. No ad_id stored on contacts/deals — Cannot trace ad → customer
3. No call → ad attribution — Calls orphaned from campaigns
4. CPL and CPO metrics missing — Cannot compare ad efficiency
5. VisualDNA shows 0 ROAS — Dashboard actively misleading

### HIGH (Data accuracy)
6. Static currency rates (could drift significantly from real rates)
7. Churn rate is estimated, not measured from actual drop-offs
8. Campaign ID not stored in insights table (only name)
9. Adset ID not captured at all
10. Revenue per creative not shown on any dashboard

### MEDIUM (Completeness)
11. Deal stage changes not real-time (missing webhook)
12. Ultimate-aggregator uses mock data
13. 4 skeleton marketing agents need implementation
14. NorthStar target hardcoded in UI
15. No deal lost reason tracking

---

## PREVIOUS FINDINGS (Lisa v10.0 Audit — 2026-02-10)

> Preserved from previous audit session. See findings 1-23 below for Lisa WhatsApp agent audit results.
> Lisa Sales Intelligence Score: 0.89/1.0 (improved from 0.74)
> All P0 bugs resolved. 13/13 eval scenarios passing.
