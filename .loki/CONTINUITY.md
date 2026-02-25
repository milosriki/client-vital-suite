# LOKI CONTINUITY — Marketing Intelligence Sprint

## Current State
- Sprint: marketing-intelligence-completion
- Branch: main
- Phase: DEVELOPMENT
- Tasks: 0/14 complete

## Sprint Objective
Complete Marketing Intelligence page to 100%. Kill ALL fake data in hooks. Build 3 missing components. Wire everything with real Supabase data. Zero mocks.

## Track Status
- **Track A (Fix Hooks):** PENDING — 3 tasks, parallelizable
- **Track B (Fix Tabs):** BLOCKED by A — 4 tasks
- **Track C (New Components):** BLOCKED by A — 3 tasks
- **Track D (Final Wiring):** BLOCKED by B+C — 3 tasks

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
(none yet)

## Mistakes & Learnings
(none yet)
