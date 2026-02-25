# LOKI CONTINUITY — Marketing Intelligence Sprint

## Current State
- Sprint: marketing-intelligence-completion
- Branch: main
- Phase: DEVELOPMENT
- Tasks: 0/14 complete

## Sprint Objective
Complete Marketing Intelligence page to 100%. Kill ALL fake data in hooks. Build 3 missing components. Wire everything with real Supabase data. Zero mocks.

## Track Status
- **Track A (Fix Hooks):** DONE — A1 (useMarketingAnalytics), A2 (useTruthTriangle), A3 (useDeepIntelligence)
- **Track B (Fix Tabs):** DONE — B1 (TruthTriangle already wired), B2 (thumbnails), B3 (Deep Intel unhidden), B4 (StressTest wired)
- **Track C (New Components):** DONE — C1 (SourceTruthMatrix), C2 (DailyOptimization), C3 (CohortWaterfall)
- **Track D (Final Wiring):** DONE — D1 (8 tabs wired), D2 (build passes), D3 (committed d22a8eb)

## Key Constraints
- NO mock data — every number from real Supabase queries
- AED currency — do NOT divide by 100
- Empty tables show "—" not fake numbers
- stripe_transactions = 0 rows (handle gracefully, backfill later)
- Use ad_creative_funnel VIEW for true ROAS (already joins FB→contacts→deals→Stripe)
- React 19, shadcn/ui, TanStack Query, Tailwind
- Must pass: npm run build + npx tsc --noEmit

## Data Available (real, live)
- facebook_ads_insights: 1663+ rows
- contacts: 12,720 rows
- deals: 19,506 rows
- call_records: 33,528 rows
- attribution_events: 1,954 rows
- ad_creative_funnel VIEW: per-ad true ROAS
- view_truth_triangle VIEW: monthly Meta/HubSpot/Stripe
- source_discrepancy_matrix VIEW: daily trust verdicts
- historical_baselines table: dimension-level baselines
- loss_analysis table: contact-level loss reasons
- funnel_metrics table: stage conversion rates
- daily_business_metrics table: daily KPIs
- marketing_recommendations table: KILL/SCALE signals

## Completed
- A1: useMarketingAnalytics — killed Math.random(), fake ROAS, hardcoded deltas, payback. Now uses ad_creative_funnel view + real period-over-period
- A2: useTruthTriangle — null guard added, Number() wrapping for safety
- A3: useDeepIntelligence — Promise.allSettled with safeResult helper, partial failure resilient
- B1: TruthTriangle — was already rendered at line 1068 (confirmed)
- B2: Creative DNA thumbnails — now use pipeboard.com/api/meta/creative/${ad_id}/thumbnail
- B3: Deep Intel — tab unhidden, baselines + lossReasons wired from useDeepIntelligence
- B4: StressTestDashboard — wired into Deep Intel section
- C1: SourceTruthMatrix — built + wired into Source Truth tab, uses real SourceDiscrepancy interface
- C2: DailyOptimization + useDailyOptimization — built, queries daily_business_metrics
- C3: CohortWaterfall + useCohortProgression — built, queries funnel_metrics + deals
- D1: All 8 tabs wired in MarketingIntelligence.tsx
- D2: npm run build — PASSES (3.64s, 0 errors)
- D3: Committed — d22a8eb

## Mistakes & Learnings
(none yet)
