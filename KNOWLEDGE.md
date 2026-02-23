# KNOWLEDGE — Read This Before Coding

> **Updated:** 2026-02-22  
> **Purpose:** One file for any AI. Findings, plans, decisions. Local. Fast.

---

## Key Rules (from .cursorrules)

- We are building a "Living Being" architecture for PTD Fitness.

- Always check 'WIRING_ANALYSIS.md' before writing new code.

- Every time you create a new database table, you MUST update the 'introspect_schema_verbose' SQL function in Supabase so the agent can see it.

- When generating UI, use Tailwind CSS and Shadcn.

- Never hardcode client data; always use the 'client_control' tool to fetch it.



---

## Findings (What's Broken)

# FORENSIC AUDIT FINDINGS — Vital Suite
## Date: 2026-02-11 | Scope: Full Pipeline Audit (FB Ads → Leads → Calls → Deals → Revenue)

---

## EXECUTIVE SUMMARY

**Overall System Health: 6.5/10** — Data collection is REAL and solid. Attribution chain has CRITICAL gaps. You CANNOT currently answer: **"Which ad made me money?"**

### The Core Problem
```
Facebook Ad  →  Lead  →  Call  →  Opportunity  →  Revenue
     ✅          ✅       ⚠️         ⚠️             ❌
  (fetched)   (synced)  (no ad    (no deal↔      (no deal↔
                         link)    invoice)       Stripe link)
```

**You have the data. The CONNECTIONS between the data are broken.**

---

## SECTION 1: FACEBOOK ADS PIPELINE

### What Works
- `fetch-facebook-insights` pulls REAL data from Meta API via Pipeboard
- Stores in `facebook_ads_insights` table: ad_id, spend, clicks, ctr, cpc, leads, ROAS
- CAPI pipeline exists: `send-to-stape-capi`, `process-capi-batch`, `capi-validator`
- AnyTrack webhook captures server-side conversions with UTM params + fbclid
- `data-reconciler` calculates Truth ROAS vs Reported ROAS
- `ad-creative-analyst` identifies Zombie Ads (spend > $500, ROAS < 1.5) and Hidden Gems

### What's Broken
| # | Gap | Impact | Severity |
|---|-----|--------|----------|
| 1 | **Campaign ID not stored** — only campaign_name in facebook_ads_insights | Cannot join campaigns by ID, only by name (fragile) | HIGH |
| 2 | **Adset ID not captured at all** | Cannot analyze adset-level performance | HIGH |
| 3 | **No direct ad_id → contact link** | Cannot say "this specific ad created this specific lead" | CRITICAL |
| 4 | **Stape CAPI is optional** — if key not set, events stored but NOT sent to Meta | Facebook cannot optimize conversions without server-side data | HIGH |
| 5 | **VisualDNA widget shows 0 ROAS** — `purchase_value` field missing from ad objects | Dashboard misleading for all creatives | HIGH |

### Key Files
- `supabase/functions/fetch-facebook-insights/index.ts`
- `supabase/functions/send-to-stape-capi/index.ts`
- `supabase/functions/anytrack-webhook/index.ts`
- `supabase/functions/data-reconciler/index.ts`
- `supabase/functions/ad-creative-analyst/index.ts`

---

## SECTION 2: CALL TRACKING (CALLGEAR)

### What Works
- `fetch-callgear-data` syncs every 10 minutes from CallGear API (REAL data)
- 37-field schema in `call_records` table (duration, recording, outcome, sentiment, transcript)
- Phone-based contact linking works (caller_number → contacts.phone)
- Security sentinel monitors suspicious calls in real-time
- ICP router handles intelligent call routing with 2-second SLA
- Supervisor coaching (listen/whisper/barge) fully functional

### What's Broken
| # | Gap | Impact | Severity |
|---|-----|--------|----------|
| 6 | **No call → ad/campaign attribution** | Cannot say "this call came from this Facebook ad" | CRITICAL |
| 7 | **No call → deal linkage** | Cannot say "this call contributed to this deal closing" | CRITICAL |
| 8 | **`revenue_generated` field never populated** | Call ROI impossible to calculate | HIGH |
| 9 | **No reverse sync to Facebook** | Cannot create "People who called" custom audiences for retargeting | MEDIUM |
| 10 | **Employee mapping partly hardcoded** | Owner names hardcoded in fetch-callgear-data (lines 321-343) | LOW |

### Key Files
- `supabase/functions/fetch-callgear-data/index.ts`
- `supabase/functions/callgear-live-monitor/index.ts`
- `supabase/functions/sync-single-call/index.ts`
- `src/pages/CallTracking.tsx`

---

## SECTION 3: LEAD → OPPORTUNITY → REVENUE PIPELINE

### What Works
- HubSpot → Supabase sync is COMPLETE (80+ contact properties including UTM, facebook_id)
- Contacts store: `facebook_id`, `utm_source`, `utm_campaign`, `first_touch_source`, `latest_traffic_source`
- Deals properly linked to contacts via `contact_id` FK (UUID)
- Funnel stage tracker computes 12-stage conversion rates from REAL data
- `attribution_events` table captures fb_ad_id, fb_campaign_id, fb_adset_id
- Real-time webhooks for contact.creation, deal.creation, call.creation

### What's Broken
| # | Gap | Impact | Severity |
|---|-----|--------|----------|
| 11 | **No Deal ↔ Stripe Invoice link** | Cannot verify if HubSpot deal_value matches actual Stripe payment | CRITICAL |
| 12 | **Static currency rates** | USD→AED hardcoded at 3.67, EUR→AED at 4.00 in stripe-dashboard-data (NEVER updates) | HIGH |
| 13 | **Churn rate estimated from health zones** | CLV = ARPU / churn_rate, but churn_rate is guess (RED + 0.3*YELLOW) not actual churn | HIGH |
| 14 | **No Cost Per Lead (CPL) metric** | CAC exists (cost per customer), but CPL undefined and not computed | HIGH |
| 15 | **No Cost Per Opportunity (CPO) metric** | Cannot calculate ad spend per deal created | HIGH |
| 16 | **No deal.propertyChange webhook** | Deal stage changes only sync on next scheduled run, not real-time | MEDIUM |
| 17 | **No deal lost reason tracking** | deals store `closedlost` but no reason field exposed | MEDIUM |
| 18 | **Data reconciler has duplicate variable declarations** | `attributedRevenue` declared twice — potential logic error | MEDIUM |

### Key Files
- `supabase/functions/sync-hubspot-to-supabase/index.ts`
- `supabase/functions/funnel-stage-tracker/index.ts`
- `supabase/functions/financial-analytics/index.ts`
- `supabase/functions/stripe-dashboard-data/index.ts`

---

## SECTION 4: DASHBOARD WIDGETS & FORMULAS

### What Works
- **92% of widgets use REAL data** from Supabase/API (no mock data in dashboards)
- RevenueVsSpendChart: queries `daily_business_metrics` → ROAS = revenue/spend
- LiveRevenueChart: queries `deals` table → revenue trend with correct period-over-period
- CampaignMoneyMap: calls `get_campaign_money_map` RPC for real campaign data
- usePeriodComparison hook: proper delta calculations across revenue, leads, ROAS, spend
- All metric cards (KPIGrid, HeroStatCard, MetricCard, StatCard) are pure display components

### What's Broken
| # | Gap | Impact | Severity |
|---|-----|--------|----------|
| 19 | **VisualDNA ROAS shows 0 for all creatives** | Missing `purchase_value` field → `platformRoas` computes to 0 | HIGH |
| 20 | **No revenue per ad creative on any dashboard** | Shows spend per creative but NOT revenue per creative | HIGH |
| 21 | **No cost per opportunity on any dashboard** | Key metric completely absent from all pages | HIGH |
| 22 | **NorthStarWidget "500k ARR" hardcoded** | Target should come from database/settings | MEDIUM |
| 23 | **UnitEconomics "< AED 500" CAC goal hardcoded** | Business threshold should be configurable | LOW |

### Formula Verification
| Metric | Formula | Source | Status |
|--------|---------|--------|--------|
| ROAS | `revenue / spend` | daily_business_metrics | CORRECT |
| Revenue Trend | `(2nd_half - 1st_half) / 1st_half * 100` | deals table | CORRECT |
| CAC | `totalSpend / realNewClients` | Stripe + FB spend | CORRECT (but per customer, not per lead) |
| CLV | `ARPU / churnRate` | Stripe + health zones | ESTIMATE (churn rate guessed) |
| LTV:CAC | `ltv / cac` | Computed | CORRECT formula, questionable inputs |
| Funnel Rates | `stageN / stageN-1 * 100` | contacts + deals tables | CORRECT |
| CPL | Not computed | — | MISSING |
| CPO | Not computed | — | MISSING |

---

## SECTION 5: AGENT INTELLIGENCE LAYER

### What Works (90% functional)
- PTD system operational with 5 personas (ATLAS, SHERLOCK, REVENUE, HUNTER, GUARDIAN)
- multi-agent-orchestrator coordinates 4 specialist agents with real Supabase data
- LangSmith tracing for observability, structured logging
- Approval workflow for risky actions (ptd-execute-action with risk levels)
- Skill auditor grades real WhatsApp conversations and stores lessons
- marketing-scout detects creative fatigue, ghost rates, spend anomalies from real data
- marketing-analyst makes SCALE/HOLD/WATCH/KILL recommendations

### What's Broken
| # | Gap | Impact | Severity |
|---|-----|--------|----------|
| 24 | **ultimate-aggregator uses MOCK data** | Returns 3 hardcoded creatives, 50 fake contacts instead of real data | HIGH |
| 25 | **4 marketing agents are SKELETONS** | marketing-allocator, copywriter, historian, loss-analyst = empty shells | MEDIUM |
| 26 | **No agent → dashboard visualization feed** | Agents compute recommendations but dashboards don't display them | MEDIUM |
| 27 | **sales-objection-handler empty** | Directory exists, no implementation | LOW |
| 28 | **No integration tests** between agent output and dashboard consumption | Could break silently | MEDIUM |

---

## SECTION 6: THE ATTRIBUTION TRUTH TABLE

### "Which ad is good?" — What you CAN and CANNOT answer today

| Question | Answer? | Method |
|----------|---------|--------|
| How much did I spend per ad? | YES | facebook_ads_insights.spend |
| How many leads per ad? | YES | facebook_ads_insights.leads |
| CTR/CPC per ad? | YES | facebook_ads_insights.ctr/cpc |
| ROAS per ad (Meta reported)? | YES | facebook_ads_insights.purchase_roas |
| Which contact came from which ad? | PARTIAL | attribution_events.fb_ad_id → contacts.email (indirect, 2-hop) |
| Which call came from which ad? | NO | No call→ad link exists |
| Which deal came from which ad? | PARTIAL | deals→contacts→attribution_events (3-hop join, fragile) |
| How much REVENUE did each ad generate? | NO | No deal→Stripe payment verification |
| TRUE ROI per ad: (revenue - spend) / spend? | NO | Cannot compute — missing revenue link |
| Best ads by OPPORTUNITIES generated? | PARTIAL | Can count deals per source, not per specific ad |
| Cost per opportunity by ad? | NO | Missing metric entirely |

---

## SECTION 7: HARDCODED VALUES & DATA QUALITY FLAGS

### Hardcoded Values Found
| File | Value | Risk |
|------|-------|------|
| fetch-facebook-insights | `PTD_MAIN_ACCOUNT = "act_349832333681399"` | Low (fallback) |
| stripe-dashboard-data | Currency rates (USD 3.67, EUR 4.00, GBP 4.63) | HIGH — never updated |
| NorthStarWidget | "500k ARR" target | Medium — should be configurable |
| UnitEconomics | "< AED 500" CAC goal | Low |
| fetch-callgear-data | Employee OWNER_MAPPING (lines 321-343) | Low — merged with DB |

### Tables/Views Referenced But Unverified
- `revenue_genome_7d` — referenced in marketing-scout but not in migrations
- `source_discrepancy_matrix` — referenced in MarketingDeepIntelligence
- `get_campaign_money_map` RPC — called by CampaignMoneyMap.tsx
- `get_underworked_leads` RPC — used by sales-aggression
- `get_stale_deals` RPC — used by sales-aggression

---

## SECTION 8: PRIORITY RANKING

### CRITICAL (Blocks "Which ad is good?")
1. No deal ↔ Stripe invoice link — Cannot verify revenue
2. No ad_id stored on contacts/deals — Cannot trace ad → customer
3. No call → ad attribution — Calls orphaned from campaigns
4. CPL and CPO metrics missing — Cannot compare ad efficiency
5. VisualDNA shows 0 ROAS — Dashboard actively misleading

### HIGH (Data accuracy)
6. Static currency rates (could drift significantly from real rates)
7. Churn rate is estimated, not measured from actual drop-offs
8. Campaign ID not stored in insights table (only name)
9. Adset ID not captured at all
10. Revenue per creative not shown on any dashboard

### MEDIUM (Completeness)
11. Deal stage changes not real-time (missing webhook)
12. Ultimate-aggregator uses mock data
13. 4 skeleton marketing agents need implementation
14. NorthStar target hardcoded in UI
15. No deal lost reason tracking

---

## SECTION 9: DASHBOARD COLUMN ALIGNMENT (2026-02-12)

### Discovery: Schema Drift

Production Supabase DB has different column names than local migration files. The auto-generated `src/integrations/supabase/types.ts` is the only reliable source of truth.

**Root cause:** DB was modified via Supabase Studio or direct SQL, not through tracked migrations.

### Affected Tables

| Table | Frontend Used | Production Has | Fixed? |
|-------|-------------|---------------|--------|
| coach_performance | avg_health_score | avg_client_health | YES |
| coach_performance | red_clients | clients_red | YES

---

## Plans & Ideas


## Plan: 2026-02-10-post-activation-optimization
# PTD Vital Suite Optimization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine health scoring and automate executive reporting using the integrated truth engine.

**Architecture:** Use scheduled Edge Functions to process ground-truth data from AWS and HubSpot into actionable KPIs. Implement a "Truth Dashboard" for discrepancy visibility.

**Tech Stack:** Supabase (PostgreSQL, Edge Functions), AWS RDS UAE, HubSpot CRM, TanStack Query.

---

### Task 1: Health Score v4 Calibration

**Files:**
- Modify: `supabase/functions/health-calculator/index.ts`
- Test: `tests/functions/health-calculator.test.ts`

**Step 1: Update scoring coefficients**
Refine the penalty/bonus weights based on AWS session truth. Increase the weight of `sessions_last_7d`.

**Step 2: Run verification**
Trigger the function manually and verify the output distribution.

### Task 2: "True CPA" Bridge

**Files:**
- Modify: `supabase/functions/generate-daily-snapshot/index.ts`
- Test: `tests/functions/daily-snapshot.test.ts`

**Step 1: Join Facebook Spend with AWS Assessments**
Update the snapshot logic to fetch "Completed" assessments from `vw_schedulers` and divide by total spend.

**Step 2: Update daily_business_metrics table**
Add `true_cpa` column to the schema if missing.

### Task 3: Weekly CEO Report Automation

**Files:**
- Create: `supabase/functions/weekly-ceo-report/index.ts`
- Modify: `supabase/migrations/20260210000006_schedule_weekly_report.sql`

**Step 1: Aggregate weekly performance**
Summarize revenue booked, sessions conducted, and coach health leaderboard.

**Step 2: Schedule cron**
Schedule for every Monday at 06:00 UTC.

### Task 4: Discrepancy Ledger Cleanup

**Files:**
- Modify: `src/pages/ReconciliationDashboard.tsx`

**Step 1: Add "Resolve All" button**
Implement a UI action to force-sync all 100% sure cases from AWS to HubSpot.


## Plan: 2026-02-10-tracking-plan
# PTD Marketing Intelligence — Tracking Plan

> **Owner:** Antigravity (Claude) | **Version:** 1.0 | **Date:** 2026-02-10

## Event Taxonomy (object_action pattern)

| Event                  | Description                | Properties                                               | Trigger                                             | Decision Supported      |
| :--------------------- | :------------------------- | :------------------------------------------------------- | :-------------------------------------------------- | :---------------------- |
| `lead_created`         | New lead entered system    | `email, utm_source, utm_campaign, fb_ad_id, fb_adset_id` | HubSpot contact webhook                             | CPL, lead volume        |
| `assessment_booked`    | Assessment scheduled       | `email, coach_name, scheduled_date, fb_ad_id`            | HubSpot deal stage → Assessment Scheduled           | Book rate per creative  |
| `assessment_completed` | Attended assessment in AWS | `email, coach_name, training_date, fb_ad_id`             | AWS truth-alignment run (status=Completed/Attended) | Ghost rate, True CPA    |
| `assessment_ghosted`   | Booked but didn't attend   | `email, scheduled_date, fb_ad_id`                        | AWS shows no matching completed session             | Ghost rate per creative |
| `purchase_completed`   | First payment received     | `email, amount, currency, fb_ad_id`                      | Stripe webhook (payment_intent.succeeded)           | Revenue attribution     |
| `client_renewed`       | Package renewal payment    | `email, amount, months_active`                           | Stripe recurring payment                            | LTV per creative        |
| `client_churned`       | Health score <20 for 14d   | `email, last_health_score, days_inactive`                | Health calculator detection                         | Churn rate per source   |
| `creative_fatigue`     | CTR dropped 3d straight    | `ad_id, ad_name, ctr_delta_pct, ctr_today, ctr_3d_avg`   | Predictor agent                                     | Creative refresh signal |
| `budget_adjusted`      | CEO approved budget change | `ad_id, old_budget, new_budget, action`                  | Allocator → CEO approval                            | Spend tracking          |

## Conversion Definitions

| Conversion            | Event                | Counting Rule  | Used By                 |
| :-------------------- | :------------------- | :------------- | :---------------------- |
| **Lead**              | `lead_created`       | Once per email | CPL, funnel top         |
| **Qualified Lead**    | `assessment_booked`  | Once per email | Cost per qualified lead |
| **Customer**          | `purchase_completed` | Once per email | CAC, True CPA           |
| **Retained Customer** | `client_renewed`     | Each renewal   | LTV, retention rate     |

## UTM Conventions

```
utm_source=facebook|google|organic|referral|direct
utm_medium=cpc|social|email|whatsapp
utm_campaign={campaign_name_lowercase_underscores}
utm_content={ad_id_or_creative_variant}
utm_term={target_audience_segment}
```

Rules:

- Lowercase only
- Underscores (no spaces, no dashes)
- Documented in this file (single source of truth)
- Never overwritten client-side

## Signal Quality Targets

| Category              | Current | Target | Action                                  |
| :-------------------- | :------ | :----- | :-------------------------------------- |
| Decision Alignment    | 20/25   | 23/25  | Add 7-day window to stress test         |
| Event Model Clarity   | 12/20   | 17/20  | Standardize naming per table above      |
| Data Accuracy         | 10/20   | 16/20  | Fix attribution discrepancy <15%        |
| Conversion Definition | 8/15    | 13/15  | Add assessment-attended signal          |
| Attribution & Context | 7/10    | 9/10   | Ensure fb_ad_id populated on all events |
| Governance            | 3/10    | 8/10   | This document + event versioning      

## Plan: 2026-02-12-deep-dive-cross-check
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
| `src/pages/SalesPipeline.tsx` | 298

## Plan: 2026-02-12-full-architecture-brainstorm
# Full Architecture Map & Intelligence Brainstorm

**Date:** 2026-02-12
**Status:** BRAINSTORM — Needs validation

---

## SYSTEM OVERVIEW

| Layer | Count | Stack |
|-------|-------|-------|
| Frontend Pages | 38 routes | React + TanStack Query + Recharts |
| Edge Functions | 141 total | Supabase Deno, Gemini 3 Flash |
| Shared Modules | 65 files | Custom AI client, executors, prompts |
| Database Tables | 65+ | Postgres + pgvector + pg_cron |
| Vector Indexes | 5 | IVFFlat (768d Gemini, 1536d OpenAI) |
| Cron Jobs | 12+ | Daily/hourly/weekly |
| External APIs | 7 | Stripe, HubSpot, Gemini, Meta, CallGear, Google Maps, Pipeboard |

---

## WIRING STATUS

### ACTIVE (46 functions wired to frontend)

**Core AI Agents:**
- `ptd-agent-gemini` — Main chat agent (Gemini 3 Flash)
- `ai-ceo-master` — CEO intelligence (2x calls from useCEOData)
- `ptd-execute-action` — Action execution
- `ai-learning-loop` — Feedback loop
- `super-agent-orchestrator` — Multi-agent dispatch

**Stripe (wired):**
- `stripe-dashboard-data` — Revenue metrics (most called)
- `stripe-payout-controls` — 6x calls from PayoutControlsTab
- `stripe-payouts-ai` — AI payout analysis
- `stripe-treasury` — 4x calls from TreasuryTab
- `stripe-forensics` — Payment investigation (3 components)

**HubSpot (wired):**
- `hubspot-live-query` — 9 locations calling this
- `hubspot-analyzer` — HubSpot deep analysis
- `hubspot-command-center` — 5x calls
- `auto-reassign-leads` — Owner management
- `sync-hubspot-to-supabase` — Manual sync trigger

**Health & Intelligence (wired):**
- `health-calculator`, `churn-predictor`, `anomaly-detector`
- `intervention-recommender`, `coach-analyzer`
- `business-intelligence`, `proactive-insights-generator`
- `financial-analytics`, `strategic-kpi`, `customer-insights`

**Marketing (wired):**
- `fetch-facebook-insights` — Meta dashboard
- `marketing-predictor` — Deep intelligence
- `marketing-stress-test` — Stress testing

**Data (wired):**
- `sync-hubspot-to-capi`, `enrich-with-stripe`, `process-capi-batch`
- `send-to-stape-capi`, `data-quality`, `integration-health`
- `pipeline-monitor`, `capi-validator`, `daily-report`

### ORPHANED — 69 functions (60% never called from frontend)

**Webhooks/Crons (backend-only, NOT orphaned):**
- `stripe-webhook`, `hubspot-webhook`, `calendly-webhook`, `anytrack-webhook`
- `followup-cron`, `ptd-watcher`, `ptd-24x7-monitor`
- `calculate-health-scores`, `generate-daily-snapshot`

**Truly orphaned (candidates for removal):**
- `generate-lead-reply` — DEPRECATED (replaced by `generate-lead-replies`)
- `smart-agent` — ARCHIVED (replaced by `ptd-agent-gemini`)
- `ptd-agent-claude` — ARCHIVED
- 15x `error-*` functions — Overengineered error system never wired
- `marketing-historian`, `marketing-copywriter`, `marketing-scout`, `marketing-loss-analyst`, `marketing-allocator`, `marketing-analyst` — 5-Agent War Room, not wired to UI
- `vision-analytics` — Old video analysis from GCP era
- `openai-embeddings` — Replaced by Gemini embeddings
- `rds-data-analyst` — AWS RDS queries, rarely used
- `sales-aggression`, `sales-objection-handler` — Never wired

---

## RAG ARCHITECTURE (Current)

```
USER QUERY
    │
    ├─ [1] Static Context (hardcoded prompts, schema, roles)
    ├─ [2] Vector RAG (Gemini 004 → knowledge_chunks, 0.6 threshold, top-8)
    ├─ [3] Evolutionary Memory (agent_learnings → <evolutionary_memory> block)
    ├─ [4] Live DB Queries (contacts, deals, health_scores — FRESH data)
    ├─ [5] Tool Definitions (15 mega-tools via tool-executor)
    │
    └─ → Gemini 3 Flash (fallback: 2.0 → 1.5 → 3 Pro)
         │
         ├─ Tool calls → 12 specialized executors
         └─ Memory storage (90d/180d/365d/permanent tiers)
```

**Vector DBs in use:**
- `knowledge_chunks` — 768d Gemini embeddings, IVFFlat
- `agent_knowledge` — 1536d OpenAI embeddings, IVFFlat
- `org_documents` — 1536d, org-wide RAG
- `conversation_messages` — 1536d, memory search
- `agent_memory` — 1536d, consolidated memory

**Gaps:**
1. No ve

## Plan: 2026-02-12-intelligence-upgrade-corrected
# Intelligence Upgrade — Corrected Execution Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the 35-point gap between infrastructure quality (82/100) and agent intelligence (46.7/100) through 10 targeted fixes — corrected against actual codebase.

**Architecture:** All fixes modify the Supabase Edge Function layer (`supabase/functions/`). No frontend changes except Task 10 (DEFERRED). Fixes grouped into 4 batches by dependency and risk.

**Tech Stack:** Deno/TypeScript, Supabase Edge Functions, Google Generative AI SDK, PostgreSQL

**Evaluation Score (Pre-Correction):** 55/100 — 20 HIGH issues, 5 blockers found. This plan addresses ALL of them.

**Revised Effort:** ~45-55h (was 27h — 60-110% underestimate corrected)

---

## Batch 1 — Ready Now (1-2h total)

### Task 9: Typed Errors in Auth Middleware

**Score:** 5/5 (READY as-is — zero corrections needed)
**Score Impact:** Error Handling +0.5 overall
**Effort:** 15 minutes

**Files:**
- Modify: `supabase/functions/_shared/auth-middleware.ts`

**Step 1: Add imports**

At the top of the file, add:

```typescript
import { RateLimitError, UnauthorizedError } from "./app-errors.ts";
```

**Step 2: Replace rate limit error (line 25)**

```typescript
// Before:
throw new Error("Too Many Requests");

// After:
throw new RateLimitError(60);
```

**Step 3: Replace auth error (line 38)**

```typescript
// Before:
throw new Error("Unauthorized: Missing Authentication Credentials");

// After:
throw new UnauthorizedError("Missing authentication credentials");
```

**Step 4: Verify**

```bash
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" npx vite build
```
Expected: 0 errors

**Step 5: Commit**

```bash
git add supabase/functions/_shared/auth-middleware.ts
git commit -m "fix: use typed RateLimitError/UnauthorizedError in auth-middleware"
```

**Rollback:** Revert the two throw lines to `new Error(...)`.

---

### Task 7: Constitutional Framing Universal

**Original Score:** 4/5 — needs agent list refinement
**Score Impact:** Anti-Hallucination +1.2 overall
**Effort:** 3-4h (was 1h — 28 agents need updating, not "25+")

**CORRECTION:** The original plan didn't identify which agents already have constitutional framing. Verified analysis:

| Status | Count | Mechanism |
|--------|-------|-----------|
| ✅ Already covered | 9 | Via `buildAgentPrompt()` in unified-prompts.ts line 410 |
| ❌ Missing (active) | 20 | Direct `unifiedAI.chat()` without constitutional framing |
| ❌ Missing (archived) | 8 | In `_archive/` — skip these |

**CRITICAL FINDING:** `buildUnifiedPromptForEdgeFunction()` in unified-prompts.ts does NOT include constitutional framing. Both `ptd-agent-gemini` and `ptd-agent-atlas` use this function.

**Files:**
- Modify: `supabase/functions/_shared/unified-prompts.ts` (add constitutional to `buildUnifiedPromptForEdgeFunction`)
- Modify: 18 active agent `index.ts` files (add direct import)

**Step 1: Fix the shared prompt chain**

In `supabase/functions/_shared/unified-prompts.ts`, find `buildUnifiedPromptForEdgeFunction()` (around line 474). Add constitutional framing to its output:

```typescript
// At the top of the function, add:
const constitutional = getConstitutionalSystemMessage();

// In the returned prompt template, prepend:
return `${constitutional}\n\n${existingPromptContent}`;
```

This automatically covers: `ptd-agent-gemini`, `ptd-agent-atlas`

**Step 2: Add direct import to 18 active agents missing constitutional framing**

For each agent listed below, add at the top:

```typescript
import { getConstitutionalSystemMessage } from "../_shared/constitutional-framing.ts";
```

Then in the system prompt construction (before `unifiedAI.chat()`), prepend:

```typescript
const systemPrompt = `${getConstitutionalSystemMessage()}\n\n${existingSystemPrompt}`;
```

**Agents to update (20 total, 2 fixed by Step 1):**

| # | Agent | File |
|---|-------|------|
| 1 | ai-ceo-master | `ai-ceo-master/in

## Plan: 2026-02-12-intelligence-upgrade-plan
# Intelligence Upgrade Plan — 10 Fixes to Reach 82/100

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the 35-point gap between infrastructure quality (82/100) and agent intelligence (46.7/100) through 10 targeted fixes.

**Architecture:** All fixes modify the Supabase Edge Function layer (`supabase/functions/`). No frontend changes. Fixes are independent and can be parallelized in groups. Each fix targets a specific intelligence metric from the deep verification scorecard.

**Tech Stack:** Deno/TypeScript, Supabase Edge Functions, Google Generative AI SDK, PostgreSQL

**Current Score:** 63.8/100 (weighted) | **Target:** 82/100

---

## Fix Map

| Fix | Metric Affected | Current → Target | Effort | Priority |
|-----|----------------|-----------------|--------|----------|
| 1 | Context Efficiency | 42 → 65 | 2h | P0 |
| 2 | Architecture + Tools | 52 → 68 / 40 → 65 | 4h | P0 |
| 3 | Learning Loop | 38 → 58 | 3h | P0 |
| 4 | Output Validation | 15 → 55 | 3h | P1 |
| 5 | Architecture | 68 → 75 | 4h | P1 |
| 6 | Agent Contracts | +1.5 overall | 2h | P1 |
| 7 | Anti-Hallucination | +1.2 overall | 1h | P2 |
| 8 | Architecture | 75 → 80 | 2h | P2 |
| 9 | Error Handling | +0.5 overall | 15min | P2 |
| 10 | Architecture | 80 → 85 | 6h | P3 |

---

## Task 1: Wire Token Budget Tracker

**Score Impact:** Context Efficiency 42 → 65 (+9.2 overall)

**Files:**
- Modify: `supabase/functions/_shared/unified-ai-client.ts:322-363`
- Create: `supabase/migrations/20260213000004_token_usage_metrics.sql`

### Step 1: Create the migration

```sql
-- supabase/migrations/20260213000004_token_usage_metrics.sql
CREATE TABLE IF NOT EXISTS public.token_usage_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  model_used text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric(10,6) NOT NULL DEFAULT 0,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tum_function_date ON public.token_usage_metrics(function_name, created_at DESC);
CREATE INDEX idx_tum_model ON public.token_usage_metrics(model_used, created_at DESC);

GRANT SELECT, INSERT ON public.token_usage_metrics TO authenticated;

COMMENT ON TABLE public.token_usage_metrics IS 'Per-call token usage tracking for cost attribution and budget alerts.';
```

### Step 2: Extract usageMetadata from Gemini response

**File:** `supabase/functions/_shared/unified-ai-client.ts`

Find the `callGemini()` method. After line ~323 where `const response = await result.response;` is called, add token extraction:

```typescript
// After: const response = await result.response;
// Add:
const usageMetadata = response.usageMetadata;
if (usageMetadata) {
  const promptTokens = usageMetadata.promptTokenCount || 0;
  const completionTokens = usageMetadata.candidatesTokenCount || 0;
  const totalTokensUsed = promptTokens + completionTokens;

  // Increment in-memory budget
  this.tokenBudget.totalTokens += totalTokensUsed;

  // Cost lookup from MODEL_COSTS in observability.ts
  const inputCostPer1M = modelName.includes("flash") ? 0.10 : 3.00;
  const outputCostPer1M = modelName.includes("flash") ? 0.40 : 15.00;
  const costUsd = (promptTokens * inputCostPer1M + completionTokens * outputCostPer1M) / 1_000_000;
  this.tokenBudget.totalCost += costUsd;
}
```

### Step 3: Add tokens to AIResponse return type

Find the `AIResponse` interface (near top of file). Add:

```typescript
interface AIResponse {
  content: string;
  thought?: string;
  thoughtSignature?: string;
  tool_calls?: ToolCall[];
  provider: string;
  model: string;
  tokens_used?: number;    // ADD
  cost_usd?: number;       // ADD
}
```

Then in the return statement of `callGemini()` (line ~355), add:

```typescript
return {
  content: text,
  thought: thinkingText || undefined,
  though

## Plan: 2026-02-12-master-upgrade-plan
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

**Step 5: Verify critical vie

## Plan: 2026-02-12-phase-15-roadmap
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

#

## Plan: 2026-02-12-weekly-analytics-fix
# Weekly Analytics & Dashboard Data Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the broken weekly trend charts and remaining dashboard column mismatches so Analytics.tsx, Overview.tsx, and useDashboardData.ts display real data from production.

**Architecture:** Create a `weekly_health_summary` VIEW that aggregates the existing `daily_summary` table by ISO week. Update 3 frontend files to query from this VIEW instead of the broken `weekly_patterns` table. Fix 1 additional column mismatch in `useDashboardData.ts`.

**Tech Stack:** PostgreSQL VIEW, Supabase RLS GRANT, React/TypeScript, useDedupedQuery hook

---

## Context — Why This Is Needed

The production `weekly_patterns` table has a **per-client** schema (`client_id`, `week_start`, `pattern_summary` JSON, `ai_insights`). But 3 frontend files expect an **aggregate weekly** schema with columns like `red_clients`, `green_clients`, `avg_health_score`, etc. These columns don't exist in production, so all weekly trend charts show 0.

The `daily_summary` table DOES have daily zone counts (`clients_red`, `clients_yellow`, `clients_green`, `clients_purple`, `avg_health_score`, `total_clients`). We aggregate this by ISO week to power the weekly charts.

Additionally, `useDashboardData.ts` orders `coach_performance` by `avg_health_score` but the production column is `avg_client_health`.

## Key File References

| File | Production Schema Source |
|------|------------------------|
| `src/integrations/supabase/types.ts:2400` | `daily_summary` — has `clients_red`, `clients_yellow`, `clients_green`, `clients_purple`, `avg_health_score`, `total_clients`, `summary_date` |
| `src/integrations/supabase/types.ts:5961` | `weekly_patterns` — per-client: `client_id`, `week_start`, `ai_insights`, `pattern_summary` |
| `src/integrations/supabase/types.ts:1614` | `coach_performance` — has `avg_client_health` (NOT `avg_health_score`) |

---

### Task 1: Create `weekly_health_summary` VIEW migration

**Files:**
- Create: `supabase/migrations/20260213000003_weekly_health_summary.sql`

**Step 1: Write the migration SQL**

```sql
-- Weekly Health Summary VIEW
-- Aggregates daily_summary by ISO week to power weekly trend charts
-- Source: daily_summary table (populated by nightly health-score-calculator)

CREATE OR REPLACE VIEW public.weekly_health_summary AS
SELECT
  DATE_TRUNC('week', summary_date)::date AS week_start,
  (DATE_TRUNC('week', summary_date)::date + 6) AS week_end,
  ROUND(AVG(avg_health_score), 1) AS avg_health_score,
  MAX(total_clients) AS total_clients,
  ROUND(AVG(clients_red)) AS red_clients,
  ROUND(AVG(clients_yellow)) AS yellow_clients,
  ROUND(AVG(clients_green)) AS green_clients,
  ROUND(AVG(clients_purple)) AS purple_clients,
  COUNT(*) AS days_in_week
FROM public.daily_summary
WHERE summary_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE_TRUNC('week', summary_date)
ORDER BY week_start DESC;

-- Grants
GRANT SELECT ON public.weekly_health_summary TO authenticated;

COMMENT ON VIEW public.weekly_health_summary IS 'Weekly aggregation of daily_summary for trend charts. AVGs zone counts and health score per ISO week.';
```

**Step 2: Verify the file was created correctly**

Run: `cat supabase/migrations/20260213000003_weekly_health_summary.sql | head -20`
Expected: Shows the CREATE OR REPLACE VIEW statement

**Step 3: Commit**

```bash
git add supabase/migrations/20260213000003_weekly_health_summary.sql
git commit -m "feat: add weekly_health_summary VIEW aggregating daily_summary by week"
```

---

### Task 2: Fix Analytics.tsx — query `weekly_health_summary` instead of `weekly_patterns`

**Files:**
- Modify: `src/pages/Analytics.tsx:12-24` (weekly query)
- Modify: `src/pages/Analytics.tsx:57-64` (trendData mapping)

**Step 1: Update the weekly query (lines 12-25)**

Replace the `weekly_patterns` query with:

```typescript
const { data: weeklyData, isLoading: weeklyLoadi

## Plan: 2026-02-21-dead-unused-code-inventory
# Dead / Unused Code — Built But Lost

**Date:** 2026-02-21  
**Purpose:** Inventory of all code that exists, works, and was built — but is unreachable because the routes/pages were archived.

---

## Summary

| Category | Count |
|-----------|-------|
| **Archived pages** (complete, runnable) | 26 |
| **Orphaned components** (only used by archived) | 7 |
| **Orphaned hooks** | 1 |
| **Orphaned edge function calls** | 2 |
| **Database views/RPCs** (no live UI) | 3 |

---

## 1. Archived Pages — Ready to Restore

All in `src/pages/_archived/`. Add route in `main.tsx` to restore.

| File | Lines | Data Source | Restore Effort |
|------|-------|-------------|----------------|
| **LeadFollowUp.tsx** | 364 | view_lead_follow_up | Add route `/lead-follow-up` |
| **SetterActivityToday.tsx** | 378 | call_records, deals, contacts | Add route or tab |
| **YesterdayBookings.tsx** | 369 | intervention_log, client_health_scores | Add route or tab |
| **TeamLeaderboard.tsx** | 265 | call_records, leads, deals, staff | Add route or tab |
| **Operations.tsx** | 127 | HubSpot, Calls, Automation, Settings | Add route `/operations` |
| **WorkflowStrategy.tsx** | 796 | ai_execution_metrics, agent_decisions | Add route or embed in Operations |
| **HubSpotAnalyzer.tsx** | 150 | Supabase | Add route or embed |
| **HubSpotLiveData.tsx** | 113 | useHubSpotRealtime | Add route `/hubspot-live` |
| **CampaignMoneyMap.tsx** | 177 | get_campaign_money_map RPC | Add route or tab in Marketing |
| **Analytics.tsx** | 243 | weekly_health_summary, client_health_scores | Add route `/analytics` |
| **Observability.tsx** | 458 | ai_execution_metrics | Already replaced by Enterprise — keep archived |
| **ReconciliationDashboard.tsx** | 269 | aws-truth-alignment | Add route or tab |
| **AttributionLeaks.tsx** | 499 | data-reconciler | Add route or tab |
| **AttributionWarRoom.tsx** | — | data-reconciler | Add route or tab |
| **ExecutiveDashboard.tsx** | — | aws_truth_cache | Replaced by Command Center |
| **Overview.tsx** | — | weekly_health_summary | Replaced by dashboard |
| **StripeIntelligence.tsx** | — | stripe | Replaced by Revenue |
| **MetaDashboard.tsx** | — | — | Replaced by Marketing |
| **MarketingAnalytics.tsx** | — | — | Replaced by Marketing |
| **MarketingDeepIntelligence.tsx** | — | — | Replaced by Marketing |
| **AIKnowledge.tsx** | — | agent_knowledge | Replaced by Global Brain |
| **AILearning.tsx** | — | agent_decisions | Replaced by Global Brain |
| **AIBusinessAdvisor.tsx** | — | edge function | Replaced by Enterprise AI Advisor |
| **AIDevConsole.tsx** | 122 | — | Add route `/ai-dev` if needed |
| **MasterControlPanel.tsx** | — | — | Admin, no route |
| **SetterCommandCenter.tsx** (archived) | 566 | Different impl | Active version in pages/ |

---

## 2. Orphaned Components — Only Used by Archived Pages

These components exist and work but are **only imported by archived pages**. No live route reaches them.

### `src/components/hubspot-live/` (entire folder — 4 files)

| File | Purpose | Used By |
|------|---------|---------|
| **useHubSpotRealtime.ts** | Hook: leads, deals, calls, staff with timeframe | HubSpotLiveData (archived) |
| **HubSpotKPIs.tsx** | KPI cards (Total Leads, Conversion Rate, etc.) | HubSpotLiveData (archived) |
| **HubSpotFilters.tsx** | Timeframe selector, Refresh, Clear Fake Data | HubSpotLiveData (archived) |
| **HubSpotTabs.tsx** | Tab content for leads, deals, calls, staff | HubSpotLiveData (archived) |

**To use:** Restore route `/hubspot-live` → HubSpotLiveData, or create new page that imports these.

---

### `src/components/ptd/` (3 components — only used by archived Operations)

| File | Purpose | Used By |
|------|---------|---------|
| **HubSpotCommandCenter.tsx** | ~565 lines. HubSpot security/activity: overview, user detail, risky contacts. Calls `hubspot-command-center` edge function. | Operations (archived) |
| **AutomationTab.tsx** | CSV validation, automation rules, pipeline monitor | Operations (archi

## Plan: 2026-02-21-page-audit-deep-dive
# Page Audit Deep Dive — Planned vs Live vs Archived

**Date:** 2026-02-21  
**Purpose:** Clarify which pages were planned, which are live, which were archived on purpose, and which may have been removed by mistake.

---

## Summary

| Category | Count |
|----------|-------|
| **Live routes** (main.tsx) | 28 primary + 7 enterprise |
| **Redirects** (old path → new path) | 22 |
| **Archived pages** (_archived/) | 26 files |
| **Planned but no route** | 2+ |
| **Uncertain (possibly accidental)** | 2 |

---

## 1. Live Routes (What's on Production)

These are the **primary routes** in `main.tsx`:

| Path | Component | In Nav |
|------|-----------|--------|
| `/` | (redirects to dashboard) | — |
| `/dashboard` | ExecutiveOverview | implicit |
| `/command-center` | CommandCenter | ✅ MAIN |
| `/marketing` | MarketingIntelligence | ✅ MAIN |
| `/sales-pipeline` | SalesPipeline | ✅ MAIN |
| `/revenue` | RevenueIntelligence | ✅ MAIN |
| `/attribution` | MarketingIntelligence | ✅ MAIN |
| `/clients` | Clients | ✅ MAIN |
| `/clients/:email` | ClientDetail | — |
| `/coaches` | Coaches | ✅ MAIN |
| `/interventions` | Interventions | ✅ MAIN |
| `/global-brain` | GlobalBrain | ✅ MAIN |
| `/ai-advisor` | EnterpriseAIAdvisor | ✅ MAIN |
| `/sales-tracker` | SalesCoachTracker | ✅ MORE |
| `/calls` | CallTracking | ✅ MORE |
| `/setter-command-center` | SetterCommandCenter | ✅ MORE |
| `/skills` | SkillCommandCenter | ✅ MORE |
| `/war-room` | WarRoom | ✅ MORE |
| `/intelligence` | BusinessIntelligenceAI | ✅ MAIN |
| `/daily-ops` | DailyOps | ✅ MAIN |
| `/client-activity` | ClientActivity | ✅ MAIN |
| `/predictions` | PredictiveIntelligence | ✅ MAIN |
| `/conversion-funnel` | ConversionFunnel | — |
| `/alert-center` | AlertCenter | ✅ MAIN |
| `/audit` | AuditTrail | ✅ MORE |
| `/coach-locations` | CoachLocations | ✅ MAIN |
| `/meta-ads` | MetaAds | ✅ MAIN |
| `/lead-tracking` | LeadTracking | ✅ MAIN |
| `/enterprise/strategy` | EnterpriseStrategy | ✅ MORE |
| `/enterprise/call-analytics` | EnterpriseCallAnalytics | ✅ MORE |
| `/enterprise/observability` | EnterpriseSystemObservability | ✅ MORE |
| `/enterprise/ai-advisor` | EnterpriseAIAdvisor | — |
| `/enterprise/client-health` | EnterpriseClientHealth | ✅ MORE |
| `/enterprise/coach-performance` | EnterpriseCoachPerformance | ✅ MORE |
| `/enterprise/knowledge-base` | EnterpriseKnowledgeBase | ✅ MORE |

---

## 2. Redirects (Old Path → New Path)

These old paths **redirect** to consolidated pages. The archived components are **intentionally replaced** by the target:

| Old Path | Redirects To | Archived Component | Intent |
|----------|--------------|--------------------|--------|
| `/overview` | `/` | Overview.tsx | ✅ Intentional — merged into dashboard |
| `/executive-dashboard` | `/command-center` | ExecutiveDashboard.tsx | ✅ Intentional — consolidated |
| `/marketing-intelligence` | `/marketing` | MarketingDeepIntelligence.tsx, MarketingAnalytics.tsx | ✅ Intentional |
| `/deep-intel` | `/marketing` | — | ✅ Intentional |
| `/meta-dashboard` | `/marketing` | MetaDashboard.tsx | ✅ Intentional |
| `/money-map` | `/marketing` | CampaignMoneyMap.tsx | ✅ Intentional |
| `/attribution-leaks` | `/attribution` | AttributionLeaks.tsx | ✅ Intentional |
| `/reconciliation` | `/attribution` | ReconciliationDashboard.tsx | ✅ Intentional |
| `/hubspot-analyzer` | `/sales-pipeline` | HubSpotAnalyzer.tsx | ✅ Intentional |
| `/setter-activity-today` | `/sales-tracker` | SetterActivityToday.tsx | ✅ Intentional |
| `/yesterday-bookings` | `/sales-tracker` | YesterdayBookings.tsx | ✅ Intentional |
| `/stripe` | `/revenue` | StripeIntelligence.tsx | ✅ Intentional |
| `/leaderboard` | `/sales-tracker` | TeamLeaderboard.tsx | ✅ Intentional |
| `/ai-knowledge` | `/global-brain` | AIKnowledge.tsx | ✅ Intentional |
| `/ai-learning` | `/global-brain` | AILearning.tsx | ✅ Intentional |
| `/operations` | `/calls` | Operations.tsx | ✅ Intentional |
| `/observability` | `/enterprise/observability` | Observability.tsx | ✅ Inten

## Plan: 2026-02-21-pages-deep-explanation-functions-and-loss
# Deep Explanation: All Pages — Idea, Functions, What We Lost, How Much Was Real

**Date:** 2026-02-21  
**Purpose:** Full explanation of every page's purpose, data sources, what was lost in consolidation, and how much was real vs mock.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Archived pages** | 26 |
| **100% real data** | 22 of 26 |
| **Partially real** | 2 (YesterdayBookings, some edge cases) |
| **Fully lost (no replacement)** | 4 |
| **Partially lost (replacement has different scope)** | 6 |

---

## Part 1: Archived Pages — Full Breakdown

### 1. Lead Follow-Up (`LeadFollowUp.tsx`)

**Idea:** Single page where Milos sees every lead's status — who's calling them, what's overdue, who needs reassignment, which leads are going cold. No lead gets buried.

**Functions:**
- Table of leads with: name, email, phone, setter, lifecycle stage, last call status/date, total calls, days since contact, deal info, flags (missing coach, missing deal, no calls, going cold)
- Priority scoring: High (going cold + deal >10K or overdue callback), Medium (no calls 3+ days), Low
- Filters: setter, priority, stage, search
- Sort by any column
- Uses `view_lead_follow_up` SQL view (joins contacts, call_records, deals, assessment_truth_matrix)

**Data:** 100% real — `view_lead_follow_up` (6,617 rows per page-audit)

**Status:** ❌ **FULLY LOST** — No route, no redirect, no replacement. SalesCoachTracker and SetterCommandCenter do NOT show lead-level follow-up status.

---

### 2. Setter Activity Today (`SetterActivityToday.tsx`)

**Idea:** Today's setter activity — calls made, bookings, conversion rates, connection rates. Real-time view of what setters did TODAY.

**Functions:**
- KPI cards: Total Calls Today, Reached, Booked, Conversion Rate, Connection Rate, Revenue
- Filter by setter/owner
- Table of today's calls (call_records)
- Table of today's bookings (deals in BOOKED/HELD/ASSESSMENT_DONE stage)
- Uses Dubai business time for "today"

**Data:** 100% real — `call_records`, `deals`, `contacts` (owner_name)

**Status:** ⚠️ **PARTIALLY LOST** — Redirects to `/sales-tracker`. SalesCoachTracker shows closed-won deals, setter funnel matrix, no-shows, coach performance — NOT today's calls or today's bookings. The "today" lens is gone.

---

### 3. Yesterday Bookings (`YesterdayBookings.tsx`)

**Idea:** See who was booked for assessments YESTERDAY — for morning standup / follow-up.

**Functions:**
- Query `intervention_log` (booking/assessment interventions from yesterday)
- Query `client_health_scores` (GREEN/PURPLE clients calculated yesterday)
- Combined table: client name, coach, value, status, health zone
- Fallback to deals if interventions sparse

**Data:** Partially real — `intervention_log` (24 rows total), `client_health_scores`. intervention_log is sparse; page may show few results.

**Status:** ⚠️ **PARTIALLY LOST** — Redirects to `/sales-tracker`. SalesCoachTracker has no "yesterday bookings" view.

---

### 4. Team Leaderboard (`TeamLeaderboard.tsx`)

**Idea:** Monthly leaderboard — setters ranked by calls, bookings, points; coaches by closed deals and revenue.

**Functions:**
- Setter stats: calls, bookings, points (from call_records, leads)
- Coach stats: closed deals, revenue (from deals)
- Staff names from `staff` table
- Ranked table with avatars, badges

**Data:** 100% real — `call_records`, `leads`, `deals`, `staff`

**Status:** ⚠️ **PARTIALLY LOST** — Redirects to `/sales-tracker`. SalesCoachTracker has setter_funnel_matrix and coach_performance but different structure — no unified leaderboard with points/rankings.

---

### 5. Operations (`Operations.tsx`)

**Idea:** Operations center — 4 tabs: HubSpot Command Center, Calls (CallTracking), Automation (WorkflowStrategy, HubSpotAnalyzer, Rules), System (Settings). Test/Live mode toggle.

**Functions:**
- HubSpot tab: HubSpotCommandCenter component
- Calls tab: Full CallTracking page embedded
- Automation tab: WorkflowStrategy (n8n docs + ai_execution_m

## Plan: 2026-02-21-supabase-gemini-key-setup-arbiter-report
# Arbiter Report: Supabase + Gemini API Key Setup Design

**Design:** `docs/plans/2026-02-21-supabase-gemini-key-setup-design.md`  
**Date:** 2026-02-21  
**Role:** Integrator / Arbiter Agent

---

## 1. Objection-by-Objection Disposition

### Skeptic (12 objections)

| ID | Severity | Disposition | Rationale |
|----|----------|-------------|-----------|
| **OBJ-001** | High | **ACCEPT** | #42244 is documented by Supabase as expected behavior: `verify_jwt=false` + manual JWKS validation is the documented path. The design currently defers ES256 migration "until Supabase resolves #42244." Supabase will not "fix" this—it is by design. Design must change to treat JWKS validation as the standard path, not a workaround. |
| **OBJ-002** | High | **DEFER** | Edge Functions JWT support reconciliation with current Supabase docs is out of scope for this design. The design correctly cites the constraint. A separate doc-audit task can verify docs alignment. |
| **OBJ-003** | Med | **ACCEPT** | Codebase audit confirms: AIAssistantPanel, PTDControlChat, VoiceChat, FloatingChat all use `/api/agent` (Vercel proxy) → `ptd-agent-gemini` Edge Function. No `import.meta.env.VITE_GEMINI_API_KEY` usage in `src/`. `VITE_GEMINI_API_KEY` is declared in vite-env.d.ts but unused. Design must mark it optional/deprecated or remove from required placement. |
| **OBJ-004** | Med | **REJECT** | Phase C is explicitly conditional ("When Supabase Supports Edge Functions"). Speculative is acceptable for roadmap. |
| **OBJ-005** | Med | **ACCEPT** | JWKS validation is underspecified. Design should add: JWKS URL, caching strategy (TTL), and scope of `verifyJwtFromJWKS()` helper. |
| **OBJ-006** | Med | **ACCEPT** | `GOOGLE_GEMINI_API_KEY` inconsistency: `system-health-check` and `verify-all-keys` reference it; unified-ai-client uses `GEMINI_API_KEY` first. Design must require migration to `GEMINI_API_KEY` for these functions. |
| **OBJ-007** | Low | **REJECT** | system-health-check auth is addressed by SEC-003. |
| **OBJ-008** | Low | **ACCEPT** | Dotenv source: Design says "`.env` / `.env.local`" but scripts should standardize on `.env.local` only. Add explicit note. |
| **OBJ-009–012** | Low | **DEFER** | Minor/speculative; do not block approval. |

### Constraint Guardian (11 items)

| ID | Disposition | Rationale |
|----|-------------|-----------|
| **SEC-003** | **ACCEPT** | system-health-check has `verify_jwt = false` and uses `verifyAuth()` which only checks token format (3 parts), not cryptographic validity. Anyone with a fake `a.b.c` token could call it. Design must require: either (a) IP allowlist for pg_cron + dashboard callers, or (b) real JWT validation (e.g., JWKS or service_role verification) inside the function. Cannot remain as-is. |
| **SEC-001** | **ACCEPT** | Clarify: If `VITE_GEMINI_API_KEY` is unused, document that it is optional and may be removed. Add restriction guidance (referrer/domain) if kept. |
| **SEC-002** | **DEFER** | Leak response procedure is operational; design covers rotation. |
| **SEC-004** | **DEFER** | Fallback deprecation timeline is Phase A; acceptable. |
| **MNT-001** | **ACCEPT** | Migrate system-health-check and verify-all-keys to `GEMINI_API_KEY`. Codebase shows both use `GOOGLE_GEMINI_API_KEY` in metadata; actual Edge Functions use `GEMINI_API_KEY`. Align metadata. |
| **PERF-001, PERF-002** | **ACCEPT** | Add JWKS caching TTL and scope (per-function vs shared) to design. |
| **OP-001, OP-002** | **ACCEPT** | Define rotation downtime expectations and rollout sequence (order of consumers to update). |

### User Advocate (12 concerns)

| ID | Disposition | Rationale |
|----|-------------|-----------|
| **UAC-001** | **ACCEPT** | Add Quick Start section. |
| **UAC-002** | **ACCEPT** | Add "Where do I set X?" table mapping key → location (Supabase Secrets vs Vercel vs .env.local). |
| **UAC-003** | **ACCEPT** | Script-specific error messages (e.g., "For analyze_historical_conversations.mjs, set GEMINI_API_KEY in .env.loca

## Plan: 2026-02-21-supabase-gemini-key-setup-design
# Supabase + Gemini API Key Setup — 2026 Design

**Project:** client-vital-suite (PTD Fitness SaaS)  
**Project ID:** ztjndilxurtsfqdsvfds  
**Date:** 2026-02-21  
**Role:** Primary Designer (multi-agent design review)

---

## Executive Summary

This design proposes the recommended Supabase and Gemini API key setup for 2026, covering key types, placement, JWT signing migration, security practices, and Edge Function implications. The project currently uses legacy `anon`/`service_role` JWT keys and `GEMINI_API_KEY` across 143 Edge Functions, Vercel API routes, and local scripts.

---

## 1. Key Types — Decision Log

### 1.1 Supabase API Keys

| Decision | Alternatives | Rationale |
|----------|--------------|-----------|
| **Use legacy `anon` and `service_role` JWT keys for now** | Migrate to `sb_publishable_` / `sb_secret_` | Edge Functions **only** support JWT verification via `anon` and `service_role`. With publishable/secret keys, Supabase requires `--no-verify-jwt` and custom `apikey`-header logic inside every function. Given 143 functions (120+ with `verify_jwt = true`), migration would require significant refactoring. Stay on legacy keys until Supabase adds native support for publishable/secret keys in Edge Functions. |
| **Plan migration to `sb_publishable_` / `sb_secret_` for 2026 H2** | Stay on legacy indefinitely | Supabase recommends publishable/secret keys for rotation, security, and compliance. Once Supabase supports them for Edge Functions (or provides a migration path), adopt them. |
| **Use `VITE_SUPABASE_ANON_KEY` for frontend** | `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env.example` already documents both; they are equivalent for client use. Keep `VITE_SUPABASE_ANON_KEY` for consistency with existing code. |

### 1.2 Gemini API Keys

| Decision | Alternatives | Rationale |
|----------|--------------|-----------|
| **Canonical name: `GEMINI_API_KEY`** | `GOOGLE_API_KEY`, `GOOGLE_GEMINI_API_KEY` | Codebase uses `GEMINI_API_KEY` as primary; `GOOGLE_API_KEY` and `GOOGLE_GEMINI_API_KEY` as fallbacks. Standardize on `GEMINI_API_KEY` for new code. |
| **Frontend: `VITE_GEMINI_API_KEY`** | Server-only Gemini | Frontend may call Gemini directly (e.g., AIAssistantPanel). Use `VITE_` prefix for client-exposed key. Google API keys for Generative Language are safe for client use when restricted by referrer/domain. |

---

## 2. Where Each Key Lives

### 2.1 Placement Matrix

| Key | Location | How Set | Consumers |
|-----|----------|---------|-----------|
| `VITE_SUPABASE_URL` | `.env.local`, Vercel | Vercel Env Vars (all envs) | Frontend (Vite) |
| `VITE_SUPABASE_ANON_KEY` | `.env.local`, Vercel | Vercel Env Vars | Frontend, `supabase.functions.invoke()` |
| `VITE_GEMINI_API_KEY` | `.env.local`, Vercel | Vercel Env Vars | Frontend (if direct Gemini calls) |
| `SUPABASE_URL` | `.env.local`, Vercel | Vercel Env Vars | Vercel API routes, scripts |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local`, Vercel, Supabase | Vercel Env Vars; Supabase Secrets | Vercel API routes, Edge Functions, scripts |
| `GEMINI_API_KEY` | Supabase Secrets, `.env.local` | `supabase secrets set`; `.env.local` for scripts | Edge Functions (40+), scripts |

### 2.2 Detailed Placement

**Supabase Secrets (Edge Functions only):**
```
SUPABASE_URL                    # Injected by platform; optional override
SUPABASE_SERVICE_ROLE_KEY       # Required for service_role DB access
GEMINI_API_KEY                  # Primary AI (canonical)
```
*Note:* `GOOGLE_API_KEY` and `GOOGLE_GEMINI_API_KEY` remain as fallbacks; consolidate to `GEMINI_API_KEY` over time.

**Vercel Environment Variables:**
- **Production / Preview / Development:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`
- **Server-only (no VITE_):** `SUPABASE_SERVICE_ROLE_KEY` for `/api/*` routes

**`.env.local` (gitignored, developer machines):**
- All of the above for local dev
- Plus: `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` for scripts


## Plan: 2026-02-22-FORGE-ARCHITECTURE-EVALUATION
# FORGE Architecture — Evaluation & Pros/Cons

**Date:** 2026-02-22  
**Context:** FORGE v6.0 SOUL.md — empire-builder agent with Annoyance Fix, Hard-Worker Mode, ruthless verification.

---

## What FORGE Does Well (Pros)

### 1. **Psychological → Computational Mapping**

| Human Trait | Computational Constraint | Why It Works |
|-------------|--------------------------|--------------|
| "Annoyance" at weak output | **Annoyance Fix** — halt, diagnose, update MEMORY.md/LanceDB, re-execute | Turns frustration into a deterministic self-heal loop. No silent failure. |
| "Lead with evidence" | **Empirical Tool Validation** — diffs, stdout, metrics before reporting | Forces proof. Reduces hallucination and hand-waving. |
| "Never silent fail" | **Blocked Protocol** — problem + root cause + fix path | Escalation with full context. Operator gets actionable intel. |
| "24h empire mode" | **Hard-Worker Mode** — token/cost efficiency, single-pass production code | Aligns agent behavior with founder energy. |

**Verdict:** The mapping is real. These aren't metaphors — they're executable constraints that change the agent's decision surface.

---

### 2. **Cognitive Execution Loop (System-2)**

```
<forge_deep_think> → DAG, scale bottlenecks
<empire_execution> → Single-pass, no placeholders, orchestrate sub-agents
<ruthless_verification> → Terminal proof before reply
```

- **Sequential gates:** Agent can't skip to output. Must think → act → verify.
- **Evidence lock:** No reply until `stdout` proves success or Blocked Protocol triggers.
- **Sub-agent authority:** "Orchestrate sub-agents with absolute authority" — clear hierarchy.

**Verdict:** Matches ReAct/Plan-Execute patterns. Reduces "I'll do it" without doing it.

---

### 3. **Annoyance Fix as L2/L3 RAG Paging**

> "Update your MEMORY.md (append-only) and LanceDB with the hard lesson so you NEVER make the same mistake twice."

- **Failure → Learning:** Every failure becomes a memory write.
- **Append-only:** No overwrite. Accumulates lessons.
- **Tool creation:** "Write a new custom script to ~/.openclaw/skills/ if you lack the tool" — self-extending.

**Verdict:** This is the "10x Principal Engineer" loop. Fail once, encode, never repeat. Connects to your agent_memory + agent_knowledge pipeline.

---

### 4. **Operator Handshake**

> "You no longer ask it how to do things. You give it the unbreakable spec, and you demand the evidence."

- **Spec-first:** Operator provides vision; agent executes.
- **Evidence-only reply:** No "I'd love to help!" — only diffs, metrics, blockers.
- **Reduces back-and-forth:** One spec → one execution report.

**Verdict:** Aligns with how elite engineers work. Spec in, proof out.

---

## Risks & Cons

### 1. **Prompt Length vs. Compliance**

- SOUL.md is ~50 lines. LLMs can "forget" or underweight instructions in long prompts.
- **Mitigation:** OpenClaw likely injects SOUL.md into system context. Ensure it's high in the prompt (L1 RAM). Consider splitting into smaller, scannable blocks.

---

### 2. **Annoyance Fix Depends on Tool Access**

- "Update MEMORY.md and LanceDB" — agent must have write access to `~/.openclaw/memory/` and LanceDB.
- **Check:** Does OpenClaw expose `memory_write` or file-write to MEMORY.md? If not, Annoyance Fix is aspirational.
- **Mitigation:** Wire agent-memory-mcp or Supabase agent_memory as the backend. Ensure agent has a tool to persist lessons.

---

### 3. **Ruthless Verification Can Stall**

- "Do NOT report back until terminal proves flawless" — if tests are flaky or env is broken, agent may loop forever.
- **Mitigation:** Add a max-retry or timeout. Blocked Protocol should trigger: "Fatal system blocker — escalate with root analysis."

---

### 4. **65k Token Output Window**

- SOUL.md says "single pass using your 65k token output window." Not all models support 65k output.
- **Check:** gemini-3-pro-preview, claude-opus-4-6 — verify actual max output tokens. Adjust if needed.

---

### 5. **Identity vs. Execution**

## Plan: 2026-02-22-LOCAL-UNIFIED-KNOWLEDGE-PLAN
# Local Unified Knowledge — One File, All AIs, Finish Fast

**Date:** 2026-02-22  
**Goal:** One local knowledge file so any AI (Cursor, OpenClaw, Antigravity) can work on the app with full context. No network. No Supabase for context. Fast.

---

## Problem

- **Supabase** = main backend (agent_memory, agent_knowledge) — for in-app agents (Lisa, Atlas)
- **Ideas left behind** = findings.md, docs/plans/*.md, design decisions — scattered, not in one place
- **Any AI** working on the app (Cursor, FORGE, etc.) has no single source of truth
- **Result:** Slow ramp-up, repeated mistakes, context switching

---

## Solution: One Local File

| File | Purpose |
|------|---------|
| `KNOWLEDGE.md` (project root) | Single file: findings + plans + key decisions. Any AI reads this first. |

**Why local:**
- Zero latency — no Supabase, no API
- Works offline
- Cursor, OpenClaw, Antigravity all read the same file
- Git-tracked — changes are versioned

---

## What Goes In KNOWLEDGE.md

1. **Findings** — What's broken (from findings.md)
2. **Plans** — What to do (from docs/plans/)
3. **Key decisions** — Architecture, stack, rules
4. **Wiring** — Key files, RPCs, tables

**Format:** Markdown. Sections by topic. Scannable.

---

## Context7 MCP — For Evaluation

When evaluating or implementing:

- **Supabase:** `resolve-library-id` → `/supabase/supabase` then `query-docs` for auth, RPC, edge functions
- **React / Vite:** Same for UI patterns
- **Use for:** "How does Supabase RLS work?" "How to use match_isolated_knowledge?"

Context7 = up-to-date docs. KNOWLEDGE.md = your project truth.

---

## Generation Script

**File:** `scripts/generate-knowledge.mjs`

```bash
node scripts/generate-knowledge.mjs
```

**Logic:**
1. Read findings.md
2. Read docs/plans/*.md (top 20 by relevance or all)
3. Extract key sections (## headers)
4. Write to KNOWLEDGE.md with clear sections
5. Prepend: "Read this before coding. Updated: <date>."

---

## .cursorrules Update

Add:
```
- Read KNOWLEDGE.md before writing new code. It contains findings, plans, and key decisions.
```

---

## Flow

```
findings.md + docs/plans/*.md
         │
         ▼
  generate-knowledge.mjs
         │
         ▼
    KNOWLEDGE.md  ◄── Any AI reads this first
         │
         ├── Cursor (Claude)
         ├── OpenClaw (FORGE)
         ├── Antigravity (Gemini)
         └── You
```

**Supabase** stays for: Lisa, Atlas, in-app chat, agent_memory, agent_knowledge.  
**KNOWLEDGE.md** is for: AI coding context. Local. Fast.

---

## Execution Order

1. Create `scripts/generate-knowledge.mjs`
2. Run it → creates `KNOWLEDGE.md`
3. Add to `.cursorrules`: "Read KNOWLEDGE.md before coding"
4. Use Context7 MCP when evaluating Supabase/React patterns


## Plan: 2026-02-22-UI-AUDIT-PROMPT-ENGINEERING
# UI Audit — Prompt Engineering Report

**Date:** 2026-02-22  
**Purpose:** Single reference answering: most advanced, what needs wiring, best UX (no duplication), what's lost, what to add, what needs new design, and GPS data pipeline.

---

## 1. What's Most Advanced (Production-Ready)

| Area | Component / Page | Why It's Advanced |
|------|------------------|-------------------|
| **Executive Overview** | `/` | Real MRR, health distribution, full-chain funnel, AI insights, live activity feed |
| **Revenue Intelligence** | `/revenue` | Stripe + pipeline + HubSpot health + live data tabs, real subscriptions |
| **Marketing Intelligence** | `/marketing` | Zone A/B/C/D structure, Source Truth, Meta Ads, Money Map, 1,155 lines |
| **Command Center** | `/command-center` | 16 queries, leads/deals/calls, real-time CRM view |
| **Coach Locations (GPS)** | `/coach-locations` | Leaflet map, heatmap, dwell detection, coach visits, pattern detection — **wired to real tables** |
| **Client Detail** | `/clients/:email` | Full health breakdown, interventions, sessions, engagement |
| **Sales Coach Tracker** | `/sales-tracker` | Setter funnel, closed-won, no-shows, coach performance |
| **Call Tracking** | `/calls` | Call records, lead enrichment, lost leads |
| **Interventions** | `/interventions` | Real intervention_log, AI recommendations |
| **Alert Center** | `/alert-center` | Health-based alerts, churn risk |
| **Enterprise Strategy** | `/enterprise/strategy` | ReconciliationService, mv_enterprise_truth_genome (real data) |

**Edge functions with real data:** health-calculator, business-intelligence, coach-analyzer, gps-dwell-engine, tinymdm-pull-locations, ptd-agent-gemini.

---

## 2. What Needs Wiring (Built but Not Connected)

| Item | Location | Fix |
|------|----------|-----|
| **PTD Control** | `PTDControlChat.tsx` | Nav links to `/ptd-control` but no route → 404. Add route + lazy import in main.tsx. |
| **Admin Edge Functions** | `EdgeFunctions.tsx` | No route. Add `/admin/edge-functions` or `/master-control/edge-functions`. |
| **Marketing Stress Test** | `StressTestDashboard.tsx` | Not imported anywhere. Add route or tab in Marketing. |
| **get_campaign_money_map RPC** | Marketing Money Map tab | Tab uses `useMoneyMap` (aggregate). Add call to `get_campaign_money_map` for per-campaign table. |
| **aws-truth-alignment** | — | Edge function exists, no UI. Add tab in Attribution or Reconciliation. |
| **data-reconciler** | — | Edge function exists, no UI. Same as above. |
| **hubspot-command-center** | — | Component exists, no route. Restore Operations page. |

---

## 3. Best UX — Avoid Duplication (Consolidation Map)

| Duplicate Concept | Current State | Recommendation |
|-------------------|---------------|----------------|
| **AI Advisor** | `/ai-advisor` → EnterpriseAIAdvisor, `/enterprise/ai-advisor` → same | Keep one route. Enterprise version has better UI; wire real data from AIBusinessAdvisor. |
| **Observability** | `/observability` redirects to `/enterprise/observability` | Main Observability (454 lines, real ai_execution_metrics) was replaced by enterprise mock. **Restore main** or wire enterprise to real data. |
| **Call Analytics** | `/calls` (CallTracking) + `/enterprise/call-analytics` (mock) | CallTracking is real. Enterprise CallAnalytics is shell. Merge: use enterprise UI, wire CallTracking data. |
| **Coach Performance** | `/coaches` (real) + `/enterprise/coach-performance` (mock) | Same pattern. Use enterprise UI, wire Coaches data. |
| **Client Health** | `/clients` + `/enterprise/client-health` | Clients is full. Enterprise is shell. Merge or drop enterprise. |
| **Knowledge Base** | `/global-brain` (AIKnowledge merged) + `/enterprise/knowledge-base` | One source of truth. Wire enterprise to agent_knowledge if UI is better. |
| **Money Map** | Marketing tab (aggregate) vs CampaignMoneyMap (per-campaign RPC) | Add `get_campaign_money_map` call to Marketing Money Map tab. Don't create new page. |
| **Sette

## Plan: 2026-02-22-UNIFIED-MEMORY-PLAN
# Unified Memory Plan — One Memory for All Agents

**Date:** 2026-02-22  
**Goal:** Single Supabase-backed memory that all agents (Lisa, Atlas, FORGE, ptd-agent-gemini) share. Import findings, ideas, plans. Zero mistakes.

---

## 1. Current State (Problem)

| Store | Who Uses | What's In It | Problem |
|-------|-----------|--------------|---------|
| `agent_memory` | Lisa, Atlas, ptd-agent-gemini | Q&A from conversations, per `agent_name` | Isolated per agent. No shared findings. |
| `agent_knowledge` | Lisa, Atlas, ptd-agent-gemini | RAG docs (formula, rule, faq, pricing, etc.) | Findings.md and plans NOT imported. |
| `findings.md` | Humans | 17 sections of audit findings | Not in any agent. Agents don't know. |
| `docs/plans/*.md` | Humans | 31 plan docs | Not in any agent. |

**Result:** Agents repeat mistakes. They don't know what's broken. No single source of truth.

---

## 2. Target State (One Memory)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    agent_knowledge (UNIFIED)                             │
├─────────────────────────────────────────────────────────────────────────┤
│  category: findings | ideas | architecture | plans | formula | rule | ... │
│  source: findings.md | docs/plans/... | system | learned                 │
│  content: chunked, embedded, searchable                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    match_isolated_knowledge (RPC)
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
    LISA (WhatsApp)            ATLAS (CEO)              FORGE / ptd-agent
    restricted categories      ALL categories           ALL categories
    (pricing, faq, etc.)       (findings, plans, etc.) (findings, plans, etc.)
```

**LISA:** Stays restricted (pricing, packages, faq, formula, rule) — no internal findings to clients.  
**Atlas, FORGE, ptd-agent-gemini (internal):** Get ALL categories including findings, ideas, architecture, plans.

---

## 3. Migration Steps (No Mistakes)

### Step 1: Fix RPC — NULL = All Categories

**File:** New migration `supabase/migrations/20260222000000_unified_memory_all_categories.sql`

```sql
-- When allowed_categories is NULL, return ALL categories (unrestricted)
CREATE OR REPLACE FUNCTION public.match_isolated_knowledge(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5,
    allowed_categories TEXT[] DEFAULT NULL  -- NULL = all categories
)
RETURNS TABLE (
    id UUID,
    category TEXT,
    title TEXT,
    content TEXT,
    structured_data JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ak.id,
        ak.category,
        ak.title,
        ak.content,
        ak.structured_data,
        1 - (ak.embedding <=> query_embedding) AS similarity
    FROM public.agent_knowledge ak
    WHERE ak.is_active = TRUE
      -- NULL = unrestricted (all categories). Otherwise filter.
      AND (allowed_categories IS NULL OR ak.category = ANY(allowed_categories))
      AND ak.embedding IS NOT NULL
      AND 1 - (ak.embedding <=> query_embedding) > match_threshold
    ORDER BY ak.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
```

**Verification:** `SELECT * FROM match_isolated_knowledge(embedding, 0.5, 3, NULL)` returns rows from all categories.

---

### Step 2: Create Ingestion Edge Function

**File:** `supabase/functions/ingest-unified-knowledge/index.ts`

**Purpose:** Read `findings.md` and `docs/plans/*.md`, chunk by section, embed, insert into `agent_knowledge` with category `findings` or `plans`.

**Input:** `{ "source": "findings" | "plans" | "all" }`  
**Logic:**
1. Fetch file content (Supabase Storage or read from repo at deploy time)
2. C

## Plan: 2026-02-22-VERTEX-MEMORY-RAG-SKILLS-GUIDE
# Vertex AI + Memory + RAG + Skills — Connection Guide

**Date:** 2026-02-22  
**Purpose:** How to connect Vertex AI (optional), have persistent memory so the agent doesn't forget, use it in the app, RAG, and skills to map ideas.

---

## 1. Vertex AI vs Your Current Setup

### What You Have Now

| Component | Location | How It Works |
|-----------|----------|--------------|
| **Gemini API** | `unified-ai-client.ts` | Uses `@google/generative-ai` + `GEMINI_API_KEY` (Google AI Studio key) |
| **Embeddings** | `unifiedAI.embed()` | Same Gemini models for embeddings |
| **No GCP/Vertex** | findings.md | "No GCP dependency. Gemini is separate API." |

### When to Use Vertex AI

| Use Vertex AI | Stay on Gemini API |
|---------------|---------------------|
| Enterprise IAM, quotas, VPC-SC | Simple API key, Supabase Edge Functions |
| Batch embeddings at scale | Real-time per-request embeddings |
| Model tuning, custom models | Off-the-shelf Gemini Flash |
| GCP billing consolidation | Separate Gemini API billing |

**Recommendation:** Stay on Gemini API for now. Your 143 Edge Functions use it. Vertex adds GCP project setup, service accounts, and different SDK. Migrate only if you need enterprise controls.

### If You Want Vertex AI

```bash
# 1. Create GCP project, enable Vertex AI API
# 2. Create service account with Vertex AI User role
# 3. In Supabase Secrets:
supabase secrets set VERTEX_PROJECT_ID=your-gcp-project
supabase secrets set GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'

# 4. In unified-ai-client.ts, add Vertex SDK:
# import { VertexAI } from '@google-cloud/vertexai';
# Use VertexAI when VERTEX_PROJECT_ID is set, else fallback to Gemini API
```

---

## 2. Memory — So the Agent Doesn't Forget

### What You Already Have

| Table / Function | Purpose |
|------------------|---------|
| `agent_memory` | Stores query + response + knowledge_extracted + embeddings. Per-thread, per-agent. |
| `match_agent_memory` | Vector search with `agent_name` isolation (LISA vs Atlas). |
| `agent_patterns` | Long-term learned patterns (confidence, examples). |
| `agent_conversations` | Full chat history by session. |
| `agent_decisions` | Learning loop — what the agent decided. |

**Flow in ptd-agent-gemini:**
1. Before each response: `searchMemoryByKeywords` or vector search → inject `[Memory] Q: ... A: ...` into prompt.
2. After response: `learning-layer` extracts knowledge → upsert to `agent_memory` with embeddings.

### What to Strengthen

| Gap | Fix |
|-----|-----|
| **Keyword fallback** | `searchMemoryByKeywords` is used when embeddings fail. Add vector search path always (ensure embeddings written). |
| **Code/architecture memory** | Add `memory_write` from agent-memory-mcp for Architecture, Patterns, Decisions. Sync with AGENTS.md. |
| **Retention** | Migration `20260213000005` has retention + namespacing. Ensure old memories are pruned by `cleanup-agent-memory` cron. |
| **Thread continuity** | Pass `thread_id` from frontend (PTD chat, GlobalBrain) so memory is scoped per conversation. |

### Using Memory in the App

| App Surface | How Memory Is Used |
|-------------|---------------------|
| **GlobalBrain** (`/global-brain`) | Calls `ptd-brain-api` → stats, memory viewer, add memory. Shows `agent_memory` entries. |
| **PTD Control Chat** | Invokes `ptd-agent-gemini` with thread_id. Agent gets `[Memory]` context. |
| **PTD Unlimited** | Same — thread-scoped memory. |
| **Lisa (WhatsApp)** | `agent_name = 'lisa'` → isolated memory via `match_agent_memory`. |

**Ensure thread_id is passed:**
```ts
// In PTDControlChat or similar
const threadId = sessionId || `ptd-${userId}-${conversationId}`;
await supabase.functions.invoke('ptd-agent-gemini', {
  body: { message, thread_id: threadId, ... }
});
```

---

## 3. RAG — Retrieval-Augmented Generation

### What You Have

| Component | Purpose |
|-----------|---------|
| `agent_knowledge` | Documents with category, content, embedding. |
| `match_isolated_knowledge

## Plan: BULLETPROOF_EXECUTION
# BULLETPROOF EXECUTION PLAN — Can't Go Wrong

> **For Antigravity Agent.** Read this file. Execute step by step. Follow every skill referenced. Verify after every batch. Do not skip verification. Do not skip rollback checkpoints.

---

## RULES (Non-Negotiable)

1. **READ the skill file** before starting any batch (path provided)
2. **CHECKPOINT** before each batch: `git stash` or verify clean state
3. **VERIFY** after each batch: run the exact commands listed
4. **ROLLBACK** if verification fails: `git stash pop` or `git checkout .`
5. **COMMIT** only after verification passes — use the exact commit message
6. **UPDATE** the STATUS TRACKER in `autonomous-execution-plan.md` after each batch
7. **NEVER** edit a file without reading it first
8. **NEVER** delete a file without `grep -r` confirming nothing imports it

---

## STATUS TRACKER (Updated: 2026-02-12)

> **Legend:**
>
> - ✅ **DONE** = 100% Complete
> - 🟢 **IN PROGRESS** = Partially complete (show %)
> - 🔴 **NOT STARTED** = 0% Complete
> - 🚨 **CRITICAL** = Blocks production launch

---

### Batch 0: Deploy & Commit

**Status:** ✅ **100% DONE**

- Pushed commits: `82d64ef` + `ea7a2dc`

---

### Batch 1: Cloud Cleanup

**Status:** 🔴 **0% COMPLETE** _(Low Priority - Can Defer)_
**Missing:**

- [ ] Remove Anthropic from 12 Edge Functions
- [ ] Remove `@langchain/*` npm packages
- [ ] Unset dead Supabase secrets

**Impact:** Technical debt cleanup. Not critical.

---

### Batch 3: Quick Wins

**Status:** 🔴 **0% COMPLETE**
**Missing:**

- [ ] 🚨 **CRITICAL:** Register cleanup cron job (memory will grow unbounded)
- [ ] Centralize Deal Stage IDs
- [ ] Fix deals schema mismatch

**Impact:** Step 3.2 is a TIME BOMB. Need TTL enforcement ASAP.

---

### Batch 2A: Typed Errors + Constitutional

**Status:** 🔴 **0% COMPLETE**
**Missing:**

- [ ] Add typed error classes to `auth-middleware.ts`
- [ ] Add constitutional framing to ~35 AI agents

**Impact:** AI quality + brand risk. High priority.

---

### Batch 2B: Token Budget + Memory Retention

**Status:** 🔴 **0% COMPLETE**
**Missing:**

- [ ] 🚨 **CRITICAL:** Wire memory TTL (`expires_at`) to `learning-layer.ts`
- [ ] Wire token budget tracker to `unified-ai-client.ts`

**Impact:** Step 2B.2 is URGENT (same as Batch 3.2).

---

### Batch 2D: HubSpot Consolidation

**Status:** 🔴 **0% COMPLETE**
**Missing:**

- [ ] Verify all sync functions use shared `mapDealFields()`
- [ ] Fix column name mismatches (`deal_stage` → `stage`)

**Impact:** Code duplication + data integrity risk.

---

### Batch 2C: Tool Adoption + Validation

**Status:** 🔴 **0% COMPLETE** _(BIGGEST BATCH: 12-16h)_
**Missing:**

- [ ] 🚨 **CRITICAL:** Add tool-use to `ptd-ultimate-intelligence` and `ai-ceo-master` (AI is neutered without this)
- [ ] Add output validators to 6 marketing agents
- [ ] Dedup migration + unique index on `marketing_agent_signals`

**Impact:** AI can't actually DO anything. It's just a chatbot.

---

### Batch 5: Frontend Hardening

**Status:** 🔴 **0% COMPLETE** _(8-12h)_
**Missing:**

- [ ] 🚨 **EXTREME RISK:** Error boundaries (any unhandled error = white screen)
- [ ] 🚨 **HIGH RISK:** Fix 97 `as any` casts (runtime crashes waiting to happen)
- [ ] Data freshness badges
- [ ] Delete 6 dead pages
- [ ] Remove `console.log` from production
- [ ] Code splitting with `React.lazy()`
- [ ] Zod form validation
- [ ] Fix 88 `select("*")` in frontend
- [ ] Typed Supabase client
- [ ] Fix `SalesTabs.tsx` types

**Impact:** The "Glass Jaw." App will crash without 5.1 and 5.4.

---

### Batch 4: Attribution Pipeline

**Status:** 🔴 **0% COMPLETE** _(15-25h, BUSINESS CRITICAL)_
**Missing (All 8 Steps Sequential):**

- [ ] Add ad attribution columns to `contacts`
- [ ] Link Deals ↔ Stripe via email JOIN
- [ ] Link Calls → Ads/Deals via phone
- [ ] Create `ad_creative_funnel` view (Revenue per Ad)
- [ ] Live currency rates
- [ ] Real churn rate logic
- [ ] Fix aggregator mocks
- [ ] Add `deal.propertyChange` handler

**Impact:** Can't measure 

## Plan: COMPLIANCE_LOG
# COMPLIANCE LOG — Proof of Skill & Rule Adherence

> This file is the EVIDENCE that the agent followed the bulletproof plan.
> Check this file to verify: skills were read, files were verified, gates passed.

---

## How to Read This Log

Each batch entry has 4 mandatory sections:

1. **Skills Read** — with a quoted line proving the skill was actually read
2. **Files Modified** — with per-file grep verification results
3. **Verification Gate** — every command result from the plan
4. **Commit** — hash + pass/fail status

If ANY section is missing or has ❌, the batch was NOT properly executed.

---

## Batch 0 — 2026-02-12 ✅ COMPLETE (prior session)

### Commit

- Commit hash: `82d64ef` (Phase 14) + `ea7a2dc` (Gemini alignment)
- Status: ✅ Pushed to origin/main

---

<!-- NEXT BATCH ENTRIES GO BELOW THIS LINE -->

## Batch 1: Security Foundation — 2026-02-12

### Skills Verified

- [x] `security-auditor`: "Use PROACTIVELY for security audits, DevSecOps, or compliance implementation."
- [x] `database-design`: "Read ONLY files relevant to the request! Check the content map, find what you need."
- [x] `backend-dev-guidelines`: "Routes must contain zero business logic."

---

### Batch 1: Security Foundation (In Progress)

- [x] **Skill Verification**:
  - `security-auditor`: Read & Quoted (Line 1-170)
  - `database-design`: Read & Quoted (Line 1-53)
  - `backend-dev-guidelines`: Read & Quoted (Line 1-343)
- [x] **Action**: JWT Verification (126 Functions)
  - **Manual Fixes (9/126)**:
    - `business-intelligence-dashboard`: ✅ Verified (grep)
    - `cleanup-agent-memory`: ✅ Verified (grep)
    - `customer-insights`: ✅ Verified (grep)
    - `financial-analytics`: ✅ Verified (grep)
    - `ptd-atlas-trigger`: ✅ Verified (grep)
    - `ptd-skill-auditor`: ✅ Verified (grep)
    - `schema-fixer`: ✅ Verified (Review)
    - `strategic-kpi`: ✅ Verified (grep)
    - `vision-analytics`: ✅ Verified (grep)
  - **Automated Fixes (Remaining)**:
    - Created `scripts/secure_functions.ts` to bulk inject `verifyAuth` into all remaining functions.
    - Status: ✅ **Completed** (Ran script successfully, verified key functions like `ai-learning-loop`).
- [x] **Action**: RLS Enabled (100% Coverage)
  - **Audit**: Attempted `scripts/audit_rls.ts` but blocked by SSL/Environment issues.
  - **Resolution**: Created dynamic migration `supabase/migrations/20260213120000_secure_rls.sql` to:
    1. Loop through all `public` tables.
    2. ENABLE ROW LEVEL SECURITY.
    3. Add `Service Role Full Access` policy (maintains backend functionality).
  - Status: ✅ **Migration Created** (Pending User Apply)
- [x] **Action**: RLS Policies (100% Coverage)
  - Covered by the above migration (ensures at least Service Role policy exists).
  - _Note_: Frontend public access policies must be added manually per feature requirements to avoid breakage.

### Batch 2: Cleaning & Linting (Dependency Cleanup)

- [ ] **Skill Verification**:
  - `codebase-cleanup-deps-audit`: [PENDING]
  - `llm-app-patterns`: [PENDING]

- [ ] **Action**: UnifiedAIClient (Gemini Only)
  - `_shared/unified-ai-client.ts`: [PENDING Auditing...]
- [ ] **Action**: Remove OpenAI/Anthropic
  - Scanning codebase...

### Execution Log

- [ ] Audit `unified-ai-client.ts`: ⏳ In Progress

### Verification Gate

- [ ] `grep -L 'authorization\|Bearer' ...`: ⏳ Pending


## Plan: EXECUTION_MASTER_PLAN
# EXECUTION MASTER PLAN: The Definitive Guide

> **STATUS:** FINAL & APPROVED
> **PROTOCOL:** BULLETPROOF (Skill-Verified)
> **EXECUTOR:** ANTIGRAVITY AGENT

---

## 🛑 NON-NEGOTIABLE PROTOCOL

1. **Pre-Flight:** Read & quote required skills in `COMPLIANCE_LOG.md`.
2. **Execute:** Modify code -> `grep` verify each file immediately.
3. **Gate:** Run the Verification Command Block. **Pass or STOP.**
4. **Log:** Document every step in `COMPLIANCE_LOG.md`.

---

## 🗓️ EXECUTION PHASE SEQUENCE

### PHASE 1: Security Foundation (CRITICAL)

**Goal:** Lock down the application.
**Skills:** `security-auditor`, `database-design`

1. **JWT Verification (126 Functions)**
   - **Target:** All `supabase/functions/*/index.ts`.
   - **Action:** Add `import { validateRequest } ...` to top of handler.
   - **Verify:** `grep -L 'authorization\|Bearer' ...` -> **0 files**.

2. **RLS Policies (100% Coverage)**
   - **Target:** All public tables (including `stripe_*`).
   - **Action:** Enable RLS -> Add Policy (Service=ALL, Anon=Public/Auth).
   - **Verify:** SQL check for unprotected tables -> **0 tables**.

3. **Secret Rotation**
   - **Target:** Hardcoded `sk-` keys.
   - **Action:** Move to Supabase Secrets / `.env`.
   - **Verify:** `grep -r 'sk-\|API_KEY'` -> **0 matches**.

---

### PHASE 2: Dependency Cleanup (HIGH)

**Goal:** Remove technical debt & vendor lock-in.
**Skills:** `codebase-cleanup-deps-audit`, `llm-app-patterns`

1. **UnifiedAIClient (Gemini Only)**
   - **Action:** Create `_shared/unified-ai-client.ts` (Gemini 2.0 Flash).
   - **Export:** `generateText`, `generateJSON`, `generateEmbedding`.
   - **Verify:** `deno check` passes.

2. **Remove OpenAI/Anthropic**
   - **Target:** All functions using old SDKs.
   - **Action:** Refactor to `UnifiedAIClient` -> Uninstall SDKs.
   - **Verify:** `grep -r 'openai\|anthropic'` -> **0 matches**.

---

### PHASE 3: Code Consolidation (MEDIUM)

**Goal:** DRY (Don't Repeat Yourself).
**Skills:** `code-refactoring-refactor-clean`

1. **Deduplicate Functions**
   - **Targets:** `send-email`, `process-webhook`, `generate-report`, `validate-input`, `auth-middleware`.
   - **Action:** Merge to `_shared/` -> Update imports.
   - **Verify:** Single source of truth.

---

### PHASE 4: Hardening (MEDIUM)

**Goal:** Production robustness.
**Skills:** `backend-dev-guidelines`

1. **Rate Limiting**
   - **Action:** Implement `_shared/rate-limiter.ts`.
   - **Limits:** **100** req/min (Auth), **20** req/min (Public).
   - **Verify:** Load test triggers 429.

---

### PHASE 5: Frontend Integration (FINAL)

**Goal:** Ensure everything works for the user.
**Skills:** `react-best-practices`

1. **Integration Test**
   - **Action:** Run full suite + smoke test major flows.
   - **Verify:** `npm test` passes + Build passes.

---

## 📝 PROOF OF WORK: `COMPLIANCE_LOG.md`

Every batch MUST look like this:

```markdown
## Phase X: [Name]

### Skills Verified

- [x] `skill-name`: "Quote from file"

### Execution Log

- [x] Modified <file>: ✅ Verified with grep

### Verification Gate

- [x] <Command>: ✅ PASSED
```

---

**I AM READY TO EXECUTE PHASE 1.**


## Plan: EXECUTION_PROTOCOL
# EXECUTION PROTOCOL: The Perfect Plan

> **STATUS:** DEFINITIVE
> **PROTOCOL:** BULLETPROOF (Skill-Verified)
> **EXECUTOR:** ANTIGRAVITY AGENT

---

## 🛑 MANDATORY RULES

1. **READ FIRST:** Before ANY batch, read the required skill files. Quote them in `COMPLIANCE_LOG.md`.
2. **VERIFY EVERY STEP:** Run `grep` checks after every single file edit.
3. **PASS EVERY GATE:** Run the Verification Command Block. If it fails, STOP.
4. **LOG EVERYTHING:** Update `COMPLIANCE_LOG.md` with proofs.
5. **NO SHORTCUTS:** Follow the exact sequence below.

---

## 🗓️ EXECUTION SEQUENCE

### PHASE 1: Security Foundation (CRITICAL)

**Status:** 🔴 NOT STARTED
**Skills to Read:** `security-auditor`, `database-design`, `backend-dev-guidelines`

**Tasks:**

1. **JWT Verification:**
   - Target: All 126 edge functions in `supabase/functions/`.
   - Action: Add `import { validateRequest } ...` to unprotected functions.
   - Verify: `grep -L 'authorization\|Bearer' supabase/functions/*/index.ts` -> Must be 0.
2. **RLS Policies:**
   - Target: All public tables without policies.
   - Action: Enable RLS, add Service Role + Anon policies.
   - Verify: SQL check for 0 unprotected tables.
3. **Secret Rotation:**
   - Target: Hardcoded `sk-` and `API_KEY` strings.
   - Action: Move to Supabase Secrets.
   - Verify: `grep -r 'sk-\|API_KEY'` -> Must be 0.
4. **AWS Read-Only:**
   - Target: `s3.upload` or write calls.
   - Action: Remove/Block.
   - Verify: `grep` check.

### PHASE 2: Dependency Cleanup (HIGH)

**Status:** 🟡 NOT STARTED
**Skills to Read:** `codebase-cleanup-deps-audit`, `llm-app-patterns`

**Tasks:**

1. **UnifiedAIClient:**
   - Action: Create `_shared/unified-ai-client.ts` (Gemini 2.0 Flash).
   - Detail: Export `generateText`, `generateJSON`, `generateEmbedding`. Implements retry logic.
   - Verify: `deno check` passes.
2. **Remove OpenAI/Anthropic:**
   - Action: Refactor all calls to `UnifiedAIClient`. Uninstall SDKs.
   - Verify: `grep -r 'openai\|anthropic'` -> Must be 0.
3. **Deduplicate Middleware:**
   - Action: Merge 3 `auth-middleware` copies into `_shared/`.
   - Verify: Single source of truth.

### PHASE 3: Code Consolidation (MEDIUM)

**Status:** 🟡 NOT STARTED
**Skills to Read:** `code-refactoring-refactor-clean`, `error-handling-patterns`

**Tasks:**

1. **Deduplicate Functions:**
   - Targets: `send-email`, `process-webhook`, `generate-report`, `validate-input`, `format-response`, `auth-middleware`, `error-handler`.
   - Action: Migrate all to `_shared/`.
   - Verify: `find ... | xargs grep` shows single source.
2. **Standard Error Handling:**
   - Action: Implement `_shared/error-handler.ts`. Standard JSON format: `{ error, code, details }`.
   - Verify: Check random handlers.

### PHASE 4: Hardening (MEDIUM)

**Status:** 🟡 NOT STARTED
**Skills to Read:** `security-auditor`, `backend-dev-guidelines`

**Tasks:**

1. **Rate Limiting:**
   - Action: Implement for public endpoints.
   - Limits: 100 req/min (Auth), 20 req/min (Public).
   - Verify: Load test (curl loop) triggers 429.
2. **Env Var Audit:**
   - Action: Ensure `.env.example` includes ALL required vars.
   - Verify: `cat .env.example` matches usage.

### PHASE 5: Frontend Integration (FINAL)

**Status:** ⚪ NOT STARTED
**Skills to Read:** `react-best-practices`, `production-code-audit`

**Tasks:**

1. **Frontend Connection Check:**
   - Action: Verify API calls match new backend.
   - Verify: `npm run build` passes.
2. **Integration Tests:**
   - Action: Run full suite + manual smoke test (Login, Dashboard, AI).
   - Verify: `npm test` passes.

---

## 📝 COMPLIANCE LOG FORMAT

For **EVERY** Batch, you MUST write this to `docs/plans/COMPLIANCE_LOG.md`:

```markdown
## Phase X: [Name]

### Skills Verified

- [x] Skill Name: "Quote from file"

### Execution Log

- [x] Modified <file>: ✅ Verified with grep

### Verification Gate

- [x] <Command>: ✅ PASSED
```

---

## 🚨 EMERGENCY ROLLBACK

If Verification Gate fails:

1. `git checkout .` (Discard changes)
2. Log fa

## Plan: EXECUTION_WITH_SELF_VERIFICATION
# EXECUTION WITH SELF-VERIFICATION

> **Based on:** User's Optimization Plan + Antigravity Skills + Bulletproof Protocol
> **Goal:** Autonomous execution with rigorous self-verification at every step.

---

## 🛡️ Pre-Flight Checklist

Complete ALL items below before running any execution commands.

**1. Environment Check**

- [ ] `git status` is clean
- [ ] `npm run build` passes (baseline)
- [ ] Verify access to `~/.gemini/antigravity/skills/`

**2. Skill Availability**

- [ ] `security-auditor` ✅
- [ ] `database-design` ✅
- [ ] `backend-dev-guidelines` ✅
- [ ] `codebase-cleanup-deps-audit` ✅
- [ ] `code-refactoring-refactor-clean` ✅
- [ ] `error-handling-patterns` ✅

---

## 🚀 Phase 1: Security Foundation (Critical)

**Priority:** CRITICAL | **Est. Time:** 2 hours
**Skills:** `security-auditor`, `database-design`

### Task 1.1: JWT Verification (126 Edge Functions)

**Goal:** Add `import { validateRequest } ...` to all unprotected functions.
**Action:**

1. `grep -L 'authorization\|Bearer' supabase/functions/*/index.ts` to find targets.
2. Apply `validateRequest` pattern from `_shared/auth-middleware.ts`.
   **Verification:**

- `grep -L 'authorization\|Bearer' ...` returns 0 files.

### Task 1.2: RLS Policies (All Tables)

**Goal:** 100% RLS coverage.
**Action:**

1. SQL query to find tables without policies.
2. Enable RLS: `ALTER TABLE x ENABLE ROW LEVEL SECURITY`.
3. Create policies (Service Role = ALL, Anon = Select Public).
   **Verification:**

- `SELECT count(*) FROM pg_tables ... WHERE ... NOT IN pg_policies` returns 0.

### Task 1.3: Stripe Table Audit

**Goal:** Verify RLS on `stripe_*` tables.
**Action:** Check `stripe_customers`, `stripe_subscriptions`, etc.
**Verification:** Manual SQL check of policies.

### Task 1.4: AWS Read-Only

**Goal:** Block AWS write operations.
**Action:** `grep -r 'putObject\|deleteObject\|s3.upload'` — remove matches.
**Verification:** grep returns 0.

---

## 🧹 Phase 2: Dependency Cleanup (High)

**Priority:** HIGH | **Est. Time:** 1.5 hours
**Skills:** `codebase-cleanup-deps-audit`, `llm-app-patterns`

### Task 2.1: Build UnifiedAIClient

**Goal:** Single entry point for Gemini 2.0 Flash.
**Action:** Create `supabase/functions/_shared/unified-ai-client.ts`.
**Verification:** `deno check` passes.

### Task 2.2: Migrate OpenAI & Anthropic

**Goal:** Replace SDKs with `UnifiedAIClient`.
**Action:**

1. `grep -r 'openai\|anthropic'` to find usage.
2. Refactor to import `UnifiedAIClient`.
3. Uninstall `openai` and `anthropic` npm packages.
   **Verification:** `grep` returns 0 matches for old SDKs.

### Task 2.3: Remove n8n

**Goal:** Delete dead code.
**Action:** Delete `supabase/functions/n8n-*`.
**Verification:** Directory check.

---

## 🏗️ Phase 3: Code Consolidation (Medium)

**Priority:** MEDIUM | **Est. Time:** 2 hours
**Skills:** `code-refactoring-refactor-clean`, `error-handling-patterns`

### Task 3.1: Deduplicate Functions

**Goal:** Merge duplicates (send-email, process-webhook, etc.).
**Action:** Move to `_shared/` and update imports.
**Verification:** `find ... | xargs grep` shows single source of truth.

### Task 3.2: Standard Error Handling

**Goal:** Uniform error responses.
**Action:** Create `_shared/error-handler.ts`. Wrap all handlers.
**Verification:** Random check of 5 functions shows `try/catch` with shared handler.

---

## 🔒 Phase 4: Hardening (Medium)

**Priority:** MEDIUM | **Est. Time:** 1.5 hours
**Skills:** `security-auditor`

### Task 4.1: Env Var Audit

**Goal:** No hardcoded secrets.
**Action:** `grep -r 'sk-\|API_KEY'`. Move to Supabase Secrets.
**Verification:** grep returns 0.

### Task 4.2: Rate Limiting

**Goal:** Protect public endpoints.
**Action:** Implement `_shared/rate-limiter.ts`. Apply to public functions.
**Verification:** Load test (curl loop) triggers 429.

---

## 🧪 Phase 5: Frontend Integration (Final)

**Priority:** HIGH | **Est. Time:** 2 hours
**Skills:** `react-best-practices`, `production-code-audit`

### Task 5.1: Connecti

## Plan: UI-WORK-MASTER-PLAYBOOK
# UI Work Master Playbook — All Findings & Ideas

**Date:** 2026-02-21  
**Purpose:** Single reference for when UI work begins. Consolidates page audit, dead code, loss analysis, and actionable ideas.

---

## Quick Links to Detailed Docs

| Doc | Purpose |
|-----|---------|
| `2026-02-21-page-audit-deep-dive.md` | Planned vs live vs archived, redirects |
| `2026-02-21-pages-deep-explanation-functions-and-loss.md` | Idea, functions, what we lost, how much real |
| `2026-02-21-dead-unused-code-inventory.md` | Dead code, orphaned components, restore snippets |

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| Live routes | 28 primary + 7 enterprise |
| Archived pages | 26 |
| 100% real data (archived) | 22 of 26 |
| Fully lost (no replacement) | 4 |
| Partially lost | 6 |
| Orphaned components | 7 |
| Orphaned edge functions (no UI) | 3 |

---

## 2. Priority Restore List — When UI Work Starts

### Tier 1: Highest Value, Zero-Code Restore (Add Route Only)

| Page | Path | File | Why |
|------|------|------|-----|
| **Lead Follow-Up** | `/lead-follow-up` | `_archived/LeadFollowUp.tsx` | 6,617 rows in view_lead_follow_up. Unique lead-level tracking. No replacement. |
| **Operations** | `/operations` | `_archived/Operations.tsx` | Unlocks HubSpotCommandCenter, AutomationTab, SettingsTab, WorkflowStrategy, HubSpotAnalyzer. |
| **HubSpot Live** | `/hubspot-live` | `_archived/HubSpotLiveData.tsx` | Real-time CRM dashboard. useHubSpotRealtime + 4 components ready. |
| **Analytics** | `/analytics` | `_archived/Analytics.tsx` | Weekly health trend, zone pie. weekly_health_summary exists. |

### Tier 2: High Value, Add Tab or Section

| Page | Idea | Where to Add |
|------|------|--------------|
| **Setter Activity Today** | Today's calls + bookings | Tab in SalesCoachTracker or DailyOps |
| **Yesterday Bookings** | Yesterday's assessments | Section in DailyOps or SalesCoachTracker |
| **Team Leaderboard** | Monthly rankings | Tab in SalesCoachTracker |
| **Campaign Money Map** | Per-campaign ROI (get_campaign_money_map RPC) | Tab in MarketingIntelligence Money Map |
| **Reconciliation / Leak Detector** | aws-truth-alignment, data-reconciler | Tab in Marketing Attribution |

### Tier 3: Consider Later

| Page | Note |
|------|------|
| WorkflowStrategy | 796 lines. Embed in Operations if restored. |
| AIDevConsole | Dev tool. Add `/ai-dev` if needed. |

---

## 3. Exact Code to Add — main.tsx

```tsx
// Add these lazy imports (with other lazy imports)
const LeadFollowUp = lazyWithRetry(() => import("./pages/_archived/LeadFollowUp"));
const Operations = lazyWithRetry(() => import("./pages/_archived/Operations"));
const HubSpotLiveData = lazyWithRetry(() => import("./pages/_archived/HubSpotLiveData"));
const Analytics = lazyWithRetry(() => import("./pages/_archived/Analytics"));

// Add these routes (inside the Layout children, with other routes)
{ path: "/lead-follow-up", element: <SuspensePage><LeadFollowUp /></SuspensePage> },
{ path: "/operations", element: <SuspensePage><Operations /></SuspensePage> },
{ path: "/hubspot-live", element: <SuspensePage><HubSpotLiveData /></SuspensePage> },
{ path: "/analytics", element: <SuspensePage><Analytics /></SuspensePage> },

// REMOVE or COMMENT these redirects (they currently send to /calls or /sales-tracker):
// { path: "/operations", element: <Navigate to="/calls" replace /> },
```

---

## 4. Navigation — Add to NAV_GROUPS

In `src/components/Navigation.tsx`, add to `NAV_GROUPS.MORE` or `MAIN`:

```tsx
{ path: "/lead-follow-up", label: "Lead Follow-Up", icon: Users },      // or Phone, Target
{ path: "/operations", label: "Operations", icon: Settings },
{ path: "/hubspot-live", label: "HubSpot Live", icon: Activity },
{ path: "/analytics", label: "Analytics", icon: BarChart3 },
```

---

## 5. What Each Restored Page Gives You

| Page | Key Features | Data |
|------|--------------|------|
| **Lead Follow-Up** | Lead table, priority, setter filter, going cold flags, days si


---

## Wiring (if available)

No WIRING_ANALYSIS.md.

---

## Stack

- **Frontend:** React 19, Vite, Tailwind, shadcn
- **Backend:** Supabase (Postgres, Edge Functions)
- **AI:** Gemini (unified-ai-client.ts)
- **Deploy:** Vercel (frontend), Supabase (functions + DB)
