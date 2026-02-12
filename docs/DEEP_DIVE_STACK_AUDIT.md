# Deep Dive Stack Audit — Vital Suite
## DB Root to UI Leaf: Full Connection Analysis

**Date:** 2026-02-12
**Method:** 5 parallel audit agents scanning every layer simultaneously
**Scope:** 169 migrations, 143 edge functions, 210 TSX components, 6,851-line types.ts

---

## The Verdict: "Flying Blind" Confirmed — With Nuance

The codebase has **excellent engineering in isolated layers** but **near-zero type safety connecting them**. The compiler cannot protect the codebase because every layer-boundary uses `as any` to cross.

```
┌──────────────────────────────────────────────────────────┐
│  LAYER 4: UI Surface     ⚠️ FUNCTIONAL but FRAGILE       │
│  ┌────────────────────────────────────────────────────┐  │
│  │  14 useState<any>  │  0 React.lazy  │  0 zod      │  │
│  └────────────────────────────────────────────────────┘  │
│                          ↕  props: any                    │
│  LAYER 3: State Engine   ✅ EXCELLENT mechanism           │
│  ┌────────────────────────────────────────────────────┐  │
│  │  useDedupedQuery ✓  │  30+ real mutations          │  │
│  │  1/17 optimistic    │  8 realtime subscriptions    │  │
│  └────────────────────────────────────────────────────┘  │
│                          ↕  as any × 107                  │
│  LAYER 2: Bridge (Types) ❌ BROKEN                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │  6,851 lines generated │ 0 lines used by app       │  │
│  │  apiClient: invoke<any> │ 6 views MISSING           │  │
│  └────────────────────────────────────────────────────┘  │
│                          ↕  loosely typed JSON            │
│  LAYER 1: Foundation     ✅ STRONG                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │  169 migrations  │  143 EFs  │  RPCs + Views       │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Layer 1: The Foundation (Supabase) — GRADE: A

**Status: STRONG**

| Metric | Value |
|--------|-------|
| Total migrations | 169 files |
| Earliest | `20240210000000_agent_tasks.sql` |
| Latest | `20260213000006_marketing_upsert_keys.sql` |
| Edge functions | 143 (all deploy clean) |
| Complex VIEWs | 21 (campaign funnels, attribution, health) |
| RPCs | 40+ defined |
| Index strategy | Composite + partial WHERE indexes on JOIN columns |

**What's Done Right:**
- Complex logic correctly pushed to SQL (get_dashboard_stats, dynamic_funnel_view, campaign_full_funnel)
- Constitutional framing on 17+ agents
- UnifiedAIClient with Gemini 3 Flash + cascading fallback
- Agentic loops with MAX_LOOPS=3, MAX_TOOL_RESULT_CHARS=3000

**Risk:**
- Edge Functions return loosely typed JSON the client trusts blindly
- `mapDealFields()` outputs columns (`owner_id`, `owner_name`) that may not exist in the deals table schema
- 3 different column names for the same concept: `contact_id` (mapper) vs `lead_id` (types.ts) vs `hubspot_contact_id` (SQL JOINs)

---

## Layer 2: The Bridge (Types & API) — GRADE: F

**Status: BROKEN — The "Golden Thread" is severed**

### 2.1 types.ts: Generated but Ignored

| What | Count | Status |
|------|-------|--------|
| File size | 6,851 lines | Generated |
| Tables defined | 122 | Complete |
| Views defined | 15 of 21 | **6 MISSING** |
| Functions/RPCs | 40 | Mostly complete |
| **Times referenced by app code** | **0** | **UNUSED** |

**6 Critical Views Missing from types.ts:**

| View | Migration Source | Used By |
|------|-----------------|---------|
| `campaign_full_funnel` | `20260213000001` | CommandCenter.tsx |
| `adset_full_funnel` | `20260213000002` | CommandCenter.tsx |
| `ad_creative_funnel` | `20260213000002` | CommandCenter.tsx |
| `lead_full_journey` | `20260213000002` | CommandCenter.tsx |
| `cold_leads` | `20260213000001` | CommandCenter.tsx |
| `upcoming_assessments` | `20260213000001` | CommandCenter.tsx |

**Also Missing:** `token_usage_metrics` table, 7 facebook_ads_insights expansion columns (video_p25, quality_ranking, etc.)

### 2.2 apiClient.ts: The Untyped Bridge

**File:** `src/services/apiClient.ts` (47 lines)

| Line | Code | Issue |
|------|------|-------|
| 8 | `ApiResponse<T = any>` | Default generic = any |
| 17 | `invoke<T = any>` | Default generic = any |
| 19 | `body: any = {}` | Completely untyped input |
| 33 | `data as T` | Runtime cast, no validation |
| 34 | `catch (err: any)` | Untyped error |

**Impact:** Any Edge Function can be invoked with any payload. Zero compile-time protection.

### 2.3 The `as any` Epidemic: 107 Instances

**Top 10 Worst Files:**

| Rank | File | Count | Pattern |
|------|------|-------|---------|
| 1 | `src/hooks/use-ceo-data.ts` | 15 | Table name + RPC + data casts |
| 2 | `src/hooks/useDeepIntelligence.ts` | 11 | View queries + array casts |
| 3 | `src/pages/Overview.tsx` | 9 | RPC calls + component props |
| 4 | `src/components/ptd/DataEnrichmentTab.tsx` | 8 | Table queries + chained casts |
| 5 | `src/pages/SkillCommandCenter.tsx` | 5 | Array + audit data casts |
| 6 | `src/components/ptd/CAPITab.tsx` | 5 | CAPI events + automation logs |
| 7 | `src/components/ai/AIAssistantPanel.tsx` | 5 | RPC + insight data |
| 8 | `src/pages/Coaches.tsx` | 4 | Supabase method escapes |
| 9 | `src/hooks/useDashboardData.ts` | 4 | View queries |
| 10 | `src/components/ptd/SettingsTab.tsx` | 4 | App settings queries |

**Three Dominant Anti-Patterns:**

```typescript
// Pattern 1: Table/View Name Escape (35+ instances)
.from("prepared_actions" as any)
// Root cause: types.ts missing the table/view definition

// Pattern 2: RPC Method Escape (15+ instances)
const { data } = await (supabase as any).rpc("get_dashboard_stats")
// Root cause: RPC not properly typed in Supabase client

// Pattern 3: Data Type Assertion (40+ instances)
const lossData = (lossRes.data || []) as any[];
// Root cause: Can't infer element types from query results
```

### 2.4 The `<any>` Generic Params: 14 Instances

| File | Line | Code |
|------|------|------|
| `SalesPipeline.tsx` | 37 | `useState<any>(null)` — selectedDeal |
| `Overview.tsx` | 45 | `useState<any>(null)` — errorDetails |
| `SkillCommandCenter.tsx` | 78 | `useState<any>(null)` — testResult |
| `Interventions.tsx` | 26 | `useState<any>(null)` — selectedIntervention |
| `AIBusinessAdvisor.tsx` | 31 | `useState<any>(null)` — selectedClient |
| `MillionDollarPanel.tsx` | 102 | `useState<any>(null)` — healthStatus |
| `VisionAnalysisWidget.tsx` | 22 | `useState<any>(null)` — result |
| `BrainVisualizer.tsx` | 15 | `useState<any>(null)` — stats |
| `EnhancedInterventionTracker.tsx` | 31 | `useState<any>(null)` |
| `CAPITab.tsx` | 31 | `useState<any>(null)` — payload |
| `ErrorMonitorPanel.tsx` | N/A | `useState<any[]>([])` |
| `DrawerContext.tsx` | N/A | `useState<any>(null)` |
| `DealsKanban.tsx` | 109 | `queryClient.getQueryData<any>()` |
| `VoiceChat.tsx` | 35 | `useRef<any>` |

### 2.5 Database Type Usage: ZERO

The `Database` type (Line 9 of types.ts) is **never imported** by any application file. Not a single hook, page, or component references `Database['public']['Tables']` or `Database['public']['Views']`.

**Bridge Layer Score: 0/100** — Types exist but provide zero protection.

---

## Layer 3: The State Engine (TanStack Query) — GRADE: B+

**Status: EXCELLENT mechanism, DANGEROUS payloads**

### 3.1 Custom Hooks: 21 Total

| Hook | Typed? | Issue |
|------|--------|-------|
| `useDedupedQuery` | **FULL GENERICS** | Excellent — properly wraps useQuery |
| `useClientHealthScores` | **TYPED** | Uses `useDedupedQuery<{data, count}>` |
| `use-ceo-data` | **15× as any** | Worst offender in codebase |
| `useDeepIntelligence` | **11× as any** | View queries all untyped |
| `useDashboardData` | **4× as any** | View queries |
| `useVitalState` | OK | Relies on inference |
| Other 15 hooks | MIXED | Varying quality |

### 3.2 Mutations: ALL 30+ Are Real

Every `useMutation` in the codebase calls a real Supabase function or RPC. **Zero toast-only mutations** found in hooks (the dead buttons are in JSX onClick handlers, not mutation hooks).

| Category | Count | Examples |
|----------|-------|---------|
| Edge Function invocations | 22 | ai-ceo-master, sync-hubspot, health-calculator |
| Direct Supabase operations | 8 | prepared_actions.update, notifications.update |
| Toast-only (fake) | 0 | — |

### 3.3 Real-Time Subscriptions: 8 Active

| Component | Tables Monitored | Status |
|-----------|-----------------|--------|
| `useVitalState` | 8 tables (health, deals, contacts, calls, etc.) | Hub pattern |
| `useRealtimeHealthScores` | 4 tables | Comprehensive |
| `SalesPipeline.tsx` | 3 tables (calls, leads, deals) | Good |
| `ProactiveInsightsPanel` | proactive_insights | Simple |
| `NotificationCenter` | notifications (INSERT only) | Good |

**Missing Real-Time (should have):**
- StripeTreasuryTab — polling only
- DataEnrichmentTab — no subscription
- QuickActionsPanel — direct calls only

### 3.4 Optimistic Updates: 1 of 17

| Mutation | onMutate | onError Rollback | Status |
|----------|----------|-----------------|--------|
| `DealsKanban.updateStageMutation` | YES | YES (previousDeals) | COMPLETE |
| **All other 16 mutations** | NO | Partial (error toast) | MISSING |

**DealsKanban is the gold standard** — properly cancels queries, snapshots previous state, rolls back on error. The other 16 mutations rely on cache invalidation (slower UX).

### 3.5 QueryClient Configuration

```
staleTime:     5 min          ✓ Reasonable
retry:         3 (queries)    ✓ Good
retryDelay:    Exp backoff    ✓ Excellent
gcTime:        Default (5m)   ⚠️ Implicit
Persistor:     NONE           ❌ No offline support
ErrorHandler:  ErrorDetective ✓ Centralized
```

---

## Layer 4: The UI Surface — GRADE: C

**Status: FUNCTIONAL but FRAGILE**

### 4.1 Component Prop Typing

| Component | Props Typed? | Evidence |
|-----------|-------------|----------|
| `DealsKanban.tsx` | **PROPERLY TYPED** | `Deal[]` interface from dealsApi |
| `Dashboard.tsx` | **MOSTLY TYPED** | `DashboardStats` interface defined, 2 any casts |
| `CommandCenter.tsx` | **MEDIUM** | Period type defined, query data loosely typed |
| `SalesPipeline.tsx` | **MIXED** | `useState<any>(null)` for selectedDeal |
| `SalesTabs.tsx` | **ALL ANY** | 8 props, every one is `any` |

**SalesTabs.tsx** — worst typed component (lines 34-43):
```typescript
interface SalesTabsProps {
  funnelData: any;
  enhancedLeads: any[];
  contacts: any[];
  dealsData: any;
  callRecords: any;
  appointments: any;
  allLeads: any[];
  onDealClick?: (deal: any) => void;
}
```

### 4.2 Error Boundaries

| Scope | Exists? | Location |
|-------|---------|----------|
| Global (app-level) | YES | `main.tsx:184` wraps entire app |
| Layout content | YES | `Layout.tsx` wraps main area |
| Per-section (Dashboard) | NO | KPIGrid, Charts, Kanban unprotected |
| Per-section (CommandCenter) | NO | 9 independent tables unprotected |

**Risk:** A single bad data point in one chart crashes the ENTIRE page.

### 4.3 Code Splitting: ZERO

| Metric | Value |
|--------|-------|
| `React.lazy()` calls | 0 |
| `<Suspense>` for routes | 0 |
| Static page imports | 38 routes, all eager |
| Lazy loading anywhere | Only in DrawerContext (4 drawer components) |

**Exception:** `DrawerContext.tsx` lines 75-80 correctly lazy-loads drawer content — proving the pattern is known but not applied to routes.

### 4.4 Loading Pattern Schism

| Pattern | File Count | Standard? |
|---------|-----------|-----------|
| `"Loading..."` text | 15 files | NO — bare text |
| `<Loader2>` spinner | 10 files | YES — animated |
| `<Skeleton>` placeholder | 8 files | YES — content-aware |
| `isLoading` + manual | 27 files | YES — TanStack pattern |

**Most Common:** Plain `"Loading..."` text (CommandCenter has 9 instances alone).
**Best Practice:** SalesPipeline's Ghost component (skeleton that matches content shape).

### 4.5 Form Validation: NONE

| Library | Used? |
|---------|-------|
| Zod | NO |
| Yup | NO |
| react-hook-form resolvers | NO |
| Manual validation | Minimal regex only |

`react-hook-form` infrastructure exists in `src/components/ui/form.tsx` but is never used with a validation resolver. All forms submit directly to Supabase without client-side validation.

---

## 9-Phase Plan Completion Status

| Phase | Task | Status | Evidence |
|-------|------|--------|----------|
| **1** | Remote Audit (Supabase CLI) | PARTIAL | Audit reports exist, walkthrough.md missing |
| **2** | Local Audit (Filesystem) | DONE | POST_MORTEM_AUDIT.md (14,400 lines) |
| **3** | Solutions (Skill-Driven) | PARTIAL | SQL best-practices applied, no formal report |
| **4.1** | Audit cleanup migration | DONE | `20260212000000_audit_cleanup.sql` verified |
| **4.2** | Constitutional Framing | DONE | `ptd-ultimate-intelligence/index.ts:37` |
| **4.3** | UnifiedAIClient refactor | DONE | `ai-ceo-master/index.ts:22` |
| **5** | Frontend Deep Audit | PARTIAL | vercel.json verified, no audit report file |
| **6.1** | Move prompt-library.ts | DONE | No longer in src/ |
| **6.2** | Refactor ptd-memory.ts | NOT DONE | Still in `src/lib/ptd-memory.ts` |
| **7** | Deep 4-Skill Audit | NOT DONE | No DFII/FFCI scores generated |
| **8.1** | Migrate src/pages → features | PARTIAL | `src/features/` created (5 dirs), pages untouched |
| **8.2** | React.lazy + Suspense | NOT DONE | Zero lazy() calls in routing |
| **8.3** | Type hardening | PARTIAL | Dashboard 2 any, but 107 total remain |
| **9.1** | Deep-Dive Systemic Audit | PARTIAL | Forensic work done, not formally documented |
| **9.2** | Logic Core (dealsApi) | DONE | `dealsApi.ts` built and wired to DealsKanban |
| **9.3** | Unified Physics (Suspense) | NOT DONE | No global Suspense boundary |
| **9.4** | Global Drawer/HUD | DONE | `DrawerContext.tsx` with lazy-loaded content |
| **9.5** | Sales Pipeline Kanban | DONE | `KanbanBoard.tsx` + `DealsKanban.tsx` |
| **9.6** | Quick Actions CRM | DONE | Implemented across 4 components |

**Summary: 9 DONE / 4 PARTIAL / 5 NOT DONE**

---

## The "Red Flag" Density Map — Verified

| Layer | Component | Claimed | Verified | Detail |
|-------|-----------|---------|----------|--------|
| Transport | `apiClient.ts` | FAIL | **CONFIRMED FAIL** | `invoke<any>`, `body: any`, zero type inference |
| State | `use-ceo-data.ts` | RISK | **CONFIRMED CRITICAL** | 15 `as any` casts, not 'frequent' — epidemic |
| UI Logic | `SalesPipeline.tsx` | FAIL | **CONFIRMED FAIL** | `useState<any>`, dead Mark Won/Lost buttons |
| Schema | `types.ts` | STALE | **CONFIRMED STALE** | 6 views + 1 table + 7 columns missing |

**Additional Red Flags Not In Original Report:**

| Layer | Component | Finding |
|-------|-----------|---------|
| State | `useDeepIntelligence.ts` | 11 `as any` — second worst file |
| UI | `SalesTabs.tsx` | ALL 8 props typed as `any` — worst component |
| UI | Error boundaries | Per-section boundaries missing — one crash = full page down |
| UI | Code splitting | 0 lazy routes — 38 pages loaded upfront |
| UI | Form validation | 0 zod/yup — forms submit unvalidated |
| Schema | deals table | 3 different column names for contact FK |
| Schema | mapDealFields | Sends `owner_id`, `owner_name` — may not exist in table |
| Engine | Optimistic updates | 1 of 17 mutations use onMutate |

---

## The Fix Priority Matrix

### Tier 0: Prerequisite (unlocks everything)

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 1 | **Regenerate types.ts** (`supabase gen types typescript`) | 5 min | Adds 6 views + token_usage_metrics + fb_ads columns |
| 2 | **Verify deals schema** (owner_id/owner_name columns) | 15 min | Confirms mapDealFields won't silently drop data |

### Tier 1: Stop Flying Blind (Type Safety)

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 3 | Eliminate `as any` in use-ceo-data.ts (15 casts) | 1h | Typed CEO queries |
| 4 | Eliminate `as any` in useDeepIntelligence.ts (11 casts) | 1h | Typed intelligence queries |
| 5 | Type SalesTabs.tsx props (8 any → interfaces) | 30 min | Compile-time safety on pipeline |
| 6 | Type apiClient.ts invoke (Zod at boundary) | 1h | Every EF call validated |
| 7 | Replace remaining 80 `as any` casts | 4h | Full type coverage |

### Tier 2: Wire Dead Buttons

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 8 | Wire Mark Won/Lost → dealsApi.updateDealStage() | 30 min | Sales pipeline functional |
| 9 | Pass onMoveCard to KanbanBoard in Dashboard | 15 min | Drag-drop works |
| 10 | Fix 6 dead buttons (AutomationTab, QuickActions, Tracker) | 1h | No dead ends |

### Tier 3: Unified Physics

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 11 | Create PageSkeleton component | 30 min | Standard loading |
| 12 | Replace 15 "Loading..." text with PageSkeleton | 1h | Consistent UX |
| 13 | Add React.lazy to 38 routes | 1h | Smaller initial bundle |
| 14 | Add per-section ErrorBoundary on Dashboard, CommandCenter | 1h | Crash isolation |

### Tier 4: Production Hardening

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 15 | Add optimistic updates to 16 remaining mutations | 3h | Instant UI feedback |
| 16 | Add Zod validation to all forms | 2h | Client-side safety |
| 17 | Refactor ptd-memory.ts to server-side | 2h | Security fix |
| 18 | Add Content-Security-Policy header | 30 min | XSS prevention |
| 19 | Deploy 6 pending migrations to production | 30 min | Schema parity |

---

## Score Card

| Layer | Component | Score | Grade |
|-------|-----------|-------|-------|
| L1 Foundation | Supabase Schema | 92/100 | A |
| L1 Foundation | Edge Functions | 88/100 | A- |
| L2 Bridge | types.ts coverage | 72/100 | C |
| L2 Bridge | Type utilization | 0/100 | F |
| L2 Bridge | apiClient safety | 10/100 | F |
| L3 Engine | useDedupedQuery | 100/100 | A+ |
| L3 Engine | Mutations (real) | 100/100 | A+ |
| L3 Engine | Real-time | 80/100 | B+ |
| L3 Engine | Optimistic updates | 6/100 | F |
| L4 Surface | Prop typing | 30/100 | F |
| L4 Surface | Error boundaries | 50/100 | D |
| L4 Surface | Code splitting | 5/100 | F |
| L4 Surface | Loading UX | 35/100 | D |
| L4 Surface | Form validation | 5/100 | F |
| **OVERALL** | **Weighted Average** | **47/100** | **D+** |

**Reading:** The Foundation and Engine are A-grade. The Bridge and Surface are F-grade. The system is a Ferrari engine bolted to a paper chassis.

---

## Appendix: Full File Index

**Files Audited (with line-level evidence):**
- `src/integrations/supabase/types.ts` (6,851 lines)
- `src/services/apiClient.ts` (47 lines)
- `src/hooks/use-ceo-data.ts` (15 as any)
- `src/hooks/useDeepIntelligence.ts` (11 as any)
- `src/hooks/useDedupedQuery.ts` (full generics)
- `src/pages/SalesPipeline.tsx` (dead buttons + any state)
- `src/pages/Dashboard.tsx` (2 any, missing onMoveCard)
- `src/pages/CommandCenter.tsx` (9 Loading... strings)
- `src/components/sales-pipeline/SalesTabs.tsx` (8 any props)
- `src/components/sales-pipeline/DealsKanban.tsx` (properly typed)
- `src/components/ErrorBoundary.tsx` (global only)
- `src/features/sales-operations/api/dealsApi.ts` (wired to Kanban)
- `src/main.tsx` (QueryClient config, 38 static routes)
- `src/contexts/DrawerContext.tsx` (lazy-loaded drawers)
- `supabase/functions/_shared/hubspot-manager.ts` (mapDealFields)
- `supabase/functions/_shared/constitutional-framing.ts` (verified)
- `supabase/functions/_shared/unified-ai-client.ts` (verified)
- `supabase/functions/ptd-ultimate-intelligence/index.ts` (verified)
- `supabase/functions/ai-ceo-master/index.ts` (verified)
- 169 migration files (counted)
- `vercel.json` (security headers verified)
- `findings.md` (830 lines, systemic audit)
- `progress.md` (756 lines, session log)
- `task_plan.md` (435 lines, phased plan)
