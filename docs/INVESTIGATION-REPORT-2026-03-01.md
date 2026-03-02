# Parallel Deep Investigation Report — 2026-03-01

> Git status, Vercel vs local, data truth, P0-B hardening, Sales Brain wiring, page audit

---

## 1. Git Status

| State | Count | Details |
|-------|-------|---------|
| **Modified** | 30+ files | progress.md, scripts (aws-sync-bridge, sync-aws-*), src (MetricDrilldownModal, NorthStarWidget, WarRoom, etc.), supabase (config.toml, 12 edge functions, 1 migration) |
| **Deleted** | 4 files | public/docs/HubSpot_*, Implementation_Guide, contact_property_audit.csv |
| **Untracked** | 20+ | .cursor/.supermemory/, AGENTS.md, docs/plans/*, MINIMAX*, migrations 20260301*, tiktok-integration/ |
| **Last commit** | e2e4f5e | "docs: add session resume checkpoint for post-restart continuity" |
| **Branch** | main | Up to date with origin/main |

**Implication:** Nothing since e2e4f5e is on production. All 30+ modified files + 4 migrations + 12 edge functions are LOCAL ONLY.

---

## 2. Vercel vs Local — Mismatches

**Vercel production** = last pushed commit (e2e4f5e). Vercel CLI `vercel ls` timed out; manual check recommended.

### What's LIVE (on Vercel)
- Frontend from commit e2e4f5e
- No DEPLOY-MANIFEST changes
- No MiniMax/Context7/OpenClaw plan docs
- No PowerBI migrations, agent knowledge constraint, dead cron removal

### What's LOCAL ONLY (not on Vercel)
| Category | Items |
|----------|-------|
| **Frontend** | MetricDrilldownModal, NorthStarWidget, MetaAdsPage, WarRoom, CallTracking, RevenueIntelligence, ExecutiveOverview, SystemObservability, useWarRoomData, useExecutiveData, useRevenueIntelligence, api.ts, edgeFunctions.ts, queryKeys.ts, serverMemory.ts, utils.ts |
| **Migrations** | 20260301000000, 20260301000001, 20260301000002, 20260225000001 (modified) |
| **Edge functions** | ai-ceo-master, ai-client-advisor, aws-session-sync, error-resolution-agent, generate-lead-replies, health-score-engine, hubspot-webhook, ingest-unified-knowledge, marketing-copywriter, multi-agent-orchestrator, sales-objection-handler, setup-coach-intelligence, super-agent-orchestrator |
| **Config** | supabase/config.toml (dialogflow-fulfillment removed) |
| **Scripts** | aws-sync-bridge.cjs, sync-aws-sessions.mjs, sync-aws-to-supabase.cjs, ingest-unified-knowledge.mjs |

**Action:** Commit + push to trigger Vercel deploy. Run `supabase db push` and `supabase functions deploy` for backend.

---

## 3. Data Truth Verification

### AWS Sync Status
- **Scripts modified:** aws-sync-bridge.cjs, sync-aws-sessions.mjs, sync-aws-to-supabase.cjs
- **CRAW fix:** Cancel filter `status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked'` applied in migrations + scripts
- **PowerBI views:** Migration 20260301000001 adds client_reviews, client_demographics, PowerBI columns
- **Status:** Changes local only; sync bridge not run with new migrations

### HubSpot Webhook
- **File:** `supabase/functions/hubspot-webhook/index.ts`
- **Verification:** HMAC signature check via `x-hubspot-signature` when `HUBSPOT_CLIENT_SECRET` set
- **Zod validation:** HubSpotDealSchema validates payloads
- **Status:** ✅ Implemented; modified locally (not deployed)

### Stripe Webhook
- **File:** `supabase/functions/stripe-webhook/index.ts`
- **Config:** verify_jwt = false (correct for webhooks)
- **Status:** ✅ Active per wiki; no local changes in this run

### Cancel Contracts (AWS)
- **Rule:** `status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked'`
- **Applied in:** sync-aws-sessions.mjs, sync-aws-to-supabase.cjs, health-score-engine, setup-coach-intelligence, aws-session-sync
- **Status:** Local changes; needs deploy

---

## 4. P0-B: Runtime Crash Hardening (toFixed + Snapshot Fallbacks)

### toFixed Null Guards — HIGH RISK

| File | Line | Issue |
|------|------|-------|
| `ClientCard.tsx` | 49 | `client.health_score.toFixed(0)` — health_score can be null |
| `HealthScoreBadge.tsx` | 23 | `score.toFixed(0)` — score may be undefined |
| `Coaches.tsx` | 743 | `client.health_score?.toFixed(0)` — optional chaining present ✅ |
| `DailyTrends.tsx` | 54, 72, 86 | `day.answeredRate.toFixed(0)` — answeredRate could be NaN |
| `CallIntelligenceKPIs.tsx` | 21, 24 | `data.answeredRate.toFixed(1)`, `data.avgWaitTime.toFixed(0)` |
| `BusinessIntelligenceAI.tsx` | 182–192 | `snapshot.kpis.totalRevenue.toLocaleString()` — no guard if snapshot null when building context (line 180 checks `snapshot ?` but nested props can be undefined) |
| `MetricDrilldownModal.tsx` | 116, 157, 206 | `churn_risk_score?.toFixed(0)`, `item.change` — item.change could be NaN |
| `HeatmapChart.tsx` | 44, 48 | `data.health_score?.toFixed(0)` — optional ✅ |

### Snapshot Fallbacks — BusinessIntelligenceAI

```tsx
// Line 180: snapshot ? ... : "No data loaded yet."
// But inside template: snapshot.kpis.totalRevenue, snapshot.funnel, snapshot.topCampaigns
// If snapshot.kpis is {} or kpis.totalRevenue is null → .toLocaleString() throws
```

**Fix pattern:**
```tsx
(snapshot?.kpis?.totalRevenue ?? 0).toLocaleString()
(snapshot?.kpis?.closeRate ?? 0).toFixed(1)
(snapshot?.funnel?.leads ?? 0)
(snapshot?.topCampaigns ?? []).map(...)
```

**Priority files:** ClientCard.tsx, HealthScoreBadge.tsx, BusinessIntelligenceAI.tsx, DailyTrends.tsx, CallIntelligenceKPIs.tsx, MetricDrilldownModal.tsx

---

## 5. Sales Brain Wiring: setter-performance + proactive-insights + call_records

### Current State
| Component | Location | Data Source | Status |
|-----------|----------|-------------|--------|
| **setter-performance** | Edge function | call_records | Exists (PHASE1-RESULT); OPTIONS + auth |
| **proactive-insights-generator** | Edge function | call_records, deals, contacts | ✅ Live, queries call_records |
| **call_records** | Supabase table | CallGear (fetch-callgear-data) | 33,762 rows per ENGINEERING-AUDIT |
| **SetterCommandCenter** | Page `/setter-command-center` | call_records, contacts, delegation | ✅ Live |

### Gap
- **setter-performance** = edge function (API)
- **proactive-insights-generator** = AI insights from call_records
- **call_records** = raw data
- **No single "Sales Brain" agent** that unifies: setter KPIs + proactive insights + call_records into one conversational/analytical agent

### Wiring Plan
1. Create or extend an agent that:
   - Reads from `call_records`, `deals`, `contacts`
   - Calls `proactive-insights-generator` for AI insights
   - Uses setter-performance metrics (calls per setter, connection rate, etc.)
2. Expose via: BusinessIntelligenceAI, SetterCommandCenter, or new `/sales-brain` route
3. Tool executor already has `call_records` in super-agent-orchestrator (line 423)

---

## 6. 32 Pages — Real Data Verification

### Active Pages (28–32 unique routes)

| # | Route | Page | Data Source | Evidence Needed |
|---|-------|------|-------------|-----------------|
| 1 | / | ExecutiveOverview | deals, contacts, northStar | useExecutiveData |
| 2 | /dashboard | ExecutiveOverview | same | same |
| 3 | /command-center | CommandCenter | deals, health, setter | Real tables |
| 4 | /marketing | MarketingIntelligence | facebook_ads_insights, contacts | useMarketingAnalytics |
| 5 | /sales-pipeline | SalesPipeline | deals, contacts | Real |
| 6 | /revenue | RevenueIntelligence | deals, stripe | Real |
| 7 | /attribution | MarketingIntelligence | same | same |
| 8 | /clients | Clients | client_health_daily, contacts | Real |
| 9 | /clients/:email | ClientDetail | client + packages | Real |
| 10 | /coaches | Coaches | AWS sync + health | client_packages_live |
| 11 | /interventions | Interventions | intervention_log | Real |
| 12 | /global-brain | GlobalBrain | knowledge_base, agent_memory | Real |
| 13 | /ai-advisor | EnterpriseAIAdvisor | tools | Real |
| 14 | /sales-tracker | SalesCoachTracker | deals, contacts | Real |
| 15 | /calls | CallTracking | call_records | CallGear |
| 16 | /setter-command-center | SetterCommandCenter | call_records, contacts | Real |
| 17 | /skills | SkillCommandCenter | skills | Real |
| 18 | /war-room | WarRoom | deals, health, campaigns | useWarRoomData |
| 19 | /intelligence | BusinessIntelligenceAI | snapshot (kpis, funnel, campaigns) | business-intelligence |
| 20 | /daily-ops | DailyOps | daily_summary | Real |
| 21 | /client-activity | ClientActivity | activities | Real |
| 22 | /predictions | PredictiveIntelligence | churn, health | Real |
| 23 | /conversion-funnel | ConversionFunnel | funnel data | Real |
| 24 | /alert-center | AlertCenter | alerts | Real |
| 25 | /audit | AuditTrail | audit_log | Real |
| 26 | /coach-locations | CoachLocations | staff, locations | Real |
| 27 | /meta-ads | MetaAds | facebook_ads_insights | Real |
| 28 | /lead-tracking | LeadTracking | contacts, deals | Real |
| 29 | /enterprise/strategy | EnterpriseStrategy | strategy | Real |
| 30 | /enterprise/call-analytics | EnterpriseCallAnalytics | call_records | Real |
| 31 | /enterprise/observability | SystemObservability | edge function metrics | Real |
| 32 | /enterprise/ai-advisor | EnterpriseAIAdvisor | tools | Real |
| 33 | /enterprise/client-health | EnterpriseClientHealth | health | Real |
| 34 | /enterprise/coach-performance | EnterpriseCoachPerformance | coach metrics | Real |
| 35 | /enterprise/knowledge-base | EnterpriseKnowledgeBase | knowledge_base | Real |

**Hard evidence audit:** For each page, run in browser: check Network tab for Supabase/edge calls, verify no "No data" or empty states when data exists in DB. Focus first: ExecutiveOverview, BusinessIntelligenceAI, WarRoom, Coaches, SetterCommandCenter.

---

## 7. Remaining Findings (Last 3 Days)

From CRAW-FINDINGS, TRUTH-TABLE, MASTER-FINISH-PLAN:

| Priority | Item | Status |
|----------|------|--------|
| P0 | 14 migrations not applied | 4 new in DEPLOY-MANIFEST; others may exist |
| P0 | api/brain.ts text-embedding-004 | Check if RAG brain broken |
| P0 | OpenClaw security (3 critical) | Device auth, group policy, chmod 600 |
| P0 | Stripe/RDS hardcoded secrets | Rotate + env vars |
| P1 | Coaches.tsx depletion_priority | Should factor churn_score |
| P1 | toFixed null guards | See §4 |
| P1 | Snapshot fallbacks | See §4 |
| P2 | Sales Brain wiring | See §5 |
| P2 | 32 pages real-data audit | See §6 |

---

## 8. Recommended Next Steps

1. **Deploy:** `supabase db push` → `supabase functions deploy` (12 functions) → `git add -A && git commit && git push`
2. **P0-B:** Add null guards to ClientCard, HealthScoreBadge, BusinessIntelligenceAI, DailyTrends, CallIntelligenceKPIs, MetricDrilldownModal
3. **Verify Vercel:** Open production URL, confirm build = e2e4f5e or later after push
4. **Sales Brain:** Design unified agent (setter-performance + proactive-insights + call_records) and wire to SetterCommandCenter or /intelligence
5. **Page audit:** Script or manual check of 32 pages for real data (no hardcoded arrays, no empty when DB has rows)
