is that# Deep Research: Live API Services & Data Flow

**Generated:** 2026-02-19  
**Scope:** Auth patterns, response shape drift, hardcoded values, missing services, Supabase EF inventory

---

## 1. Auth Architecture

### 1.1 Vercel API Routes — PTD Key Gate

| Route | Auth Pattern | When PTD_INTERNAL_ACCESS_KEY Set |
|-------|--------------|-----------------------------------|
| api/brain | Inline: `x-ptd-key` or `authorization` | 401 if missing |
| api/threads | `checkAuth(req)` → `x-ptd-key` | 401 if missing |
| api/query | `checkAuth(req)` → `x-ptd-key` | 401 if missing |
| api/session | Inline PTD key | 401 if missing |
| api/memory | Inline PTD key | 401 if missing |
| api/user-memory | Inline PTD key | 401 if missing |
| api/system-check | Inline PTD key | 401 if missing |
| api/system | Inline PTD key | 401 if missing |
| api/stripe | Inline PTD key | 401 if missing |
| api/hubspot | Inline PTD key | 401 if missing |
| api/intelligence | Inline PTD key | 401 if missing |
| api/truth | Inline PTD key | 401 if missing |
| api/workspace | Inline PTD key | 401 if missing |
| api/create-agent-memory-table | Inline PTD key | 401 if missing |
| api/meta-cross-validate | Inline PTD key | 401 if missing |
| **api/health** | **None** | Always 200 (unless Vercel deployment protection) |
| **api/agent** | x-ptd-key OR x-agent-api-key OR authorization | Flexible |

### 1.2 Supabase Edge Functions — JWT vs verify_jwt

- **verify_jwt = true** (default): Supabase gateway requires `Authorization: Bearer <anon_or_auth_jwt>`. `supabase.functions.invoke()` sends session JWT automatically.
- **verify_jwt = false**: Webhooks and cron targets — anytrack-webhook, hubspot-webhook, stripe-webhook, calendly-webhook, hubspot-anytrack-webhook, hubspot-webhook-receiver, system-health-check, dialogflow-fulfillment, antigravity-followup-engine.

- **verifyAuth(req)** (in-code): 30+ EFs use `verifyAuth()` from `_shared/auth-middleware.ts`. It checks:
  - Rate limit: 50 req/min per IP
  - JWT structure (3 parts) — does NOT verify signature, only format
  - Token from `Authorization: Bearer` or `X-Auth-Token`

---

## 2. Response Shape Drift

### 2.1 BrainVisualizer vs api/brain

| Frontend Expects | API Returns | Status |
|------------------|-------------|--------|
| `chunksData.chunks` | `memories` | **MISMATCH** — chunks always empty |
| `chunks[].id` | `memories[].id` | OK |
| `chunks[].category` | — | Missing — use `memories[].knowledge_extracted?.source \|\| "memory"` |
| `chunks[].content` | — | Missing — use `memories[].query` or `memories[].response?.slice(0,200)` |
| `chunks[].created_at` | `memories[].created_at` | OK |
| `stats.total_knowledge_chunks` | `stats.total_knowledge_chunks` | OK (api has alias) |
| `stats.total_memories` | `stats.total_memories` | OK |

**Fix:** In BrainVisualizer, map `memories` → `chunks`:

```ts
const chunks = (chunksData.memories || []).map((m: any) => ({
  id: m.id,
  category: m.knowledge_extracted?.source || "memory",
  content: m.query || (m.response || "").slice(0, 200),
  created_at: m.created_at,
}));
setChunks(chunks);
```

### 2.2 GlobalBrain vs api/brain recent

GlobalBrain `loadMemories` expects `data.memories` and maps to `MemoryEntry`. API returns `memories` — **compatible**.

### 2.3 api/query Response vs global-brain/page

- api/query returns `{ ok, data: { answer, evidence, sourcesUsed }, latencyMs }`
- global-brain expects `data.data.answer`, `data.data.evidence`, `data.data.sourcesUsed` — **compatible**.

---

## 3. Hardcoded Values & Security

| Location | Value | Risk |
|----------|-------|------|
| `src/lib/serverMemory.ts` | `API_BASE = "https://client-vital-suite.vercel.app"` | Wrong domain if team URL differs; no x-ptd-key |
| `src/lib/permanentMemory.ts` | Same | Same |
| `src/pages/_archived/MetaDashboard.tsx` | `META_API_BASE = "https://client-vital-suite.vercel.app/api"` | Archived; low priority |
| `src/components/ai/PTDControlChat.tsx` | `"x-ptd-key": "ptd-secure-internal-2025-key-v2"` | **CRITICAL** — hardcoded secret; if prod key differs, fails |
| `src/components/ai/VoiceChat.tsx` | Same | Same |
| `src/components/ai/AIAssistantPanel.tsx` | Same | Same |
| `src/pages/CoachLocations.tsx` | Hardcoded Supabase URL for gps-dwell-engine | Per prior audit |

**Recommendation:** Use `import.meta.env.VITE_PTD_INTERNAL_ACCESS_KEY` everywhere. Never hardcode. Add `VITE_API_BASE` for serverMemory/permanentMemory.

---

## 4. Missing Auth Headers (401 Sources)

| Caller | Endpoint | Sends x-ptd-key? |
|--------|----------|------------------|
| BrainVisualizer | /api/brain | No |
| GlobalBrain (pages) | /api/brain, /api/query | No |
| global-brain/page.tsx | /api/threads, /api/query | No |
| serverMemory.ts | /api/session, /api/memory | No |
| permanentMemory.ts | /api/user-memory | No |
| PTDControlChat | /api/agent | Yes (hardcoded) |
| VoiceChat | /api/agent | Yes (hardcoded) |
| AIAssistantPanel | /api/agent | Yes (hardcoded) |
| FloatingChat | /api/agent | getAuthHeaders (anon only) |

---

## 5. API → Supabase Edge Function Proxies

Vercel routes that proxy to Supabase EFs (with PTD key when set):

| Vercel Route | Proxies To | Notes |
|--------------|------------|-------|
| api/agent | ptd-agent-gemini | Via ROUTE_TO_EDGE_FUNCTION |
| api/system-check | system-check | |
| api/events, api/events/batch | meta-capi | |
| api/orchestrator | super-agent-orchestrator | |
| api/brain | ptd-brain-api | In Vercel env, uses local api/brain.ts — NOT proxied |
| api/system | Dynamic: edgeFunction query param | |
| api/stripe | Dynamic: stripe-account-details, stripe-treasury, etc. | |
| api/hubspot | Dynamic | |
| api/intelligence | Dynamic | |
| api/query | — | Calls super-agent-orchestrator, generate-embeddings internally |

**Note:** In Vercel, `getApiUrl("/api/brain")` returns `/api/brain` (relative), so it hits Vercel serverless, not ptd-brain-api EF.

---

## 6. Supabase Edge Functions — Frontend Invoke Map

| EF Name | Invoked By | verify_jwt |
|---------|------------|------------|
| stripe-dashboard-data | RevenueIntelligence, StripeDashboardTab, dashboardApi | true |
| stripe-payouts-ai | StripeAIDashboard | true |
| stripe-forensics | StripeForensicsTab, StripeCompleteIntelligence | true |
| stripe-treasury | StripeTreasuryTab | true |
| stripe-payout-controls | StripePayoutControlsTab | true |
| hubspot-live-query | TodaysActivity, PipelineHealth, OwnerPerformanceGrid, etc. | true |
| hubspot-command-center | HubSpotCommandCenter | true |
| sync-hubspot-to-supabase | SyncStatusBadge, DashboardTab, QuickActionsPanel | true |
| sync-hubspot-to-capi | DataEnrichmentTab, CAPITab | true |
| enrich-with-stripe | DataEnrichmentTab | true |
| process-capi-batch | DataEnrichmentTab | true |
| send-to-stape-capi | CAPITab | true |
| business-intelligence | QuickActionsPanel, BusinessIntelligenceAI, MillionDollarPanel | true |
| business-intelligence-dashboard | MarketingIntelligence (archived) | true |
| smart-ai-advisor | Coaches, BusinessIntelligenceAI, useAIDevData | true |
| ai-ceo-master | use-ceo-data | true |
| ptd-execute-action | use-ceo-data | true |
| ai-learning-loop | use-ceo-data | true |
| ptd-24x7-monitor | WarRoom | true |
| health-calculator | HealthIntelligenceTab | true |
| churn-predictor | HealthIntelligenceTab, LiveQuickActions | true |
| anomaly-detector | HealthIntelligenceTab | true |
| intervention-recommender | HealthIntelligenceTab, QuickActionsPanel, PredictiveAlerts | true |
| daily-report | DashboardTab, AutomationTab, LiveQuickActions | true |
| data-quality | AutomationTab | true |
| integration-health | AutomationTab | true |
| pipeline-monitor | AutomationTab | true |
| coach-analyzer | CoachReviewsTab, AutomationTab | true |
| capi-validator | AutomationTab | true |
| ai-client-advisor | PredictiveIntelligence | true |
| ai-trigger-deploy | useAIDevData (approve/reject) | true |
| generate-embeddings | api/query (server-side) | true |
| super-agent-orchestrator | api/query | true |
| data-reconciler | AttributionLeaks (archived) | true |
| fetch-facebook-insights | MetaDashboard (archived) | true |
| marketing-predictor | useDeepIntelligence | true |
| financial-analytics | use-advanced-bi | true |
| customer-insights | use-advanced-bi | true |
| strategic-kpi | use-advanced-bi | true |
| master-sync | useMasterSync | true |
| proactive-insights-generator | ProactiveInsightsPanel | true |
| marketing-stress-test | StressTestDashboard | true |
| auto-reassign-leads | QuickActionsPanel, OwnerManagementTab | true |
| cleanup-fake-contacts | detectTestData | true |
| ultimate-aggregator | dashboardApi | true |
| ptd-watcher | DashboardTab | true |
| gps-dwell-engine | CoachLocations (hardcoded URL) | true |

---

## 7. EFs with verify_jwt = false (Webhooks / External)

- anytrack-webhook
- hubspot-anytrack-webhook
- calendly-webhook
- stripe-webhook
- hubspot-webhook
- hubspot-webhook-receiver
- system-health-check
- dialogflow-fulfillment
- antigravity-followup-engine

---

## 8. api/query Internal Dependencies

1. Reads: org_facts, ultimate_truth_events, client_health_scores, agent_memory (RAG)
2. Invokes: `super-agent-orchestrator`, `generate-embeddings` (deep mode)
3. Writes: org_query_log, org_messages, org_threads

---

## 9. Outstanding Issues Summary

| # | Severity | Issue |
|---|----------|-------|
| 1 | P0 | BrainVisualizer, GlobalBrain, global-brain/page: no x-ptd-key → 401 |
| 2 | P0 | serverMemory, permanentMemory: no x-ptd-key → 401 |
| 3 | P0 | BrainVisualizer: expects `chunks`, API returns `memories` → empty UI even when auth fixed |
| 4 | P1 | Hardcoded x-ptd-key in PTDControlChat, VoiceChat, AIAssistantPanel |
| 5 | P1 | Hardcoded API_BASE in serverMemory, permanentMemory |
| 6 | P2 | api/health 401 may be Vercel deployment protection (not route-level) |
| 7 | P2 | DEP0169 punycode deprecation (Supabase/Node) — warning only |

---

## 10. Recommended Fix Order

1. Add `x-ptd-key` from `VITE_PTD_INTERNAL_ACCESS_KEY` to BrainVisualizer, GlobalBrain, global-brain/page.
2. Map `memories` → `chunks` in BrainVisualizer.
3. Add `x-ptd-key` to serverMemory and permanentMemory (or use env-based API_BASE + key).
4. Replace hardcoded key in PTDControlChat, VoiceChat, AIAssistantPanel with env var.
5. Use `VITE_API_BASE` for serverMemory/permanentMemory base URL.
