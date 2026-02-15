# Enterprise Upgrade: Full Architecture Cross-Check & Execution Plan

> **Author:** Senior Architect Review | **Date:** Feb 14, 2026
> **Scope:** Forensic audit of `feat/enterprise-dashboard-upgrade` worktree (commit `fc71422`) against `main`

---

## 1. EXECUTIVE SUMMARY

The Gemini-built enterprise worktree contains **17 new files** and **1 dangerous overwrite**. After exhaustive cross-checking, the verdict is:

| Category | Count | Status |
|:---------|:------|:-------|
| Files that are **good and reusable** | 4 | Design patterns, interfaces, component shells |
| Files that need **moderate fixes** (1-2 hours each) | 7 | Missing imports, mock data replacement |
| Files that need **major rewrite** (new approach) | 5 | All 5 SQL migrations have column mismatches |
| Files that are **destructive** (must NOT merge) | 1 | `tool-definitions.ts` — gutted from 19 to 4 tools |

**The handover document from Gemini contains 7 factual errors** (see Section 3).

---

## 2. WHAT WAS ACTUALLY BUILT (Truth Map)

### 2.1 New Pages (7 files — all in worktree only)

| Page | Lines | Real Data? | Build Status | Reusable? |
|:-----|:------|:-----------|:-------------|:----------|
| `EnterpriseStrategy.tsx` | 163 | YES (via ReconciliationService) | BROKEN — bad import + invalid prop | **YES — best page, needs fixes** |
| `CallAnalytics.tsx` | 157 | NO — 100% mock | BROKEN — 2 missing icon imports | Shell only — needs data layer |
| `AIAdvisor.tsx` | 146 | NO — 100% mock | BROKEN — bad import path | Shell only — needs data layer |
| `SystemObservability.tsx` | 134 | NO — 100% mock | BROKEN — bad import path | Shell only — needs data layer |
| `ClientHealth.tsx` | 142 | NO — 100% mock | BROKEN — 3 missing icon imports | Shell only — needs data layer |
| `CoachPerformance.tsx` | 138 | NO — 100% mock | BROKEN — bad import + invalid prop | Shell only — needs data layer |
| `KnowledgeBase.tsx` | 153 | NO — 100% mock | BROKEN — Button not imported | Shell only — needs data layer |

**Every page has build errors.** The shared import `@/components/dashboard/layout/DashboardHeader` exists on main but not in the worktree (the worktree was created before these components were added to main).

### 2.2 New Components (3 files)

| Component | Lines | Props Interface | Build Status | Quality |
|:----------|:------|:----------------|:-------------|:--------|
| `CreativeDNACard.tsx` | 124 | Rich (adName, leadDNA, capacity, spend, revenue) | BROKEN — `TrendingUp` not imported | Good design, fixable |
| `LeadDetailDrawer.tsx` | 108 | `lead: EnterpriseLeadDNA, isOpen, onClose` | BUG — references `lead.avg_call_min` (not in interface) | Good pattern, needs fixes |
| `RevenueGenomeTable.tsx` | 103 | `data: EnterpriseLeadDNA[], loading?` | BROKEN — `Zap` not imported | Good design, fixable |

### 2.3 New Service Layer (1 file)

| File | Lines | Methods | Data Source | Quality |
|:-----|:------|:--------|:-----------|:--------|
| `ReconciliationService.ts` | 90 | 4 methods | Supabase views (cast as `any`) | **GOOD architecture, needs type safety** |

**Methods:**
- `getEnterpriseDNA(adId)` → queries `mv_enterprise_truth_genome`
- `getPredictiveShadow()` → projects revenue from HIGH INTENT leads (formula: `count * 5000 * 0.3`)
- `getRevenueLeaks()` → filters REVENUE LEAK verdicts
- `getSegmentHUD()` → queries `view_segment_capacity_hud`

**Interfaces exported (reusable):**
- `EnterpriseLeadDNA` — 12 fields including `lead_intent_iq`, `atlas_verdict`, `verified_cash`
- `SegmentCapacity` — 5 fields for zone/gender/coach load data

### 2.4 New Migrations (5 files — ALL BROKEN)

| Migration | Creates | Critical Blockers |
|:----------|:--------|:-----------------|
| `000001_view_atlas_lead_dna.sql` | VIEW `view_atlas_lead_dna` | `stripe_transactions.customer_email` does NOT exist |
| `000002_enterprise_truth_genome.sql` | VIEW `view_enterprise_truth_genome` | Same `customer_email` issue |
| `000003_dynamic_capacity_engine.sql` | 2 VIEWs: `view_coach_capacity_load`, `view_segment_capacity_hud` | `staff.full_name` → should be `name`; `staff.home_zone` doesn't exist; `staff.gender` doesn't exist; `client_health_scores.coach_name` → should be `assigned_coach` |
| `000004_materialized_truth_genome.sql` | MATVIEW `mv_enterprise_truth_genome` + 3 indexes + refresh function | Same `customer_email` issue + unique index will fail on duplicates |
| `000005_truth_sync_cycle.sql` | cron job `refresh-revenue-genome` + immediate sync function | `COMMENT ON JOB` is invalid SQL; cascading failure from 000004 |

### 2.5 Overwritten File (1 — CRITICAL)

| File | Main Version | Worktree Version | Impact |
|:-----|:-------------|:-----------------|:-------|
| `tool-definitions.ts` | 441 lines, 19 tools, working | 79 lines, 4 tools, broken references | **Merging this destroys all 3 AI agents** |

**What was deleted:** `lead_control`, `sales_flow_control`, `get_success_stories`, `intelligence_control`, `command_center_control`, `stripe_forensics`, `callgear_control`, `callgear_live_monitor`, `meta_ads_analytics`, `universal_search`, `location_control`, `aws_data_query`, `system_error_audit`, `run_sql_query`, `test_api_connections`, `marketing_truth_engine`

**What was added (keep these concepts):**
- `client_read_lite` tool definition — a read-only Lisa-safe subset of `client_control`
- `ATLAS_FULL_ACCESS` set — role-based access control concept for Atlas agent

### 2.6 Documentation Files (reusable)

| File | Lines | Quality | Verdict |
|:-----|:------|:--------|:--------|
| `CONSTITUTIONAL_SALES_RUBRIC.md` | 36 | Good — clear lead scoring rubric | **KEEP — good business logic reference** |
| `STAGING_PROGRESS.md` | 34 | Misleading — marks incomplete work as done | **REPLACE with this document** |

---

## 3. GEMINI HANDOVER ERRORS (7 Factual Mistakes)

| # | Handover Claim | Reality |
|:--|:---------------|:--------|
| 1 | "If conflicts occur in `App.tsx`, force-overwrite" | **No `App.tsx` exists.** Routing lives in `src/main.tsx`. |
| 2 | Sprint 1 is "100% COMPLETE" | **~40% done.** Files exist but migrations are broken, types not generated, pages not routed. |
| 3 | Sprint 2 is "60% COMPLETE" | **~20% done.** Task 2.2 (home_zone/gender) explicitly not done. Task 2.3 (Control Drawer) not implemented. |
| 4 | "Run migrations 000001-000005" | **All 5 will fail.** Column mismatches in `stripe_transactions`, `staff`, and `client_health_scores`. |
| 5 | "Map LISA to LISA_SAFE_TOOLS (must exclude revenue_intelligence)" | **Already done on main.** The worktree version actually BREAKS the existing working config. |
| 6 | Legacy files should be replaced 1:1 | Only 3 of 7 are genuine replacements. 4 are completely different pages (see Section 4). |
| 7 | STAGING_PROGRESS marks Task 1.1 (materialized view) as complete | The materialized view migration references non-existent columns and will not create. |

---

## 4. PAGE REPLACEMENT ANALYSIS

The handover claims 3 legacy pages should be replaced. Here's the truth:

### Genuine Upgrades (keep both concepts, merge features)

| Existing Page | Enterprise Page | Overlap | Recommendation |
|:-------------|:----------------|:--------|:---------------|
| `AIBusinessAdvisor.tsx` (real data, Gemini AI scripts) | `AIAdvisor.tsx` (100% mock) | HIGH — same domain | **Keep existing**, cherry-pick UI design from enterprise |
| `Observability.tsx` (real AI metrics from `ai_execution_metrics`) | `SystemObservability.tsx` (100% mock) | HIGH — same domain | **Keep existing**, add enterprise UI concepts on top |
| `AIKnowledge.tsx` (real data from `knowledge_base` table) | `KnowledgeBase.tsx` (100% mock) | HIGH — same domain | **Keep existing**, cherry-pick vector search UI concept |

### NOT Replacements (different domains entirely)

| Existing Page | Enterprise Page | Why NOT a replacement |
|:-------------|:----------------|:---------------------|
| `Operations.tsx` (HubSpot, calls, automation, settings) | `SystemObservability.tsx` | Operations = business ops; Observability = technical metrics. Different concerns. |
| `SetterActivityToday.tsx` (daily setter call/booking tracking) | `AIAdvisor.tsx` | Setter page tracks daily sales activity; AIAdvisor generates AI recommendations. |
| `YesterdayBookings.tsx` (yesterday's booking outcomes) | `CallAnalytics.tsx` | Bookings = downstream results; Call analytics = upstream metrics. |
| `ReconciliationDashboard.tsx` (AWS vs HubSpot alignment) | `EnterpriseStrategy.tsx` | Reconciliation = data alignment tool; Strategy = business intelligence. |

### Critical Difference: Existing Pages Have REAL Data

**Every existing page uses real Supabase queries.** Every enterprise page (except EnterpriseStrategy) uses 100% hardcoded mock data. The existing pages are MORE production-ready than their proposed replacements.

---

## 5. DEPENDENCY GRAPH

```
Enterprise Feature Dependencies
================================

EnterpriseStrategy.tsx
  ├── ReconciliationService.ts
  │     ├── mv_enterprise_truth_genome (MATVIEW — migration 000004)
  │     │     ├── stripe_transactions (BROKEN: needs customer_email fix)
  │     │     ├── attribution_events ✓
  │     │     ├── call_records ✓
  │     │     └── contacts ✓
  │     └── view_segment_capacity_hud (VIEW — migration 000003)
  │           ├── staff (BROKEN: needs home_zone, gender, full_name→name)
  │           └── client_health_scores (BROKEN: needs coach_name→assigned_coach)
  ├── DashboardHeader (exists on main ✓)
  ├── Badge, Tabs, Progress, Button (shadcn ✓)
  └── Routes in main.tsx (MISSING — not wired)

CreativeDNACard.tsx
  ├── Card, Badge (shadcn ✓)
  ├── TrendingUp (NOT IMPORTED — build error)
  └── No data dependencies (props-driven)

LeadDetailDrawer.tsx
  ├── Sheet (shadcn ✓)
  ├── EnterpriseLeadDNA interface (from ReconciliationService ✓)
  ├── References lead.avg_call_min (NOT in interface — bug)
  └── Hardcoded ad thumbnail URL (pipeboard.com API)

RevenueGenomeTable.tsx
  ├── Table (shadcn ✓)
  ├── EnterpriseLeadDNA interface (from ReconciliationService ✓)
  ├── Zap icon (NOT IMPORTED — build error)
  └── Hardcoded ad thumbnail URL (pipeboard.com API)

tool-definitions.ts (OVERWRITE)
  ├── BREAKS: ptd-agent-gemini (imports tools + LISA_SAFE_TOOLS)
  ├── BREAKS: ptd-agent-atlas (imports tools + LISA_SAFE_TOOLS)
  ├── BREAKS: aisensy-orchestrator (imports tools + LISA_SAFE_TOOLS)
  ├── BREAKS: ai-ceo-master (imports tools)
  └── BREAKS: ptd-ultimate-intelligence (imports tools)
```

---

## 6. WHAT'S GENUINELY GOOD & REUSABLE

### Tier 1: Use As-Is (minor fixes only)

| Asset | Why It's Good | Fix Needed |
|:------|:-------------|:-----------|
| `CONSTITUTIONAL_SALES_RUBRIC.md` | Clear lead scoring logic for Gemini prompts | None — documentation |
| `ReconciliationService.ts` interfaces | `EnterpriseLeadDNA` and `SegmentCapacity` types are well-designed | Remove `as any` after types regen |
| `ATLAS_FULL_ACCESS` concept | Role-based tool access control for Atlas agent | Add to main's tool-definitions.ts (don't replace) |
| `client_read_lite` tool concept | Lisa-safe read-only client access | Add to main's tool-definitions.ts (don't replace) |

### Tier 2: Good Design, Needs Wiring

| Asset | Why It's Good | Work Needed |
|:------|:-------------|:------------|
| `EnterpriseStrategy.tsx` | Only page with real data flow, good service layer pattern | Fix imports, add missing tab content, wire route |
| `ReconciliationService.ts` methods | Clean async pattern, Promise.all parallelism | Fix migrations so views actually exist, replace `as any` |
| `CreativeDNACard.tsx` | Rich props interface, good capacity visualization | Fix missing TrendingUp import |
| `RevenueGenomeTable.tsx` | Clean table component, verdict color coding | Fix missing Zap import |
| `LeadDetailDrawer.tsx` | Good Sheet-based detail panel pattern | Fix `avg_call_min` reference, remove hardcoded ad data |

### Tier 3: UI Shells Only (need complete data layer)

| Asset | Design Value | Work Needed |
|:------|:-------------|:------------|
| `CallAnalytics.tsx` | Layout concept for call metrics | Replace all mock data with real queries, fix 2 import errors |
| `AIAdvisor.tsx` | Intervention queue concept | Replace mock data, integrate with ptd-agent-gemini |
| `SystemObservability.tsx` | System health layout concept | Replace mock data, query ai_execution_metrics |
| `ClientHealth.tsx` | Master-detail health view concept | Replace mock data, query client_health_scores, fix 3 import errors |
| `CoachPerformance.tsx` | Coach capacity heatmap concept | Replace mock data, needs staff table fixes first |
| `KnowledgeBase.tsx` | Vector search UI concept | Replace mock data, integrate knowledge_base + embeddings |

---

## 7. MIGRATION FIX GUIDE (All 5 Need Rewrites)

### Migration 000001 & 000002 & 000004: Fix `stripe_transactions.customer_email`

**Problem:** `stripe_transactions` has `customer_id` (Stripe ID like `cus_xxx`), not `customer_email`.

**Fix:** Join through `known_cards` table:
```sql
-- BEFORE (broken):
SELECT customer_email, SUM(amount) as verified_cash
FROM stripe_transactions WHERE status = 'succeeded'
GROUP BY customer_email

-- AFTER (correct):
SELECT kc.customer_email, SUM(st.amount) as verified_cash
FROM stripe_transactions st
JOIN known_cards kc ON kc.stripe_customer_id = st.customer_id
WHERE st.status = 'succeeded'
GROUP BY kc.customer_email
```

### Migration 000003: Fix staff + client_health_scores columns

| Wrong Column | Correct Column | Table |
|:------------|:---------------|:------|
| `staff.full_name` | `staff.name` | `staff` |
| `staff.home_zone` | Does NOT exist — **must add via new migration** | `staff` |
| `staff.gender` | Does NOT exist — **must add via new migration** | `staff` |
| `staff.aws_coach_id` | May not exist — **verify with production** | `staff` |
| `client_health_scores.coach_name` | `client_health_scores.assigned_coach` | `client_health_scores` |

**Requires prerequisite migration:**
```sql
-- Add missing columns to staff table BEFORE creating capacity views
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS home_zone TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS gender TEXT;
```

These columns will be NULL until `aws-backoffice-sync` is updated to populate them (Task 2.2 from STAGING_PROGRESS).

### Migration 000004: Fix unique index on duplicates

**Problem:** `contact_id` won't be unique if a contact has multiple attribution events.

**Fix:** Deduplicate in the CTE:
```sql
-- Add DISTINCT ON or GROUP BY contact_id with aggregation
SELECT DISTINCT ON (c.id) ...
FROM contacts c
LEFT JOIN attribution_bridge ab ON ...
ORDER BY c.id, ab.created_at DESC
```

### Migration 000005: Remove invalid SQL

**Remove:** `COMMENT ON JOB 'refresh-revenue-genome'` — not valid PostgreSQL syntax.
**Add:** `SELECT cron.unschedule('refresh-revenue-genome')` guard before `cron.schedule()`.

---

## 8. EXECUTION PLAN (Strict Order)

### Phase 1: Safe Cherry-Pick (No Database Changes)

**DO NOT merge the worktree branch.** Instead, cherry-pick individual files.

| Step | Action | Risk | Verify |
|:-----|:-------|:-----|:-------|
| 1.1 | Copy `CONSTITUTIONAL_SALES_RUBRIC.md` — already on main | None | Exists ✓ |
| 1.2 | Copy `src/services/enterprise/ReconciliationService.ts` from worktree to main | Low | `npx tsc --noEmit` (will fail until migrations exist — expected) |
| 1.3 | Copy `src/components/dashboard/cards/CreativeDNACard.tsx` — fix `TrendingUp` import | Low | Build check |
| 1.4 | Copy `src/components/dashboard/drawers/LeadDetailDrawer.tsx` — fix `avg_call_min` | Low | Build check |
| 1.5 | Copy `src/components/dashboard/tables/RevenueGenomeTable.tsx` — fix `Zap` import | Low | Build check |
| 1.6 | Copy `src/pages/EnterpriseStrategy.tsx` — fix imports + `indicatorClassName` | Low | Build check |
| 1.7 | Add route for EnterpriseStrategy in `src/main.tsx` | Low | Navigate to route |
| 1.8 | **DO NOT copy `tool-definitions.ts`** from worktree | CRITICAL | Verify main's version unchanged |

### Phase 2: Add New Tool Concepts to Main's tool-definitions.ts

| Step | Action |
|:-----|:-------|
| 2.1 | Add `client_read_lite` tool definition to the existing `tools` array |
| 2.2 | Add `ATLAS_FULL_ACCESS` Set export (referencing existing tool names) |
| 2.3 | Verify `LISA_SAFE_TOOLS` still has all 6 tools |
| 2.4 | Deploy: `supabase functions deploy ptd-agent-gemini ptd-agent-atlas aisensy-orchestrator` |
| 2.5 | Verify all 3 agents still work |

### Phase 3: Fix and Deploy Migrations

| Step | Action | Dependency |
|:-----|:-------|:-----------|
| 3.0 | Create prerequisite migration: `ALTER TABLE staff ADD COLUMN home_zone, gender` | None |
| 3.1 | Rewrite migration 000001 — fix `customer_email` join through `known_cards` | 3.0 |
| 3.2 | Rewrite migration 000002 — same fix | 3.0 |
| 3.3 | Rewrite migration 000003 — fix `full_name→name`, `coach_name→assigned_coach`, use new columns | 3.0 |
| 3.4 | Rewrite migration 000004 — fix `customer_email` + deduplicate for unique index | 3.1-3.3 |
| 3.5 | Rewrite migration 000005 — remove `COMMENT ON JOB`, add unschedule guard | 3.4 |
| 3.6 | `supabase db push` | 3.0-3.5 |
| 3.7 | Run GRANT: `GRANT SELECT ON public.mv_enterprise_truth_genome TO service_role` | 3.6 |
| 3.8 | Regenerate types: `npx supabase gen types typescript --project-id ztjndilxurtsfqdsvfds > src/integrations/supabase/types.ts` | 3.6 |
| 3.9 | Update ReconciliationService to remove `as any` casts | 3.8 |

### Phase 4: Wire Remaining Pages (Optional — Mock Data Pages)

Only proceed if you want the UI shells. Each needs real data integration:

| Page | Data Source to Wire | Existing Page to Consider |
|:-----|:-------------------|:-------------------------|
| `CallAnalytics.tsx` | `call_records` table, `callgear_control` edge function | Complement to `YesterdayBookings.tsx`, not a replacement |
| `AIAdvisor.tsx` | `ptd-agent-gemini` edge function | Overlaps with `AIBusinessAdvisor.tsx` — pick one |
| `SystemObservability.tsx` | `ai_execution_metrics` table | Overlaps with `Observability.tsx` — merge features |
| `ClientHealth.tsx` | `client_health_scores` table | New page, no overlap |
| `CoachPerformance.tsx` | `staff` + `client_health_scores` tables | Needs `home_zone`/`gender` populated first (Task 2.2) |
| `KnowledgeBase.tsx` | `knowledge_base` + `knowledge_chunks` tables | Overlaps with `AIKnowledge.tsx` — merge features |

### Phase 5: aws-backoffice-sync Update (Task 2.2)

| Step | Action |
|:-----|:-------|
| 5.1 | Add `home_zone` and `gender` columns to AWS RDS query in `aws-backoffice-sync/index.ts` |
| 5.2 | Map RDS coach data to Supabase `staff` table (write home_zone, gender) |
| 5.3 | Deploy: `supabase functions deploy aws-backoffice-sync` |
| 5.4 | Trigger sync and verify: `SELECT home_zone, gender FROM staff WHERE home_zone IS NOT NULL` |

---

## 9. ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VITAL SUITE ARCHITECTURE                     │
│                    (Post-Enterprise Integration Target)                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─── FRONTEND (React 19 + Vite) ──────────────────────────────────┐ │
│  │                                                                   │ │
│  │  Pages (43 existing + 1-7 new enterprise)                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │ │
│  │  │ Executive    │  │ Revenue      │  │ EnterpriseStrategy   │   │ │
│  │  │ Overview     │  │ Intelligence │  │ (NEW — real data)    │   │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘   │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │ │
│  │  │ Marketing    │  │ Attribution  │  │ 6 Mock Pages         │   │ │
│  │  │ Analytics    │  │ Leaks        │  │ (Optional Phase 4)   │   │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘   │ │
│  │                                                                   │ │
│  │  Shared Components                                                │ │
│  │  ┌────────────────────────────────────────────────────────────┐  │ │
│  │  │ layout/DashboardHeader ✓  cards/MetricCard ✓               │  │ │
│  │  │ cards/DataTableCard ✓     cards/ChartCard ✓                │  │ │
│  │  │ cards/CreativeDNACard NEW  drawers/LeadDetailDrawer NEW    │  │ │
│  │  │ tables/RevenueGenomeTable NEW  shared/StatusBadge ✓        │  │ │
│  │  └────────────────────────────────────────────────────────────┘  │ │
│  │                                                                   │ │
│  │  Services                                                         │ │
│  │  ┌────────────────────────────────────────────────────────────┐  │ │
│  │  │ enterprise/ReconciliationService.ts NEW                    │  │ │
│  │  │   → getEnterpriseDNA()    → getRevenueLeaks()              │  │ │
│  │  │   → getPredictiveShadow() → getSegmentHUD()                │  │ │
│  │  └────────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                              │                                         │
│                              ▼                                         │
│  ┌─── SUPABASE (Backend) ───────────────────────────────────────────┐ │
│  │                                                                   │ │
│  │  Database Layer (Postgres)                                        │ │
│  │  ┌────────────────────────────────────────────────────────────┐  │ │
│  │  │ Tables (existing):                                          │  │ │
│  │  │  contacts, deals, call_records, stripe_transactions,       │  │ │
│  │  │  attribution_events, staff, client_health_scores,          │  │ │
│  │  │  knowledge_base, knowledge_chunks, ai_execution_metrics    │  │ │
│  │  │                                                              │  │ │
│  │  │ NEW Views (after migration fixes):                          │  │ │
│  │  │  view_atlas_lead_dna          — Lead + Creative + Revenue   │  │ │
│  │  │  view_enterprise_truth_genome — Full 5-source reconcile     │  │ │
│  │  │  view_coach_capacity_load     — Per-coach session load      │  │ │
│  │  │  view_segment_capacity_hud    — Zone/gender aggregation     │  │ │
│  │  │                                                              │  │ │
│  │  │ NEW Materialized View:                                      │  │ │
│  │  │  mv_enterprise_truth_genome   — Cached reconciliation       │  │ │
│  │  │  (refreshed every 15 min via pg_cron)                       │  │ │
│  │  └────────────────────────────────────────────────────────────┘  │ │
│  │                                                                   │ │
│  │  Edge Functions (143 existing)                                    │ │
│  │  ┌────────────────────────────────────────────────────────────┐  │ │
│  │  │ AI Agents:                                                   │  │ │
│  │  │  ptd-agent-gemini   (LISA + full tools)                     │  │ │
│  │  │  ptd-agent-atlas    (ATLAS + full tools)                    │  │ │
│  │  │  aisensy-orchestrator (WhatsApp + LISA_SAFE_TOOLS)          │  │ │
│  │  │                                                              │  │ │
│  │  │ Tool Security (tool-definitions.ts):                        │  │ │
│  │  │  19 tools (KEEP ALL) + client_read_lite (NEW)               │  │ │
│  │  │  LISA_SAFE_TOOLS: 6 tools (existing, working)               │  │ │
│  │  │  ATLAS_FULL_ACCESS: 5 tools (NEW role set)                  │  │ │
│  │  │                                                              │  │ │
│  │  │ Data Sync:                                                   │  │ │
│  │  │  aws-backoffice-sync (needs home_zone/gender update)        │  │ │
│  │  └────────────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌─── EXTERNAL ─────────────────────────────────────────────────────┐ │
│  │  AWS RDS (Backoffice) → coaches, packages, sessions             │ │
│  │  HubSpot CRM → contacts, deals, pipeline                        │ │
│  │  Stripe → payments, subscriptions, known_cards                   │ │
│  │  Meta Ads → creatives, campaigns, attribution                    │ │
│  │  CallGear → call_records, recordings                             │ │
│  │  Gemini AI → 4-tier cascade (3-flash → 2.0-flash → 1.5 → 3-pro)│ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. RISK MATRIX

| Risk | Severity | Mitigation |
|:-----|:---------|:-----------|
| Merging `tool-definitions.ts` as-is | **CRITICAL** — breaks all AI agents | Cherry-pick only; ADD new concepts to existing file |
| Running migrations as-is | **HIGH** — all 5 will fail on column mismatches | Rewrite all 5 with correct column names |
| Replacing Operations/SetterActivity/YesterdayBookings | **HIGH** — loses production functionality | Keep existing pages; add enterprise pages as NEW routes |
| Mock data pages shipped as "production" | **MEDIUM** — misleading users | Either wire real data or clearly mark as "Preview" |
| `select('*')` in ReconciliationService | **MEDIUM** — against project conventions (Batch 6 fixed this) | Replace with explicit column selects |
| `as any` type casts | **LOW** — acceptable until types are regenerated | Fix after `supabase gen types` |

---

## 11. UPDATED SPRINT STATUS (Corrected)

| Sprint | Gemini Claimed | Actual Status | Remaining Work |
|:-------|:---------------|:--------------|:---------------|
| Sprint 1: Revenue Genome | 100% | **25%** | Fix 3 migrations, deploy, regen types, wire route |
| Sprint 2: Operational Command | 60% | **15%** | Fix capacity migration, update aws-backoffice-sync, implement Control Drawer |
| Sprint 3: Security & Orchestration | 20% | **10%** | LISA firewall works on main; need cron cycle after migrations; Playwright audit |

---

*This document supersedes STAGING_PROGRESS.md as the source of truth for the enterprise upgrade.*
