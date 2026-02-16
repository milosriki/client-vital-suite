# PRD: Complete Remaining Wire Tasks + Fix Gaps

## Context
Same app as PRD-WIRE-MOCK-PAGES.md. Vite + React + Supabase + TanStack Query.
Tasks 1-7 already completed. Complete remaining tasks plus critical fixes.

Key files:
- Types: `src/integrations/supabase/types.ts` (auto-generated, DO NOT edit)
- Supabase client: `src/integrations/supabase/client.ts`
- Query keys: `src/config/queryKeys.ts`

## Rules
1. Replace hardcoded `const` arrays with `useQuery` hooks calling Supabase
2. Keep the exact same UI structure and component props — only change where data comes from
3. Add loading states (Skeleton) and error states where missing
4. DO NOT create new migrations or modify the database schema
5. DO NOT modify any files in `src/integrations/supabase/types.ts`
6. Run `npx tsc --noEmit` after each page to verify no type errors
7. Run `npm run build` at the end to verify everything compiles

## Reference: Available Tables (from types.ts)
- `contacts` — 10,552 records, leads/clients with lifecycle, assigned_coach
- `deals` — 19,474 records, pipeline deals with stage, deal_value, owner_name
- `call_records` — 31,068 records, call logs
- `stripe_transactions` — 29 records, payments
- `facebook_ads_insights` — 1,663 records, ad metrics
- `client_health_scores` — 4,280 records, 13 unique coaches
- `staff` — 51 records (31 coaches + 20 setters/closers, real data)
- `ai_execution_metrics` — edge function performance
- `knowledge_base` — AI knowledge entries
- `sync_errors` — integration sync errors
- `agent_memory` / `agent_decisions` / `agent_patterns` — AI agent state

## Tasks

- [x] **1. Observability.tsx** — Replace 2 fallback arrays. Ensure `ai_execution_metrics` queries have no hardcoded fallbacks that hide empty states. Show real empty state when no data.

- [x] **2. GlobalBrain.tsx** — Verify `ptd-brain-api` edge function calls work. Wire the "Add Memory" form to insert into `agent_memory` via supabase client (not fetch). Show loading states.

- [x] **3. AuditTrail.tsx** — Verify all data comes from real queries. The CSV export arrays are computed from data (OK). Ensure search/filter works with real data.

- [x] **4. SetterActivityToday.tsx** — Verify all 3 useDedupedQuery hooks return real data. Test with today's date filter.

- [ ] **5. MasterControlPanel.tsx** — Verify edge function invocations work. Test the health check button.

- [ ] **6. CommandCenter.tsx** — Verify all 14 query hooks return real data. Remove any hardcoded fallback arrays.

- [ ] **7. Wire Truth Triangle** — In `src/pages/AttributionWarRoom.tsx`, the TruthTriangle component receives hardcoded props. Query `view_truth_triangle` from Supabase to get real monthly data (meta_ad_spend, hubspot_deal_value, stripe_gross_revenue). Also update `src/components/analytics/TruthTriangle.tsx` label from "PostHog" to "Stripe".

- [ ] **8. Final verification** — Run `npx tsc --noEmit` and `npm run build`. Both must pass with zero errors.
