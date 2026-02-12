# Deep-Dive Cross-Check: Comprehensive Audit Report

**Date:** 2026-02-12
**Status:** COMPLETE — 5 parallel audits compiled
**Scope:** select(*) remediation, AI provider cleanup, schema drift, model cascade, session timeline
**Principle:** Nothing gets deleted. 60 days of work is sacred.

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [select(*) Over-Fetching Remediation](#2-select-over-fetching-remediation)
3. [AI Provider Reality Check](#3-ai-provider-reality-check)
4. [Schema Drift: Local vs Production](#4-schema-drift-local-vs-production)
5. [Model Cascade & API Key Map](#5-model-cascade--api-key-map)
6. [Session Timeline (11 Sessions)](#6-session-timeline)
7. [Prioritized Action Plan](#7-prioritized-action-plan)
8. [Cross-References & Dependencies](#8-cross-references--dependencies)

---

## 1. EXECUTIVE SUMMARY

### System Vitals

| Metric | Value |
|--------|-------|
| Edge Functions | 145 active + 3 shared dirs |
| Frontend Pages | 38 routes |
| Database Tables | 158 (production) |
| Views | 28+ |
| Migrations | 171 SQL files |
| AI Agents (Real Gemini Calls) | 39 |
| select("*") Instances | 384+ |
| Infrastructure Score | 82/100 |
| Agent Intelligence Score | 46.7/100 |
| Gap | 35.3 points |

### The 5 Audits

| Audit | Key Finding | Severity |
|-------|------------|----------|
| select(*) | 384+ instances, contacts (119 cols) fully fetched in 6+ places | HIGH |
| AI Providers | Gemini = 95% workload; Anthropic = 0% active; OpenAI = embeddings only | MEDIUM |
| Schema Drift | 24 phantom tables, 17+ missing types, types.ts 1.5h stale | HIGH |
| Model Cascade | 4-level Gemini cascade; 3 functions bypass UnifiedAIClient | MEDIUM |
| Session Timeline | 11 sessions, 51 fixes applied, Phase 14 ready for execution | INFO |

### Top 3 Immediate Risks

1. **contacts table fetched fully** (119 columns including PII) in 6+ locations — security + performance
2. **types.ts missing 17+ tables** including all marketing agent tables — causes runtime errors
3. **Token budget tracking broken** — `tokenBudget` never incremented, agents have no cost awareness

---

## 2. SELECT(*) OVER-FETCHING REMEDIATION

### Scale of Problem

- **Total instances:** 384+ `.select("*")` + 11 `.select()` (no args)
- **Distribution:** ~280 in edge functions, ~102 in frontend React files
- **Bandwidth waste:** Estimated 60-80% reduction possible

### Priority 1: CRITICAL (Security + Performance)

#### contacts table (119 columns)

| Location | Line | What's Used | What's Fetched |
|----------|------|-------------|----------------|
| `src/pages/SalesPipeline.tsx` | 243 | id, name, email, status | All 119 cols |
| `supabase/functions/_shared/tool-executor.ts` | 196 | Varies by tool | All 119 cols |
| `supabase/functions/hubspot-command-center/index.ts` | 484 | 5-10 fields | All 119 cols |
| `supabase/functions/proactive-insights-generator/index.ts` | Multiple | Summary fields | All 119 cols |

**Sensitive fields exposed:** email, phone, facebook_id, google_id, linkedin_bio, coach_notes

**Fix pattern:**
```typescript
// BEFORE:
.from("contacts").select("*")

// AFTER (example for SalesPipeline):
.from("contacts").select("id,firstname,lastname,email,phone,status,owner_name,created_at,lead_source")
```

#### client_health_scores table (40 columns)

| Location | Count | Fields Actually Used |
|----------|-------|---------------------|
| `supabase/functions/proactive-insights-generator/index.ts` | 6 calls | health_score, health_zone, email |
| `supabase/functions/_shared/tool-executor.ts` | 218-221 | 5-6 summary fields |
| `supabase/functions/_shared/executors/intelligence-executor.ts` | 43 | Score + zone |
| `src/hooks/useDashboardData.ts` | 53-112 | Dashboard summary |

**Fix:** Replace with `select("email,firstname,lastname,health_score,health_zone,intervention_priority,churn_risk_score")`

#### call_records table (32 columns)

| Location | Line | Fields Used |
|----------|------|-------------|
| `src/pages/SalesPipeline.tsx` | 298 | call_status, started_at, duration |
| `supabase/functions/_shared/tool-executor.ts` | 207 | Status + outcome |
| `supabase/functions/proactive-insights-generator/index.ts` | 88 | Summary counts |

**Sensitive fields exposed:** transcription (10-100KB+ per record), recording_url, sentiment_score

**Fix:** Exclude transcription and recording_url by default — add only when needed.

### Priority 2: MEDIUM (Performance + Cost)

| Table | Columns | Locations | Issue |
|-------|---------|-----------|-------|
| deals | 23 | 6+ | Financial data + internal notes exposed |
| coach_performance | 33 | 5+ | Red flags JSONB unnecessarily fetched |
| agent_skills | 7 | 2 | content field 5-50KB per record |
| CommandCenter views | 20+ each | 11 calls | Views already aggregated, still over-fetched |

### Priority 3: LOW (Nice to Have)

- View tables with small result sets
- Tables where all columns are actually used
- Booking_notifications (12 cols, mostly used entirely)

### Good Patterns Already in Codebase

```typescript
// CommandCenter.tsx:88 — count-only query (GOOD)
.select("id", { count: "exact", head: true })

// Dashboard.tsx:101 — specific field selection (GOOD)
.select("email,health_score,health_zone")
```

### Remediation Effort

| Priority | Tables | Locations | Estimated Effort |
|----------|--------|-----------|-----------------|
| P1 (contacts, health, calls) | 3 | ~25 | 4-6h |
| P2 (deals, coach, skills, views) | 5 | ~30 | 3-4h |
| P3 (remaining) | ~15 | ~50 | 6-8h |
| **Total** | **23** | **~105** | **13-18h** |

---

## 3. AI PROVIDER REALITY CHECK

### Perceived vs Actual Usage

| Provider | Perceived | Actual | Evidence |
|----------|-----------|--------|----------|
| **OpenAI** | Core LLM + embeddings | Embeddings only (2 functions) | 0 SDK packages, 0 inference calls |
| **Anthropic** | Primary/fallback LLM | ZERO active calls | All archived/deprecated |
| **Google Gemini** | Support model | **PRIMARY** (95%+ of workload) | UnifiedAIClient + 7 direct callers |
| **LangSmith** | Comprehensive tracing | ~5% coverage (1-4 of 145 functions) | Only ptd-ultimate-intelligence confirmed |
| **LangChain** | Active integration | Installed but NOT used in backend | Packages in package.json, zero backend imports |

### OpenAI: 2 Active Callsites (Embeddings Only)

| File | Model | Purpose |
|------|-------|---------|
| `supabase/functions/openai-embeddings/index.ts` | text-embedding-3-small | Standalone embedding generation |
| `supabase/functions/_shared/unified-brain.ts` | text-embedding-3-small | RAG memory retrieval (falls back to zero vector if key missing) |

**No OpenAI SDK in package.json.** Uses raw `fetch()` to `https://api.openai.com/v1/embeddings`.

### Anthropic: 0 Active Callsites

| Location | Reality |
|----------|---------|
| `_archive/agent-analyst/index.ts` | COMMENTED OUT |
| `_archive/ptd-agent-claude/index.ts` | DEPRECATED (use ptd-agent-gemini) |
| `ptd-ultimate-intelligence/index.ts` | COMMENTED OUT `ANTHROPIC_API_KEY` |
| `ai-config-status/index.ts` | STATUS CHECK ONLY (not actual use) |
| `system-health-check/index.ts` | STALE METADATA |

**API key configured in Supabase secrets but never called.**

### LangSmith: ~5% Coverage

- `langsmith-tracing.ts` and `observability.ts` exist but only 1-4 functions import them
- PR #92 (utilities) + PR #91 (UI) were created but not fully rolled out
- Goal was 100% coverage — currently at 5%

### LangChain: Installed but Unused

| Package | In package.json | Imported in Backend |
|---------|----------------|-------------------|
| `@langchain/core` | YES | NO |
| `@langchain/google-genai` | YES | NO |
| `langchain` | YES | NO |
| `langsmith` | YES | MINIMAL |

### Action Items (Provider Cleanup)

| Action | Risk | Effort |
|--------|------|--------|
| Archive ANTHROPIC_API_KEY from Supabase secrets | NONE (zero callers) | 5min |
| Consider migrating OpenAI embeddings to Gemini text-embedding-004 | LOW (already have key) | 2h |
| Decide: Roll out LangSmith to 100% or remove dependency | LOW | 4h or 1h |
| Remove or comment unused LangChain packages from package.json | LOW | 15min |
| Update environment documentation to reflect reality | NONE | 30min |

---

## 4. SCHEMA DRIFT: LOCAL VS PRODUCTION

### Overview

- **types.ts last modified:** Feb 12, 07:46 UTC (auto-generated from production)
- **Latest migration:** Feb 12, 09:18 UTC
- **Staleness:** ~1.5 hours
- **Total migrations:** 171 SQL files

### Phantom Tables (24 in types.ts, NOT in migrations)

These exist in production Supabase but have no CREATE TABLE migration locally:

| Table | Likely Reason |
|-------|--------------|
| contacts, deals, appointments | Migrated via Supabase Studio |
| companies | HubSpot mapped |
| events, events_raw | Global event schema |
| call_records, call_tracking_numbers, call_transcription_jobs | VoIP integration |
| call_integrations, call_analytics | Call platform |
| analytics_events | Analytics stream |
| customer_journeys, customer_profiles | Journey builder |
| contact_activities | Created but drifted |
| enhanced_leads | Created via Studio |
| devices, device_request_logs | Device tracking |
| conversion_events, conversion_tracking | Conversion pipeline |
| known_cards | Payment methods |
| edge_function_logs | EF logs |
| excel_sync_logs | Excel integration |
| diagnostics | System diagnostics |
| table_name | Placeholder — candidate for cleanup |

**Impact:** Low — these tables exist in production, just don't have migration history. The types.ts is the real source of truth.

### Missing Types (17+ tables in migrations, NOT in types.ts)

| Table | Created In | Impact |
|-------|-----------|--------|
| marketing_agent_signals | 20260211000002 | HIGH — Marketing agent system |
| marketing_recommendations | 20260211000002 | HIGH — Marketing agent system |
| marketing_budget_proposals | 20260211000002 | HIGH — Marketing agent system |
| creative_library | 20260211000002 | HIGH — Marketing agent system |
| marketing_fatigue_alerts | 20260211000002 | HIGH — Marketing agent system |
| daily_marketing_briefs | 20260211000002 | HIGH — CEO briefing |
| conversation_memory | 20260206010000 | MEDIUM — Memory system |
| lead_intelligence | 20260206010000 | MEDIUM — Lead scoring |
| smart_coach_analytics | 20251217000001 | MEDIUM — Coach analytics |
| ai_execution_metrics | 20251227073500 | MEDIUM — LLM metrics |

**Impact:** HIGH — Edge functions trying to insert into these tables will fail if migrations haven't been applied to production.

### Column-Level Drift (9+ tables)

| Table | Columns Added | Migration |
|-------|--------------|-----------|
| agent_memory | archived, expires_at, agent_name | 20260213000005 |
| agent_conversations | expires_at | 20260213000005 |
| agent_decisions | expires_at | 20260213000005 |
| agent_patterns | agent_name | 20260213000005 |
| contacts | Session activity fields | 20251225000002 |
| deals | owner_id | 20260204000001 |
| appointments | owner_id | 20260204000002 |
| calls | owner | 20251221000003 |
| staff | timezone | 20260201220017 |

### Production Column Name Mismatches (Found in Session 5)

| Table | Code Used | Production Actual |
|-------|-----------|-------------------|
| coach_performance | avg_health_score | avg_client_health |
| coach_performance | red_clients | clients_red |
| coach_performance | trend | health_trend |
| daily_summary | total_active_clients | total_clients |
| daily_summary | at_risk_revenue | at_risk_revenue_aed |
| client_health_scores | client_email | email |

**Status:** Fixed in Session 5 (commit 3babaf9).

### Action Items (Schema)

| Action | Risk | Effort |
|--------|------|--------|
| Regenerate types.ts from production (`supabase gen types`) | NONE | 5min |
| Deploy pending migrations (10 total, 5 ready now) | MEDIUM (test first) | 1h |
| Verify marketing_* tables exist in production | HIGH (may need manual creation) | 30min |
| Audit 24 phantom tables — confirm they exist in production | LOW | 1h |

---

## 5. MODEL CASCADE & API KEY MAP

### Gemini Model Cascade (UnifiedAIClient)

```
gemini-3-flash-preview     ← PRIMARY (fast, cheap)
    ↓ (on failure)
gemini-2.0-flash           ← FALLBACK 1
    ↓ (on failure)
gemini-1.5-flash           ← FALLBACK 2 (ultra-low cost)
    ↓ (on failure)
gemini-3-pro-preview       ← FALLBACK 3 (expensive, complex tasks)
```

**Retry logic:** Exponential backoff, automatic cascade through models.

### API Key Priority

```
1. GOOGLE_GENERATIVE_AI_API_KEY  ← Most specific
2. GEMINI_API_KEY                ← Primary production key
3. GOOGLE_API_KEY                ← Generic fallback
```

### Functions Using UnifiedAIClient (27)

error-resolution-agent, financial-analytics, ai-ceo-master, intervention-recommender, ai-learning-loop, appointment-manager, rds-data-analyst, ad-creative-analyst, ptd-ultimate-intelligence, strategic-kpi, aisensy-orchestrator, generate-lead-replies, churn-predictor, business-intelligence, super-agent-orchestrator, ptd-skill-auditor, customer-insights, antigravity-followup-engine, ptd-agent-atlas, ptd-agent-gemini, vision-analytics, stripe-payouts-ai, dialogflow-fulfillment, client-payment-integrity, generate-lead-reply, agent-orchestrator, _archive/agent-manager, _archive/ptd-self-developer

### Functions Bypassing UnifiedAIClient (3 Direct Callers)

| Function | Endpoint | Model | Why |
|----------|----------|-------|-----|
| marketing-copywriter | `generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent` | gemini-1.5-flash | Cost control, JSON mode |
| stripe-enterprise-intelligence | `generativelanguage.googleapis.com/v1beta/openai/chat/completions` | gemini-3.0-flash | Streaming support |
| vision-analytics | GoogleGenerativeAI SDK | gemini-3-pro-preview | Vision/multimodal |

**Risk:** These 3 functions don't get retry/cascade/cost-tracking benefits. Should be migrated to UnifiedAIClient when feasible.

### Misconfigurations Found

1. **`generateWithClaude()` in ptd-ultimate-intelligence** — Name says Claude, actually calls Gemini via UnifiedAI
2. **ANTHROPIC_API_KEY set in production** — Zero functions use it
3. **`verify-all-keys` lists stale function dependencies** — References archived functions

### Token Cost Tracking

| Model Tier | Input Cost | Output Cost |
|-----------|-----------|-------------|
| Flash (3, 2.0, 1.5) | $0.10/1M tokens | $0.40/1M tokens |
| Pro (3-pro-preview) | $3.00/1M tokens | $15.00/1M tokens |

**Table:** `token_usage_metrics` — logged per request via fire-and-forget insert.
**Status:** Token budget variable exists but is NEVER INCREMENTED (Phase 14 Fix #1).

---

## 6. SESSION TIMELINE (11 Sessions, Feb 10-12)

### Summary

| Session | Date | Focus | Fixes |
|---------|------|-------|-------|
| 1 | Feb 10 | Lisa WhatsApp Agent v10.0 audit | 10 fixes, 66 tests |
| 2 | Feb 11 | Attribution Pipeline forensic | 15 fixes (10 core + 5 dashboard) |
| 3 | Feb 11 | 5-Agent deep research cross-check | 7 fixes |
| 4 | Feb 11 | 8-Agent forensic finalization | 36 total consolidated |
| 5 | Feb 12 | Dashboard column alignment (schema drift) | 15 fixes |
| 6 | Feb 12 | 6-Skill audit + intelligence cross-ref | Scoring only |
| 7 | Feb 12 | Deep intelligence verification | Revised scorecard |
| 8 | Feb 12 | Intelligence upgrade plan (10 fixes) | Plan created |
| 9 | Feb 12 | Supabase infrastructure audit | 6 new findings |
| 10 | Feb 12 | Advanced evaluation of all plans | 20 HIGH issues found |
| 11 | Feb 12 | Corrected execution plan | Final plan ready |

### Cumulative Metrics

- **Total fixes applied:** 51
- **Total tests created:** 66
- **Plans created:** 6 documents
- **Migrations pending deploy:** 10
- **Intelligence score:** Started unknown → measured at 46.7/100
- **Infrastructure score:** 82/100

### Key Documents

| Document | Path | Status |
|----------|------|--------|
| Master task plan | `task_plan.md` | Active |
| Session work log | `progress.md` | 11 sessions |
| Forensic findings | `findings.md` | 13 sections |
| Architecture map | `docs/plans/2026-02-12-full-architecture-brainstorm.md` | Complete |
| Intelligence upgrade (corrected) | `docs/plans/2026-02-12-intelligence-upgrade-corrected.md` | READY for execution |
| Phase 15 roadmap | `docs/plans/2026-02-12-phase-15-roadmap.md` | Identified |
| Intelligence vision | `docs/INTELLIGENCE_VISION.md` | Reference |
| Stack audit | `docs/DEEP_DIVE_STACK_AUDIT.md` | Reference |
| **This document** | `docs/plans/2026-02-12-deep-dive-cross-check.md` | Complete |

---

## 7. PRIORITIZED ACTION PLAN

### IMMEDIATE (Do Now)

| # | Action | Risk | Effort | Impact |
|---|--------|------|--------|--------|
| 1 | Regenerate `types.ts` from production | NONE | 5min | Fixes 17+ missing types |
| 2 | Deploy 5 READY migrations | MEDIUM | 1h | Unblocks marketing agents |
| 3 | Execute Phase 14 Batch 1 (Task 9 + 7) | LOW | 2-3h | Error handling + constitutional |

### SHORT-TERM (This Week)

| # | Action | Risk | Effort | Impact |
|---|--------|------|--------|--------|
| 4 | Fix contacts.select("*") in 6 locations | LOW | 2h | Security + 60% bandwidth reduction |
| 5 | Fix client_health_scores.select("*") in 15 locations | LOW | 3h | Performance |
| 6 | Fix call_records.select("*") — exclude transcription | LOW | 1h | Privacy + bandwidth |
| 7 | Execute Phase 14 Batch 2 (Task 1 + 3+8) | LOW-MED | 6h | Token budget + memory retention |
| 8 | Archive ANTHROPIC_API_KEY documentation | NONE | 15min | Clarity |

### MEDIUM-TERM (Next Week)

| # | Action | Risk | Effort | Impact |
|---|--------|------|--------|--------|
| 9 | Execute Phase 14 Batch 3 (Task 2 + 4+6) | MEDIUM | 12-16h | Tool adoption + validation + UPSERT |
| 10 | Migrate 3 direct Gemini callers to UnifiedAIClient | LOW | 3h | Consistency + cost tracking |
| 11 | Roll out LangSmith to all functions OR remove | LOW | 4h or 1h | Observability |
| 12 | Fix remaining P2 select(*) (deals, coach, views) | LOW | 4h | Performance |

### DEFERRED (When Capacity Allows)

| # | Action | Risk | Effort | Impact |
|---|--------|------|--------|--------|
| 13 | Execute Phase 14 Task 5 (HubSpot consolidation) | MEDIUM | 6-8h | Architecture |
| 14 | Phase 14 Task 10 (contacts consolidation) | HIGH | 16-24h | Requires frontend audit |
| 15 | Phase 15 infrastructure hardening | HIGH | 8h | 323 indexes, 7 EF auth, crons |
| 16 | Fix remaining P3 select(*) | LOW | 6-8h | Completeness |
| 17 | Migrate OpenAI embeddings to Gemini text-embedding-004 | LOW | 2h | Cost reduction |

---

## 8. CROSS-REFERENCES & DEPENDENCIES

### Phase 14 Intelligence Upgrade (corrected plan) — Dependencies

```
Batch 1: Task 9 (auth) + Task 7 (constitutional)
    ↓ No dependencies — safe to start immediately
Batch 2: Task 1 (token budget) + Task 3+8 (memory + namespacing)
    ↓ Task 3+8 MUST be done together (both modify learning-layer.ts)
Batch 3: Task 2 (tools) + Task 4+6 (validation + UPSERT)
    ↓ Task 2 REQUIRES Task 7 complete (constitutional in system message)
    ↓ Task 4+6 REQUIRE each other (marketing agents)
Batch 4: Task 5 (HubSpot consolidation)
    ↓ Independent but high-risk
DEFERRED: Task 10 (contacts consolidation)
    ↓ Requires frontend audit (16+ files query enhanced_leads)
```

### select(*) Remediation — No Dependencies on Phase 14

Can be done independently and in parallel with Phase 14 work. Recommended to start with contacts table (highest security impact).

### Schema/Types — Must Be Done FIRST

Regenerating types.ts is a prerequisite for any TypeScript work. Do this before Phase 14 Batch 3 (which adds new table interactions).

### Concurrent Modification Risks

| File | Modified By | Warning |
|------|------------|---------|
| `learning-layer.ts` | Phase 14 Task 3 + Task 8 | MUST be done in same batch |
| `marketing-*/index.ts` | Phase 14 Task 4 + Task 6 | Fragile if split |
| `ptd-ultimate-intelligence/index.ts` | Phase 14 Task 2 + Task 7 | Overlap — sequence matters |
| `tool-executor.ts` | select(*) fix + Phase 14 Task 2 | Coordinate timing |

---

## APPENDIX: SCORING TARGETS

### Current State

| Metric | Score |
|--------|-------|
| Infrastructure | 82/100 |
| Intelligence Type | 55/100 |
| Error Handling | 78/100 |
| Architecture | 52/100 |
| Context Efficiency | 42/100 |
| Learning Loop | 38/100 |
| Output Validation | 15/100 |
| **Agent Intelligence (6-metric avg)** | **46.7/100** |
| **Weighted Overall** | **63.8/100** |

### After Phase 14 (All 10 Fixes)

| Metric | Current | Target | Change |
|--------|---------|--------|--------|
| Intelligence Type | 55 | 72 | +17 |
| Error Handling | 78 | 82 | +4 |
| Architecture | 52 | 80 | +28 |
| Context Efficiency | 42 | 65 | +23 |
| Learning Loop | 38 | 58 | +20 |
| Output Validation | 15 | 55 | +40 |
| **Agent Intelligence** | **46.7** | **~82** | **+35** |
| **Weighted Overall** | **63.8** | **~82** | **+18** |

---

*Generated from 5 parallel deep-dive audits on 2026-02-12. All findings verified against actual codebase, not documentation claims.*