# Phase 15 Roadmap — Post-Intelligence Upgrade

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy Phase 14 changes, close remaining gaps, and prepare Contact Consolidation.

**Architecture:** Deployment + frontend hardening + infrastructure cleanup.

**Tech Stack:** Supabase CLI, Deno/TypeScript, React/TypeScript, PostgreSQL

---

## Status Snapshot (Post Phase 14 Audit)

### COMPLETE (No Further Work)

| Area | Score | Evidence |
|------|-------|---------|
| Phase 14 Intelligence Upgrade | 9/10 tasks | Build clean, 4661 modules, 0 errors |
| Command Center v1 | 100% | campaign_full_funnel, cold_leads, upcoming_assessments |
| Attribution Deep Views | 100% | adset_full_funnel, ad_creative_funnel, lead_full_journey |
| Attribution Backend | 100% | Executor + tool-definitions + CommandCenter.tsx all wired |
| HubSpot Consolidation | 100% | mapDealFields() shared across 3 callers |
| Marketing Validation | 100% | Object validators + UPSERT for 6 agents |
| Memory + Namespacing | 100% | TTL + agent_name in 5 tables |
| Constitutional Framing | 100% | 17+ agents with getConstitutionalSystemMessage() |
| Edge Functions | 143 total | All deploy cleanly |
| SQL Migrations | 169 total | All on disk |

### NOT COMPLETE (This Plan)

| # | Gap | Priority | Effort |
|---|-----|----------|--------|
| 1 | Deploy migrations + edge functions | P0 | 30 min |
| 2 | Commit all uncommitted Phase 14 work | P0 | 15 min |
| 3 | Centralize booking stage IDs | P1 | 30 min |
| 4 | Register cleanup-agent-memory pg_cron | P1 | 15 min |
| 5 | Fix deals schema mismatch (owner columns) | P1 | 1h |
| 6 | Add error boundaries to key pages | P2 | 1-2h |
| 7 | Data freshness indicators | P2 | 1h |
| 8 | Contact Consolidation (T10) | P3 | 16-24h |

---

## Batch A — Deploy & Commit (P0, 45 min)

### Task 1: Commit Phase 14 Changes

**Files:** All modified/untracked from Phase 14

**Step 1: Review uncommitted changes**

```bash
git status
git diff --stat HEAD
```

**Step 2: Stage and commit**

```bash
git add supabase/migrations/20260213000004_token_usage_metrics.sql \
  supabase/migrations/20260213000005_memory_retention_and_namespacing.sql \
  supabase/migrations/20260213000006_marketing_upsert_keys.sql \
  supabase/functions/_shared/auth-middleware.ts \
  supabase/functions/_shared/unified-ai-client.ts \
  supabase/functions/_shared/unified-prompts.ts \
  supabase/functions/_shared/learning-layer.ts \
  supabase/functions/_shared/hubspot-manager.ts \
  supabase/functions/ptd-ultimate-intelligence/index.ts \
  supabase/functions/ai-ceo-master/index.ts \
  supabase/functions/ptd-agent-gemini/index.ts \
  supabase/functions/sync-single-deal/index.ts \
  supabase/functions/backfill-deals-history/index.ts \
  supabase/functions/hubspot-webhook/index.ts \
  supabase/functions/marketing-scout/index.ts \
  supabase/functions/marketing-analyst/index.ts \
  supabase/functions/marketing-allocator/index.ts \
  supabase/functions/marketing-predictor/index.ts \
  supabase/functions/marketing-loss-analyst/index.ts \
  supabase/functions/marketing-copywriter/index.ts \
  supabase/functions/cleanup-agent-memory/index.ts
git commit -m "feat: Phase 14 Intelligence Upgrade — 9 tasks, 3 migrations, 20+ agents upgraded"
```

**Rollback:** `git revert HEAD`

---

### Task 2: Deploy Migrations to Supabase

**Step 1: Push all pending migrations**

```bash
npx supabase db push
```

Expected: 6+ migrations applied (20260212000005 through 20260213000006)

**Step 2: Verify views exist**

```bash
npx supabase db execute "SELECT COUNT(*) FROM campaign_full_funnel"
npx supabase db execute "SELECT COUNT(*) FROM adset_full_funnel"
npx supabase db execute "SELECT COUNT(*) FROM token_usage_metrics"
```

**Step 3: Deploy edge functions**

```bash
npx supabase functions deploy --all
```

Expected: 143 functions deployed

**Rollback:** See rollback SQL in each migration file header.

---

## Batch B — Quick Wins (P1, 1.5h)

### Task 3: Centralize Booking Stage IDs

Currently hardcoded in 5 locations:
- `src/pages/CommandCenter.tsx:104`
- `src/pages/SetterActivityToday.tsx:35-38`
- `src/lib/lead-lifecycle-mapping.ts:4-19`
- `src/lib/ptd-mega-prompt.ts:180-182`

**Step 1: Create constants file**

Create `src/constants/dealStages.ts`:

```typescript
export const BOOKING_STAGES = [
  "122237508",   // Assessment Booked
  "122237276",   // Consultation Booked
  "122221229",   // Discovery Call Booked
] as const;

export const WON_STAGES = ["closedwon", "signed", "paid"] as const;
export const LOST_STAGES = ["closedlost", "bad_timing"] as const;
```

**Step 2: Replace all 5 locations with imports**

**Step 3: Verify**

```bash
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" npx vite build
```

---

### Task 4: Register cleanup-agent-memory pg_cron

**Step 1: Create migration**

Create `supabase/migrations/20260213000007_cleanup_agent_memory_cron.sql`:

```sql
-- Register cleanup-agent-memory to run daily at 3:00 AM UTC
-- Rollback: SELECT cron.unschedule('cleanup-expired-agent-memory');

SELECT cron.schedule(
  'cleanup-expired-agent-memory',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/cleanup-agent-memory',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )$$
);
```

**Step 2: Deploy**

```bash
npx supabase db push
```

---

### Task 5: Fix Deals Schema Mismatch

`HubSpotManager.mapDealFields()` outputs `contact_id`, `owner_id`, `owner_name` — but deals table may have `lead_id` instead of `contact_id`, and may lack `owner_id`/`owner_name` columns.

**Step 1: Verify actual deals table schema**

```bash
npx supabase db execute "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'deals' ORDER BY ordinal_position"
```

**Step 2: Create migration to add missing columns (if needed)**

Based on Step 1 results, either:
- Add `owner_id TEXT`, `owner_name TEXT` columns to deals
- OR adjust mapDealFields() to match existing schema

**Step 3: Verify no silent drops**

Test a deal upsert and confirm owner data persists.

---

## Batch C — Frontend Hardening (P2, 2-3h)

### Task 6: Error Boundaries

**Step 1: Create reusable ErrorBoundary component**

`src/components/ui/error-boundary.tsx` — wraps page sections, shows fallback on crash.

**Step 2: Wrap critical sections in Dashboard, CommandCenter, SetterActivityToday**

### Task 7: Data Freshness Indicators

**Step 1: Add `last_synced_at` badge to Dashboard KPI cards**

Show how old the data is (e.g., "Updated 2h ago", "24h lag" for FB data).

**Step 2: Add warning for stale FB insights**

facebook_ads_insights has inherent 24h lag — show visual indicator.

---

## Batch D — Contact Consolidation (P3, 16-24h) — PHASE 15 MAIN

### Prerequisites (must complete before starting)

- [ ] Complete inventory: all `enhanced_leads` queries (frontend + backend)
- [ ] Complete inventory: all `sales_leads` queries
- [ ] Staging environment with production data clone
- [ ] Full database backup
- [ ] Frontend PR ready with all query updates

### Task 8: Consolidate 4 Contact Tables → 1

This is the deferred Task 10 from Phase 14. Requires:
1. Schema alignment (firstname/lastname vs first_name/last_name)
2. Migration to merge data into `contacts`
3. Create backward-compatible VIEWs (`enhanced_leads`, `sales_leads`) pointing at `contacts`
4. Update 16+ frontend files
5. Update `sync-hubspot-to-supabase` (91 fields)
6. Staging test with production clone
7. Production cutover with rollback plan

**This task needs its own detailed plan before execution.**

---

## Verification Checklist

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1 | Build passes | `npx vite build` | 0 errors |
| 2 | Migrations deployed | `supabase db execute "SELECT COUNT(*) FROM token_usage_metrics"` | 0 (table exists) |
| 3 | Views populated | `supabase db execute "SELECT COUNT(*) FROM campaign_full_funnel"` | >0 rows |
| 4 | Attribution views | `supabase db execute "SELECT COUNT(*) FROM adset_full_funnel"` | >0 rows |
| 5 | Edge functions | `supabase functions list` | 143 functions |
| 6 | Stage IDs centralized | `grep -r "122237508" src/` | Only constants file |
| 7 | Cleanup cron | `supabase db execute "SELECT * FROM cron.job WHERE jobname = 'cleanup-expired-agent-memory'"` | 1 row |
| 8 | Namespace isolation | `supabase db execute "SELECT DISTINCT agent_name FROM agent_memory"` | Values present |
| 9 | Owner data persists | Upsert a deal → check owner_name | Non-null |
| 10 | Error boundaries | Navigate to Dashboard → break a query → no white screen | Fallback shown |

---

## Execution Summary

| Batch | Tasks | Effort | Risk | When |
|-------|-------|--------|------|------|
| A: Deploy | T1-T2 | 45 min | LOW | NOW |
| B: Quick Wins | T3-T5 | 1.5h | LOW | NOW |
| C: Frontend | T6-T7 | 2-3h | LOW | This week |
| D: Contacts | T8 | 16-24h | HIGH | Phase 15 (separate plan) |
| **TOTAL** | **8 tasks** | **~21-29h** | — | — |
