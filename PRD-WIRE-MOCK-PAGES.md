# PRD: Wire All Remaining Mock Pages to Real Data

## Context
This is a Vite + React + Supabase + TanStack Query dashboard app. Pages use `useQuery` hooks that call `supabase.from()` or `supabase.functions.invoke()`. The pattern is established in existing wired pages — follow the same patterns.

Key files:
- Types: `src/integrations/supabase/types.ts` (auto-generated, DO NOT edit)
- Supabase client: `src/integrations/supabase/client.ts`
- Query keys: `src/config/queryKeys.ts`
- Enterprise hooks: `src/hooks/enterprise/` (these are already real-data hooks, use as reference)
- Enterprise types: `src/types/enterprise.ts`

## Rules
1. Replace hardcoded `const` arrays with `useQuery` hooks calling Supabase
2. Keep the exact same UI structure and component props — only change where data comes from
3. Add loading states (Skeleton) and error states where missing
4. Use existing query key patterns from `src/config/queryKeys.ts`
5. If a table/view doesn't exist for a specific metric, use the closest real table and compute client-side
6. DO NOT create new migrations or modify the database schema
7. DO NOT modify any files in `src/integrations/supabase/types.ts`
8. Run `npx tsc --noEmit` after each page to verify no type errors
9. Run `npm run build` at the end to verify everything compiles

## Reference: Available Tables (from types.ts)
- `contacts` — leads/clients with lifecycle, email, phone, source
- `deals` — pipeline deals with stage, deal_value, close_date
- `call_records` — call logs with duration, direction, status
- `stripe_transactions` — payments with amount, status, customer_id, contact_id
- `facebook_ads_insights` — ad metrics with spend, clicks, impressions, ctr, date
- `client_health_scores` — health scores with assigned_coach, zone
- `staff` — coaches with name, role
- `ai_execution_metrics` — edge function performance logs
- `knowledge_base` — AI knowledge entries
- `sync_errors` — integration sync errors
- `attribution_events` — marketing attribution chain
- `intervention_log` — AI intervention history
- `agent_memory` / `agent_decisions` / `agent_patterns` — AI agent state

## Reference: Available Edge Functions (invoke via supabase.functions.invoke)
- `ptd-ultimate-intelligence` — AI executive insights
- `hubspot-command-center` — full-chain pipeline data
- `business-intelligence` — revenue trends, funnel metrics
- `business-intelligence-dashboard` — dashboard-specific BI
- `stripe-dashboard-data` — Stripe MRR/ARR/churn
- `data-reconciler` — attribution leak detection
- `system-health-check` — system status
- `proactive-insights-generator` — AI alerts
- `ptd-skill-auditor` — skill/agent audit

## Tasks

- [x] **1. ExecutiveOverview.tsx** — PRIORITY. Replace ALL 4 hardcoded arrays (northStarMetric, kpiMetrics, fullChainData, revenueTrendData, liveActivityData) with real queries. Use `deals` for revenue, `contacts` for leads, `call_records` for calls, `facebook_ads_insights` for ad spend. Wire the refresh button to `queryClient.invalidateQueries()`. Add useQuery hooks with loading skeletons.

- [x] **2. RevenueIntelligence.tsx** — Wire tabs 2-4. Tab 2 (Pipeline): query `deals` table grouped by stage. Tab 3 (HubSpot Health): query `sync_errors` + `contacts` lifecycle distribution. Tab 4 (Live Data): use Supabase realtime subscription or recent `deals`/`contacts` activity.

- [x] **3. MarketingAnalytics.tsx** — Wire tabs 2-4. Tab 2 (Deep Analysis): query `facebook_ads_insights` for historical comparison. Tab 3 (Meta Ads): query `facebook_ads_insights` for campaign/adset metrics. Tab 4 (Money Map): query `deals` + `facebook_ads_insights` + `stripe_transactions` for ROI calc.

- [ ] **4. AttributionLeaks.tsx** — Wire tab 2 (Leak Detector): invoke `data-reconciler` edge function for discrepancy data.

- [ ] **5. StripeIntelligence.tsx** — Replace 7 hardcoded const arrays. Query `stripe_transactions` directly for status breakdown, chart data, recent transactions. Remove static fallback arrays.

- [ ] **6. WorkflowStrategy.tsx** — Replace 3 mock arrays. Query `ai_execution_metrics` for workflow execution data. Query `agent_decisions` for strategy recommendations.

- [ ] **7. SkillCommandCenter.tsx** — Replace 6 mock const arrays. Invoke `ptd-skill-auditor` edge function. Query `knowledge_base` for agent knowledge entries.

- [ ] **8. Observability.tsx** — Replace 2 fallback arrays. Ensure `ai_execution_metrics` queries have no hardcoded fallbacks that hide empty states.

- [ ] **9. GlobalBrain.tsx** — Remove TODO markers. Verify `knowledge_base` + `knowledge_chunks` queries work. Wire the "Add Memory" form to actually insert into `agent_memory`.

- [ ] **10. Clients.tsx** — Wire search/filter to `client_health_scores` join `contacts`. Replace TODO markers with real queries.

- [ ] **11. AuditTrail.tsx** — Replace 5 const arrays. Query `sync_errors` for error log. Query `ai_execution_metrics` for audit trail. Wire search/filter.

- [ ] **12. SetterActivityToday.tsx** — Clean up 1 remaining mock marker. Verify all hooks return real data.

- [ ] **13. MasterControlPanel.tsx** — Clean up 1 mock marker. Verify edge function invocations work.

- [ ] **14. CommandCenter.tsx** — Verify all 26 query hooks return real data. Remove any hardcoded fallback.

- [ ] **15. Final verification** — Run `npx tsc --noEmit` and `npm run build`. Both must pass with zero errors.
