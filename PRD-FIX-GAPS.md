# PRD: Fix Critical Gaps & Intelligence Upgrades

## Context
Same app as PRD-WIRE-MOCK-PAGES.md. Vite + React + Supabase + TanStack Query.
DO NOT touch any files that PRD-WIRE-MOCK-PAGES is modifying (ExecutiveOverview, MarketingAnalytics tabs 2-4, RevenueIntelligence tabs 2-4, AttributionLeaks tab 2, StripeIntelligence, WorkflowStrategy, SkillCommandCenter, Observability, GlobalBrain, Clients, AuditTrail, SetterActivityToday, MasterControlPanel, CommandCenter).

## Rules
1. Run `npx tsc --noEmit` after each change
2. Run `npm run build` at the end
3. DO NOT modify `src/integrations/supabase/types.ts`
4. DO NOT create new migrations

## Tasks

- [ ] **1. Wire Truth Triangle to view_truth_triangle** — In `src/pages/AttributionWarRoom.tsx`, the TruthTriangle component receives hardcoded props. Query `view_truth_triangle` from Supabase to get real monthly data (meta_ad_spend, hubspot_deal_value, stripe_gross_revenue). Pass the latest month's values as props. The view already exists in production. Also update `src/components/analytics/TruthTriangle.tsx` to accept a third label — currently it says "PostHog" but should say "Stripe" since we're comparing Meta/HubSpot/Stripe.

- [ ] **2. Wire AttributionWarRoom fully** — Check all data in `src/pages/AttributionWarRoom.tsx`. It invokes `data-reconciler` edge function which is good. Verify the Truth Triangle section uses real data from task 1. Ensure no hardcoded fallback values remain.

- [ ] **3. Verify and fix YesterdayBookings.tsx** — Check if all data is from real queries. Fix any hardcoded arrays. Should query `deals` with yesterday's date filter for bookings and `call_records` for calls.

- [ ] **4. Verify and fix ClientDetail.tsx** — Check all 5 useQuery hooks are returning real data. No mock fallbacks.

- [ ] **5. Verify and fix Coaches.tsx** — Check all 11 useQuery hooks. Ensure coach data comes from `staff` + `client_health_scores` tables.

- [ ] **6. Verify and fix Analytics.tsx** — Wrapper page, ensure child components pass real data.

- [ ] **7. Verify and fix Operations.tsx** — Currently 0 data hooks. If it's a tab container for child pages, that's fine. If it should show summary data, add queries.

- [ ] **8. Fix Interventions.tsx** — Has 13 hooks but 1 mock marker. Find and remove the mock data, replace with real query.

- [ ] **9. Fix AIKnowledge.tsx** — Has 5 hooks but 2 TODO markers. Find and resolve TODOs.

- [ ] **10. Fix AILearning.tsx** — Has 5 hooks but 1 TODO marker. Find and resolve.

- [ ] **11. Wire call-to-ad attribution** — In `src/pages/AttributionWarRoom.tsx` or a new section in `AttributionLeaks.tsx` (if not being modified by the other PRD), create a query that joins `call_records` → `contacts` (via phone/email) → `attribution_events` → `facebook_ads_insights` (via ad_id/campaign_id). This answers the core question: "Which Facebook ad is making me money?"

- [ ] **12. Final verification** — Run `npx tsc --noEmit` and `npm run build`. Both must pass with zero errors.
