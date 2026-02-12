# Master Upgrade Plan — Vital Suite Complete Overhaul

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy all pending backend work, commit everything, then redesign the frontend — in one clean sequence with zero back-and-forth.

**Architecture:** Backend-first deployment (migrations → edge functions → frontend), then UI/UX redesign pass.

**Tech Stack:** Supabase (PostgreSQL, Deno Edge Functions), React 18, TanStack Query, Shadcn/UI, Tailwind CSS, Vercel

**Current Design System:** Dark-mode-only, OLED-optimized. Amber primary (#F59E0B "Loki Gold"), Violet accent (#8B5CF6). 56 shadcn/ui components. Fira Sans + Fira Code fonts. HSL CSS variables.

---

## Phase Overview

| Phase | Name | Skill(s) | Effort | Risk |
|-------|------|----------|--------|------|
| **A** | Backup & Safety | `supabase-postgres-best-practices` | 10 min | NONE |
| **B** | Deploy Migrations | `supabase-postgres-best-practices` | 15 min | LOW |
| **C** | Deploy Edge Functions | — | 5 min | LOW |
| **D** | Regenerate Types | — | 2 min | NONE |
| **E** | Wire Dead Buttons | `verification-before-completion` | 45 min | LOW |
| **F** | Type Safety Pass | `verification-before-completion` | 2h | LOW |
| **G** | Unified Loading (Physics) | `ui-ux-pro-max`, `frontend-design` | 1.5h | LOW |
| **H** | Code Splitting + Error Boundaries | `frontend-design` | 1h | LOW |
| **I** | Form Validation | — | 1h | LOW |
| **J** | Design Upgrade | `ui-ux-pro-max`, `frontend-design` | 4-6h | MEDIUM |
| **K** | Commit & Deploy | `verification-before-completion` | 15 min | LOW |

**Total: ~12-14h across 11 phases**

---

## Phase A: Backup & Safety (10 min)

### Task 1: Create Database Backup Tables

Before the destructive marketing dedup migration, backup the 6 affected tables.

**Step 1: Run backup SQL in Supabase SQL Editor or via CLI**

```sql
-- Backup marketing tables before dedup migration
CREATE TABLE IF NOT EXISTS public._backup_marketing_agent_signals AS SELECT * FROM public.marketing_agent_signals;
CREATE TABLE IF NOT EXISTS public._backup_marketing_recommendations AS SELECT * FROM public.marketing_recommendations;
CREATE TABLE IF NOT EXISTS public._backup_marketing_budget_proposals AS SELECT * FROM public.marketing_budget_proposals;
CREATE TABLE IF NOT EXISTS public._backup_creative_library AS SELECT * FROM public.creative_library;
CREATE TABLE IF NOT EXISTS public._backup_marketing_fatigue_alerts AS SELECT * FROM public.marketing_fatigue_alerts;
CREATE TABLE IF NOT EXISTS public._backup_loss_analysis AS SELECT * FROM public.loss_analysis;
```

**Step 2: Verify backups exist**

```sql
SELECT 'marketing_agent_signals' as tbl, COUNT(*) FROM public._backup_marketing_agent_signals
UNION ALL SELECT 'marketing_recommendations', COUNT(*) FROM public._backup_marketing_recommendations
UNION ALL SELECT 'marketing_budget_proposals', COUNT(*) FROM public._backup_marketing_budget_proposals
UNION ALL SELECT 'creative_library', COUNT(*) FROM public._backup_creative_library
UNION ALL SELECT 'marketing_fatigue_alerts', COUNT(*) FROM public._backup_marketing_fatigue_alerts
UNION ALL SELECT 'loss_analysis', COUNT(*) FROM public._backup_loss_analysis;
```

Expected: 6 rows with counts matching originals.

**Rollback:** DROP TABLE _backup_* (after 7 days of stable operation)

---

## Phase B: Deploy Migrations (15 min)

### Task 2: Verify Supabase CLI & Push All Migrations

**Step 1: Verify CLI is available**

```bash
npx supabase --version
```

If not available: `brew install supabase/tap/supabase`

**Step 2: Link project (if not linked)**

```bash
npx supabase link --project-ref ztjndilxurtsfqdsvfds
```

**Step 3: Dry-run to see pending migrations**

```bash
npx supabase db push --dry-run
```

Expected: Shows 9 pending migrations (20260212000000 through 20260213000006).

**Step 4: Push all migrations**

```bash
npx supabase db push
```

Expected: All 9 migrations applied successfully.

**Step 5: Verify critical views exist**

```sql
SELECT viewname FROM pg_views WHERE schemaname = 'public'
AND viewname IN (
  'campaign_full_funnel', 'adset_full_funnel', 'ad_creative_funnel',
  'lead_full_journey', 'cold_leads', 'upcoming_assessments',
  'weekly_health_summary', 'setter_funnel_matrix', 'source_discrepancy_matrix'
);
```

Expected: 9 rows.

**Step 6: Verify token_usage_metrics table**

```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'token_usage_metrics' ORDER BY ordinal_position;
```

Expected: id, function_name, model_used, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, correlation_id, created_at.

**Rollback:** Views can be dropped safely (no data loss). Columns can be dropped. See migration headers for specific rollback SQL.

---

## Phase C: Deploy Edge Functions (5 min)

### Task 3: Deploy All Edge Functions

**Step 1: Deploy**

```bash
npx supabase functions deploy --all --project-ref ztjndilxurtsfqdsvfds
```

Expected: 143+ functions deployed.

**Step 2: Verify critical functions**

```bash
npx supabase functions list --project-ref ztjndilxurtsfqdsvfds | head -20
```

**Rollback:** Revert to previous commit's edge functions and redeploy.

---

## Phase D: Regenerate Types (2 min)

### Task 4: Regenerate types.ts from Live Database

This fixes the 6 missing views + token_usage_metrics + 7 facebook_ads_insights columns.

**Step 1: Generate**

```bash
npx supabase gen types typescript --project-id ztjndilxurtsfqdsvfds > src/integrations/supabase/types.ts
```

**Step 2: Verify new views appear**

```bash
grep -c "campaign_full_funnel\|adset_full_funnel\|ad_creative_funnel\|lead_full_journey\|cold_leads\|upcoming_assessments\|token_usage_metrics" src/integrations/supabase/types.ts
```

Expected: 7+ matches.

**Step 3: Build check**

```bash
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" npx vite build
```

Expected: 0 errors.

---

## Phase E: Wire Dead Buttons (45 min)

### Task 5: Wire SalesPipeline Mark Won/Lost Buttons

**Files:**
- Modify: `src/pages/SalesPipeline.tsx`
- Reference: `src/features/sales-operations/api/dealsApi.ts`

**Step 1: Import dealsApi and create useMutation for Mark Won**

Replace the undefined `updateDealMutation` with a real mutation using `dealsApi.updateDealStage()`.

**Step 2: Wire Mark Lost button**

Replace the toast-only `onClick` with the same mutation pattern, passing `"closedlost"` as stage.

**Step 3: Verify both buttons call backend**

Build passes + buttons visible in UI.

---

### Task 6: Pass onMoveCard to KanbanBoard in Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Step 1: Import dealsApi and wire onMoveCard prop to KanbanBoard**

When card is dragged to new column, call `dealsApi.updateDealStage()`.

**Step 2: Build check**

```bash
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" npx vite build
```

---

### Task 7: Fix 6 Dead Buttons Across App

**Files:**
- `src/components/ptd/AutomationTab.tsx` — Wire Preflight, Simulate, Run buttons (3)
- `src/components/hubspot/QuickActionsPanel.tsx` — Wire Run Bulk Reassign (1)
- `src/components/dashboard/EnhancedInterventionTracker.tsx` — Wire Phone, Calendar icons (2)

For each: either wire to a real backend call or remove the button if no backend exists.

**Step 3: Build check**

---

## Phase F: Type Safety Pass (2h)

### Task 8: Kill `as any` in Top 2 Files (26 casts)

**Files:**
- `src/hooks/use-ceo-data.ts` — 15 `as any` casts
- `src/hooks/useDeepIntelligence.ts` — 11 `as any` casts

**Step 1: Replace table name casts**

After types.ts is regenerated (Phase D), table names like `"prepared_actions"` should be recognized. Remove `as any` suffix from `.from()` calls.

**Step 2: Replace RPC casts**

Use proper RPC typing from generated Database type.

**Step 3: Replace data casts**

Use `Database['public']['Tables']['table_name']['Row']` or `Database['public']['Views']['view_name']['Row']` instead of `as any`.

**Step 4: Build check**

---

### Task 9: Type SalesTabs Props (8 any → interfaces)

**File:** `src/components/sales-pipeline/SalesTabs.tsx`

Replace all 8 `any` props with proper interfaces derived from the generated types.

---

### Task 10: Type apiClient.ts (Zod at boundary)

**File:** `src/services/apiClient.ts`

Add Zod validation at the invoke boundary OR strongly type the generic defaults.

---

### Task 11: Kill Remaining `as any` (~80 casts)

Systematic sweep of all remaining files. Use `grep -rn "as any" src/` to find them, replace with proper types.

**Verification:**

```bash
grep -rn "as any" src/ --include="*.ts" --include="*.tsx" | wc -l
```

Target: < 10 remaining (some legitimate uses like catch blocks).

---

## Phase G: Unified Loading — "Physics" (1.5h)

> **Skill:** Use `ui-ux-pro-max` for component design, `frontend-design` for implementation.

### Task 12: Create PageSkeleton Component

**File:** Create `src/components/ui/page-skeleton.tsx`

A reusable skeleton loader that matches the page layout:
- KPI cards row (4 skeleton cards)
- Table skeleton (header + 5 rows)
- Chart skeleton (rectangle)
- Configurable via props: `variant="dashboard" | "table" | "detail"`

Use existing `src/components/ui/skeleton.tsx` as base.

### Task 13: Replace All "Loading..." Text (15 files)

Replace every bare `"Loading..."` text string with `<PageSkeleton />`:
- `CommandCenter.tsx` — 9 instances
- `SetterActivityToday.tsx` — 2 instances
- `SalesCoachTracker.tsx` — 2 instances
- `HealthIntelligenceTab.tsx` — 1 instance
- `HubSpotTabs.tsx` — 3 instances

### Task 14: Replace Inconsistent Spinners

Standardize all `<Loader2>` usage to use the same size/style, or replace with `<PageSkeleton />` where appropriate.

**Verification:** `grep -rn '"Loading..."' src/ | wc -l` → target: 0

---

## Phase H: Code Splitting + Error Boundaries (1h)

### Task 15: Add React.lazy to All Routes

**File:** `src/main.tsx`

Convert all 38 static page imports to `React.lazy()`:

```typescript
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SalesPipeline = lazy(() => import("./pages/SalesPipeline"));
// ... all 38 routes
```

Wrap router in `<Suspense fallback={<PageSkeleton variant="dashboard" />}>`.

### Task 16: Add Per-Section Error Boundaries

**Files:** `src/pages/Dashboard.tsx`, `src/pages/CommandCenter.tsx`

Wrap independent sections (KPI grid, charts, tables) in `<ComponentErrorBoundary>` from existing `src/components/ErrorBoundary.tsx`.

**Verification:**

```bash
grep -rn "React.lazy\|lazy(" src/main.tsx | wc -l
```

Target: 38+ lazy imports.

---

## Phase I: Form Validation (1h)

### Task 17: Add Zod Schemas to Forms

Install zod + @hookform/resolvers if not present:

```bash
npm install zod @hookform/resolvers
```

Add validation to any form that submits to backend:
- Lead search forms
- Settings forms
- Any input → Supabase operation

---

## Phase J: Design Upgrade (4-6h)

> **Skills:** Use `ui-ux-pro-max` for design decisions, `frontend-design` for implementation, `brainstorming` for direction.

### Current Design DNA (preserve these):
- Dark-mode-only, OLED-black (#000000) background
- Amber primary (#F59E0B "Loki Gold")
- Violet accent (#8B5CF6 "Supreme CTA")
- Fira Sans + Fira Code typography
- Glass/premium card effects (backdrop-blur)
- 56 shadcn/ui components already available

### Task 18: Design Audit + Direction

Use `ui-ux-pro-max` skill to:
1. Evaluate current DFII score (Design Fidelity & Innovation Index)
2. Identify the 5 highest-impact design improvements
3. Choose design direction: refine current vs. new design system

### Task 19: Dashboard Redesign

- Upgrade KPI cards (use premium-card class, add sparkline trends)
- Fix layout hierarchy (most important metrics top-left)
- Standardize spacing (gap-4 everywhere vs mixed)
- Add micro-interactions (hover states, transitions)

### Task 20: CommandCenter Design Polish

- Tabs → better visual hierarchy
- Funnel tables → add verdict badges with color coding
- Lead journey search → modal with card layout
- Money chain KPIs → hero section with large numbers

### Task 21: SalesPipeline Visual Upgrade

- Kanban cards → richer with deal value, stage color, avatar
- Pipeline funnel → visual horizontal funnel graphic
- Table view → compact with inline actions

### Task 22: Global Design Consistency Pass

- Ensure all pages use same card style (premium-card)
- Ensure all tables use same header style
- Ensure all badges use consistent color mapping
- Ensure all modals use same animation (fade-up)

**Verification:** Visual review of every page in browser.

---

## Phase K: Commit & Deploy (15 min)

### Task 23: Build Verification

```bash
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" npx vite build
```

Must pass with 0 errors.

### Task 24: Commit in Layers

```bash
# Commit 1: Backend (migrations + edge functions)
git add supabase/
git commit -m "feat: Phase 15 backend — 9 migrations, 30+ EF upgrades, Command Center views

- 9 SQL migrations: campaign/adset/creative funnels, cold leads, assessments
- FB insights expanded (30+ new columns for full Meta API coverage)
- Token usage metrics table + memory retention TTL + marketing dedup
- 30+ edge functions upgraded with constitutional framing, unified AI client
- New: command-center-executor, cleanup-agent-memory, daily-command-briefing
- HubSpot manager: shared mapDealFields() across 3 sync callers

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

# Commit 2: Type safety + dead buttons
git add src/integrations/ src/services/ src/hooks/ src/pages/SalesPipeline.tsx \
        src/pages/Dashboard.tsx src/components/ptd/AutomationTab.tsx \
        src/components/hubspot/QuickActionsPanel.tsx \
        src/components/dashboard/EnhancedInterventionTracker.tsx
git commit -m "fix: wire dead buttons + type safety pass — 107 as-any eliminated

- Mark Won/Lost buttons now call dealsApi.updateDealStage()
- KanbanBoard drag-drop wired to real backend
- 6 dead buttons across app fixed or removed
- types.ts regenerated with 6 new views + token_usage_metrics
- 107 as-any casts eliminated from hooks and components
- apiClient typed with Zod validation at boundary

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

# Commit 3: Unified loading + code splitting + validation
git add src/components/ui/page-skeleton.tsx src/main.tsx \
        src/components/ErrorBoundary.tsx src/pages/CommandCenter.tsx \
        src/pages/SetterActivityToday.tsx
git commit -m "feat: unified loading physics + React.lazy + error boundaries

- PageSkeleton component replaces 15 'Loading...' strings
- React.lazy on 38 routes (code splitting)
- Global Suspense boundary in main.tsx
- Per-section ErrorBoundary on Dashboard + CommandCenter
- Zod form validation on all user inputs

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

# Commit 4: Design upgrade
git add src/
git commit -m "feat: design upgrade — Dashboard, CommandCenter, SalesPipeline polish

- KPI cards with sparkline trends and premium-card styling
- CommandCenter verdict badges + money chain hero section
- SalesPipeline Kanban cards enriched with deal details
- Global consistency pass (cards, tables, badges, modals)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

# Commit 5: Docs
git add docs/ progress.md findings.md task_plan.md
git commit -m "docs: Deep Dive Stack Audit + Phase 15 roadmap + session logs

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Task 25: Push to Deploy

```bash
git push origin main
```

Triggers: Vercel auto-deploy (frontend) + GitHub Action (edge functions).

### Task 26: Post-Deploy Verification

1. Open production URL → Dashboard loads
2. Navigate to /command-center → funnel data visible
3. Navigate to /sales-pipeline → Mark Won/Lost buttons work
4. Check browser console → 0 errors
5. Check Supabase logs → no edge function failures

---

## Verification Checklist (Final)

| # | Check | Command/Action | Expected |
|---|-------|---------------|----------|
| 1 | Build passes | `npx vite build` | 0 errors |
| 2 | Views exist | SQL: `SELECT * FROM campaign_full_funnel LIMIT 1` | Data |
| 3 | Types current | `grep "campaign_full_funnel" types.ts` | Found |
| 4 | Dead buttons wired | Click Mark Won in SalesPipeline | Backend called |
| 5 | No "Loading..." text | `grep -rn '"Loading..."' src/` | 0 matches |
| 6 | React.lazy active | `grep -c "lazy(" src/main.tsx` | 38+ |
| 7 | Error boundaries | Check Dashboard sections | Each wrapped |
| 8 | `as any` count | `grep -rn "as any" src/ \| wc -l` | < 10 |
| 9 | Form validation | Submit empty form | Zod error shown |
| 10 | Design consistent | Visual review all pages | Clean, polished |

---

## Cleanup (7 days after stable deploy)

```sql
-- Remove backup tables
DROP TABLE IF EXISTS public._backup_marketing_agent_signals;
DROP TABLE IF EXISTS public._backup_marketing_recommendations;
DROP TABLE IF EXISTS public._backup_marketing_budget_proposals;
DROP TABLE IF EXISTS public._backup_creative_library;
DROP TABLE IF EXISTS public._backup_marketing_fatigue_alerts;
DROP TABLE IF EXISTS public._backup_loss_analysis;
```
