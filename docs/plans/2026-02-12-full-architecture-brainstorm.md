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
1. No vector search on agent_learnings
2. No automatic knowledge extraction from conversations
3. No confidence decay over time
4. No conflict resolution between contradicting sources
5. No RAG quality evaluation (precision/recall unknown)
6. No prompt versioning

---

## DATABASE SCHEMA (Key Tables by Domain)

### CRM: contacts, leads, deals, staff, appointments, call_records
### Health: client_health_scores, historical_baselines, daily_summary
### Stripe: stripe_customers, stripe_charges, stripe_refunds, stripe_treasury_*
### Marketing: facebook_ads_insights, attribution_events, capi_events, marketing_agent_signals, marketing_recommendations, marketing_budget_proposals, creative_library
### AI/Agent: agent_knowledge, knowledge_chunks, agent_memory, agent_learnings, agent_decisions, agent_conversations, agent_patterns, agent_messages, reasoning_traces, proactive_insights
### Org Brain: org_memory_kv, org_documents, org_facts, org_memory_events, org_sessions
### Views: vw_sales_contacts, vw_active_clients, assessment_truth_matrix, source_discrepancy_matrix, company_health_aggregates

---

## BRAINSTORM: WHAT FRAMEWORK / APPROACH?

### Option A: Keep Custom + Improve (RECOMMENDED)

**Why:** You already have a working system. The custom stack (UnifiedAIClient + tool-executor + 12 executors) is equivalent to what LangChain/CrewAI would give you, but tailored to your domain.

**What to add:**
1. **Evaluation layer** — LLM-as-judge to score agent responses
2. **Prompt versioning** — Store prompts in `agent_knowledge` with version field
3. **Auto-knowledge extraction** — After each conversation, extract learnings
4. **Confidence decay** — Reduce confidence on knowledge not validated in 30 days
5. **RAG quality metrics** — Track retrieval precision per query
6. **Agent routing** — Smart router that picks the right agent/persona

**Cost:** Low — incremental improvements, no rewrite
**Risk:** Low — nothing breaks

### Option B: Migrate to CrewAI / LangGraph

**Why:** Multi-agent orchestration with built-in memory, tools, and evaluation.

**What you'd get:**
- Agent collaboration patterns (supervisor, swarm, hierarchical)
- Built-in memory management
- Tool use framework
- LangSmith integration (you already have keys)

**What you'd lose:**
- All 65 shared modules need rewriting
- Edge function architecture doesn't support Python (CrewAI is Python)
- Would need to move to Cloud Run or similar (you just deleted that)

**Cost:** HIGH — complete rewrite
**Risk:** HIGH — months of work, new infrastructure

### Option C: Hybrid — Keep Backend, Add CrewAI for Orchestration Only

**Why:** Use CrewAI/LangGraph ONLY for the orchestration layer (agent routing, collaboration). Keep all edge functions as-is.

**What it looks like:**
- One new edge function: `crew-orchestrator`
- CrewAI TypeScript SDK (experimental) or LangGraph.js
- Routes queries to existing edge functions as "tools"
- Adds supervisor pattern on top

**Cost:** Medium — one new function + integration
**Risk:** Medium — TypeScript CrewAI is immature

---

## RECOMMENDED NEXT STEPS

### Phase 1: Clean Up (1 day)
- Delete 15+ truly orphaned functions
- Archive deprecated functions
- Remove dead code from shared modules

### Phase 2: Wire Missing Features (2-3 days)
- Wire marketing 5-Agent War Room to UI
- Wire `ptd-agent-atlas` to a command center page
- Wire `weekly-ceo-report` to exec dashboard

### Phase 3: Intelligence Upgrade (1 week)
- Add evaluation framework (LLM-as-judge)
- Add prompt versioning to `agent_knowledge`
- Add auto-knowledge extraction after conversations
- Add confidence decay for stale knowledge
- Add RAG quality tracking

### Phase 4: Smart Routing (1 week)
- Build intelligent query router that picks the right persona
- Add multi-agent collaboration for complex queries
- Use existing `agent-orchestrator` as foundation

---

## EXTERNAL APIs NEEDED

| API | Status | Used By |
|-----|--------|---------|
| Gemini (generativelanguage.googleapis.com) | ACTIVE | All AI agents via GEMINI_API_KEY |
| Stripe (api.stripe.com) | ACTIVE | 12 stripe-* functions via STRIPE_SECRET_KEY |
| HubSpot (api.hubapi.com) | ACTIVE | 15 hubspot-* functions via HUBSPOT_API_KEY |
| Meta/Facebook (graph.facebook.com) | ACTIVE | Via Pipeboard MCP (PIPEBOARD_API_KEY) |
| CallGear (via Supabase sync) | ACTIVE | callgear-* functions |
| Google Maps (maps.googleapis.com) | ACTIVE | location-service.ts |
| LangSmith (api.smith.langchain.com) | OPTIONAL | Tracing if LANGSMITH_API_KEY set |
| AnyTrack | ACTIVE | Webhooks → attribution_events |
| Stape CAPI | ACTIVE | send-to-stape-capi |

No Google Cloud infrastructure needed. Everything runs on Supabase + Vercel + API keys.
