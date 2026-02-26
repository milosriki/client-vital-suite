# FINAL AUTONOMOUS FINISH PLAN — Client Vital Suite
## Zero-Dependency Execution Blueprint (No Human Needed)
> Generated: 2026-02-27 02:01 GST | Agent: CRAW-COFOUNDER (ai-cofounder)
> Consolidates: MASTER-FINISH-PLAN + CRAW-FINDINGS + KNOWLEDGE.md + 3 deep audit reports + API Audit + MASTER-AUDIT-PROMPT + 12 plan docs from docs/plans/
> **SCOPE: client-vital-suite ONLY. OpenClaw agents are INDEPENDENT — not part of this plan.**

---

## Source Documents Cross-Referenced

| Source | Key Items Extracted |
|--------|-------------------|
| MASTER-FINISH-PLAN-2026-02-27.md | 77 items, 7 phases, 4-day timeline |
| CRAW-FINDINGS-2026-02-26.md | TODO 2-5, cancel status discovery, PowerBI views, health v3, team structure |
| KNOWLEDGE.md | 28 gaps from forensic audit, 384 select(*), intelligence gap 82→46.7, 26 archived pages |
| AUDIT_DATA_PIPELINE_2026-02-26.md | sync bridge secrets, split-brain health, attribution conflict, cron fragmentation |
| AUDIT_SECURITY_2026-02-26.md | 8 P0 + 6 P1 + 4 P2 security findings |
| AUDIT_TESTS_2026-02-26.md | 7 root-cause clusters, 21 failing suites |
| API_VERCEL_AUDIT_FINDINGS.md | 4 no-auth CAPI routes, CORS wildcards, empty-key bypass |
| MASTER-AUDIT-PROMPT.md | P0-SEC-1 through P0-SEC-7, model changes, gap list |
| BULLETPROOF_EXECUTION.md | Batch status tracker (most 0% complete) |

---

## CONNECTED DOTS (Items appearing in 2+ sources = highest confidence)

| Issue | Sources | Confidence |
|-------|---------|------------|
| Meta CAPI routes no auth | API Audit + MASTER-AUDIT + Security Audit | **TRIPLE CONFIRMED** |
| RDS password hardcoded in sync bridge | CRAW-FINDINGS + Data Pipeline Audit + Security Audit | **TRIPLE CONFIRMED** |
| Health pipeline split-brain | CRAW-FINDINGS + Data Pipeline Audit + KNOWLEDGE.md | **TRIPLE CONFIRMED** |
| client_health_scores stale refs | MASTER-AUDIT + KNOWLEDGE.md + codebase scan (268 refs) | **TRIPLE CONFIRMED** |
| VITE key exposed in client bundle | MASTER-AUDIT + Security Audit + codebase scan | **TRIPLE CONFIRMED** |
| text-embedding-004 deprecated | MASTER-AUDIT + API Audit + codebase scan (6 refs) | **TRIPLE CONFIRMED** |
| Attribution view conflicts | Data Pipeline Audit + codebase scan (2 migrations) | **DOUBLE CONFIRMED** |
| LangSmith dead refs | MASTER-AUDIT + codebase scan (130 refs) | **DOUBLE CONFIRMED** |
| Math.random in production | MASTER-AUDIT + codebase scan (16 refs) | **DOUBLE CONFIRMED** |
| WIRING_ANALYSIS.md missing | MASTER-AUDIT + .cursorrules + KNOWLEDGE.md | **TRIPLE CONFIRMED** |
| 21 failing test suites | Tests Audit + codebase run | **DOUBLE CONFIRMED** |
| CORS wildcard 24 routes | API Audit + MASTER-AUDIT + Security Audit | **TRIPLE CONFIRMED** |
| select(*) 384 instances | KNOWLEDGE.md + intelligence audit | **DOUBLE CONFIRMED** |
| Agent intelligence gap 46.7/82 | KNOWLEDGE.md + intelligence upgrade plan | **DOUBLE CONFIRMED** |
| Token budget tracker broken | KNOWLEDGE.md + BULLETPROOF | **DOUBLE CONFIRMED** |

---

## INTELLIGENCE ARCHITECTURE (Reverse-Engineered from Codebase)

### Current State — 9 Intelligence Engines

| Engine | Lines | Version | Purpose | Data Source | Output Table |
|--------|-------|---------|---------|-------------|-------------|
| `health-score-engine` | 478 | v2.0 | 5D RFM+ client health scoring | client_packages_live + training_sessions_live | client_health_daily |
| `client-intelligence-engine` | 641 | v1.0 | Self-learning pattern detection (churn, ghost, stall) | client_health_daily + training_sessions_live | prepared_actions |
| `coach-intelligence-engine` | 523 | v1.0 | GPS×AWS crosscheck, trust ledger, fraud detection | mdm_gps_data + training_sessions_live | coach_recommendations |
| `ml-churn-score` | 409 | v1.0 | Sigmoid ML churn prediction (7d/30d/90d) | Feature engineering from health + sessions | proactive_insights |
| `proactive-insights-generator` | 471 | v1.0 | LLM-powered insight generation with call scripts | client_health_daily + business rules | proactive_insights |
| `ptd-brain-api` | 108 | v1.0 | RAG recall via pgvector embeddings | knowledge_chunks (vector search) | API response |
| `ai-analyst-engine` | 303 | v1.0 | LLM analyst with tool use (schema introspection) | All tables via tools | agent_memory |
| `ai-ceo-master` | 382 | v1.0 | Executive briefing + strategic recommendations | Aggregated KPIs | atlas_actions |
| `ptd-ultimate-intelligence` | 807 | v1.0 | Multi-persona AI system (CEO, CTO, CMO, CFO) | All data sources | Multiple |

### Shared Infrastructure

| Component | File | Purpose |
|-----------|------|---------|
| `unified-ai-client.ts` | 510+ lines | Gemini 3.1 Pro → Flash → DeepSeek cascade, circuit breaker, token tracking |
| `constitutional-framing.ts` | — | System prompt governance for all AI agents |
| `intelligence-engine.ts` | — | Shared intelligence utilities |
| `unified-brain.ts` | — | Brain coordination layer |
| `observability.ts` | — | Tracing + structured logging |

### Intelligence Tables (pgvector + structured)

| Table | Purpose | Rows (est) |
|-------|---------|-----------|
| knowledge_chunks | RAG vector store (768d Gemini embeddings) | ~1K |
| agent_memory | Agent long-term memory with embeddings | ~500 |
| agent_patterns | Detected behavioral patterns | ~200 |
| prepared_actions | Actionable recommendations queue | ~100 |
| proactive_insights | Churn alerts + call scripts | ~500 |
| client_health_daily | Daily health snapshots per client | ~5K/day |
| client_health_patterns | Detected health trajectory patterns | ~2K |
| coach_recommendations | Coach-level intelligence outputs | ~200 |
| atlas_actions | Strategic recommendations from AI CEO | ~100 |
| ai_insights | General AI-generated insights | ~500 |

### What's WORKING (Intelligence that flows)

1. **Health Score Pipeline**: `health-score-engine` → `client_health_daily` → Dashboard ✅
2. **Churn Prediction**: `ml-churn-score` → `proactive_insights` → Alerts ✅
3. **Coach GPS Intelligence**: `coach-intelligence-engine` → `coach_recommendations` ✅
4. **RAG Recall**: `ptd-brain-api` → `knowledge_chunks` via pgvector ✅
5. **Proactive Insights**: `proactive-insights-generator` → Zod-validated outputs ✅

### What's BROKEN or INCOMPLETE

1. **Split-brain health**: `calculate-health-scores` (legacy) vs `health-score-engine` (v2) — 268 stale refs
2. **No satisfaction signal**: Health v2 lacks review data (80K reviews available in AWS)
3. **No revenue signal**: Health v2 lacks per-session pricing data (available in PowerBI views)
4. **Token budget tracker**: Broken/unwired — no cost visibility
5. **Constitutional framing**: Only 2-3 agents use it, should be all
6. **Embedding model**: text-embedding-004 deprecated → needs gemini-embedding-001 migration
7. **Attribution chain**: Ad→Lead→Call→Deal→Revenue chain still has gaps (KNOWLEDGE.md Section 1-3)

---

## EXECUTION WAVES (Dependency-Ordered, App-Only)

### WAVE 1: SECURITY STOP-BLEED (4-6 hours)
> Fix everything that could leak data or allow unauthorized access RIGHT NOW.

```
REPO SECRETS (30 min)
1.1  git rm --cached .env.stripe .env.stripe-check
1.2  Move RDS password from sync bridge to env var
1.3  Remove hardcoded cron_secret from scripts/set-database-settings.sh
1.4  Rotate: Stripe keys, RDS password, Qwen API key (manual step by Milos)
     → EXIT: git ls-files | rg '\.env' shows only .example

API AUTH (1-2 hours)
1.5  Add PTD_INTERNAL_ACCESS_KEY to: api/events/[name].ts, api/events/batch.ts, api/webhook/backfill.ts
1.6  Fix empty-key bypass: api/meta-cross-validate.ts → if (!PTD_KEY) return 401
1.7  Verify AGENT_API_KEY set in Vercel production
1.8  Remove master-sync fallback to SUPABASE_SERVICE_ROLE_KEY
1.9  Strengthen auth middleware: real JWT verify (not just split check)

CLIENT BUNDLE (1 hour)
1.10 Remove VITE_PTD_INTERNAL_ACCESS_KEY from: src/config/api.ts, src/lib/serverMemory.ts, src/lib/permanentMemory.ts
1.11 Route client→server calls through authenticated proxy
     → EXIT: rg VITE_PTD_INTERNAL src = 0 (excluding .d.ts)

WEBHOOKS (1 hour)
1.12 CallGear: implement HMAC-SHA256 verification
1.13 AnyTrack: add webhook secret verification
1.14 Calendly: add signature check
     → EXIT: All 3 reject unsigned payloads

P0-SEC-1: Math.random (30 min)
1.15 Replace Math.random() → crypto.randomUUID() in MetricDrilldownModal.tsx + SystemHealthMonitor.tsx
     → EXIT: rg "Math.random" src = 0

P0-SEC-3: Qwen hardcoded key (15 min)
1.16 Remove hardcoded key from supabase/functions/meta-ads-proxy/index.ts:264
     → EXIT: rg "sk-c357" = 0
```

### WAVE 2: TEST STABILIZATION (3-4 hours)
> Fix all 21 failing suites. No code ships without green tests.

```
STRUCTURAL (1 hour — fixes 8 suites)
2.1  Split Jest config: exclude supabase/functions from Jest roots
2.2  Add test:node + test:deno scripts in package.json
2.3  Add test:ci orchestration script

MOCK DRIFT (30 min)
2.4  Update tests/useTruthTriangle.test.ts: .maybeSingle() not .single()

STALE TESTS (30 min)
2.5  Fix/remove tests/MarketingAnalytics.test.tsx
2.6  Fix jest-dom matcher typing

UI ASSERTION (1 hour)
2.7  Fix Observability.test.tsx (duplicate text selector)
2.8  Fix AttributionLeaks.test.tsx (expected strings)
2.9  Fix GlobalBrain.test.tsx (stats/memory counts)
2.10 Fix SetterCommandCenter.test.tsx (KPI value)

TYPE BREAKAGES (1 hour)
2.11 Fix AlertCenter.tsx useQuery generics
2.12 Fix AuditTrail.tsx:188 unknown → renderable
2.13 Fix useMarketingAnalytics.ts nullable math
2.14 Fix response-parser.test.ts + content-filter.test.ts imports
     → EXIT: CI=1 npm test = 30/30 ✅
```

### WAVE 3: MODEL + EMBEDDING MIGRATION (2-3 hours)
> Deprecated models die. Fix before they break.

```
3.1  Replace gemini-2.0-flash → gemini-2.5-flash in 6 edge function files (10 refs)
3.2  Replace text-embedding-004 → gemini-embedding-001 in 5 files (6 refs)
3.3  Add L2 normalization for 1536→768-dim embedding transition
3.4  Route 5 raw-fetch files through unified-ai-client
3.5  Verify gemini-3-flash-preview stability (not deprecated)
     → EXIT: rg "gemini-2.0-flash" = 0, rg "text-embedding-004" = 0
```

### WAVE 4: INTELLIGENCE PIPELINE HARDENING (6-8 hours)
> The core brain. Make it complete, correct, and autonomous.

```
HEALTH SCORE v3 — THE FORMULA (2 hours)
4.1  Switch sync bridge to PowerBI views:
     - vw_schedulers → vw_powerbi_schedulers (adds base_value, client_review_trainer)
     - vw_client_packages → vw_powerbi_clientpackages (adds payment info)
     - vw_client_master → vw_powerbi_clients (adds demographics)
4.2  Create client_reviews table + sync from vw_powerbi_client_reviews (80K reviews)
4.3  Enrich clients_full with demographics from vw_powerbi_clients
4.4  Update health-score-engine to v3:
     Score = 100 points:
     - Recency (20): days since last completed session
     - Frequency (20): sessions/week vs expected pace
     - Consistency (15): trend 14d vs prior 14d + cancel rate
     - Package Health (10): remaining sessions vs expiry
     - Engagement (10): future bookings count
     - Satisfaction (10): avg review rating from client_reviews ⭐ NEW
     - Revenue Value (10): session price tier from PowerBI ⭐ NEW
     - Demographic Risk (5): age/gender churn correlation ⭐ NEW

SPLIT-BRAIN CURE (2 hours)
4.5  Cut over all 15+ callers from calculate-health-scores → health-score-engine
4.6  Rename all refs: client_health_scores → client_health_daily (268 refs, 50+ files)
4.7  Single canonical cron for health scoring (health-score-engine only)
4.8  Deprecate calculate-health-scores (move to _archive)

CHURN MODEL UPGRADE (1 hour)
4.9  Add satisfaction + revenue signals to ml-churn-score feature set
4.10 Wire proactive_insights to Telegram daily report
4.11 Add constitutional framing to all 9 intelligence engines

ATTRIBUTION CHAIN FIX (1 hour)
4.12 Resolve conflicting view_call_attribution definitions (2 migrations)
4.13 Create single canonical migration
4.14 Wire ad_id → contact → deal → revenue chain end-to-end

RAG UPGRADE (1 hour)
4.15 Migrate embedding model: text-embedding-004 → gemini-embedding-001
4.16 Rebuild knowledge_chunks embeddings with new model
4.17 Update match_knowledge_chunks RPC for new dimensions
     → EXIT: One health scorer, one cron, one attribution view, RAG operational
```

### WAVE 5: STALE CODE CLEANUP (4-5 hours)
```
5.1  Remove LangSmith imports (130 refs across codebase)
5.2  Remove .bak + remote_stub migration noise (9 files)
5.3  Clean archived page routes from main.tsx (7 refs pointing to _archived)
5.4  Create WIRING_ANALYSIS.md (required by .cursorrules, currently missing)
5.5  Create docs/CRON_MANIFEST.md (single cron source of truth)
     → EXIT: All rg counts = 0 for stale refs
```

### WAVE 6: CORS & RLS HARDENING (2-3 hours)
```
6.1  Replace CORS * in 24 API routes with domain allowlist
6.2  Switch 4 edge functions to SDK corsHeaders
6.3  Audit USING(true)/TO anon grants, tighten to authenticated
     → EXIT: No wildcard CORS in production
```

### WAVE 7: DEPLOY & VERIFY (2 hours)
```
7.1  Resolve migration drift (local-only vs remote-only)
7.2  Commit all waves with conventional commits
7.3  Deploy frontend: npx vercel deploy --prod
7.4  Deploy edge functions: supabase functions deploy
7.5  Full verification matrix:
     ├─ npm run build ✅
     ├─ npx tsc --noEmit ✅
     ├─ CI=1 npm test → 30/30 ✅
     ├─ rg "gemini-2.0-flash" = 0 ✅
     ├─ rg "client_health_scores" = 0 ✅
     ├─ rg "Math.random" src = 0 ✅
     ├─ rg "langsmith" supabase src api = 0 ✅
     ├─ git ls-files | rg '\.env' → only .example ✅
     ├─ supabase migration list --linked → 0 drift ✅
     └─ Manual smoke test: 5 critical user paths ✅
```

---

## ITEMS REQUIRING MILOS (Cannot Automate)

| Item | Why | Wave |
|------|-----|------|
| Rotate Stripe API keys | Needs Stripe dashboard access | 1 |
| Rotate RDS password | Needs AWS console | 1 |
| Rotate Qwen API key | Needs Alibaba Cloud | 1 |
| Verify AGENT_API_KEY in Vercel | Needs Vercel dashboard | 1 |
| Set PTD_INTERNAL_ACCESS_KEY in Vercel | Needs Vercel dashboard | 1 |
| Webflow GTM/noscript fix | Needs Webflow access | Deferred |

---

## SCOREBOARD (FINAL)

| Wave | Items | Priority | Est. Hours | Deadline |
|------|-------|----------|------------|----------|
| 1. Security | 16 | P0 | 4-6h | Day 1 |
| 2. Tests | 14 | P0 | 3-4h | Day 1 |
| 3. Models | 5 | P0 | 2-3h | Day 2 |
| 4. Intelligence | 17 | P1 | 6-8h | Day 2-3 |
| 5. Cleanup | 5 | P2 | 4-5h | Day 3 |
| 6. CORS/RLS | 3 | P2 | 2-3h | Day 3 |
| 7. Deploy | 5 | P1 | 2h | Day 4 |
| **TOTAL** | **65** | — | **23-31h** | **4 days** |

---

*Every finding from every source. Every dot connected. Every dependency mapped. Execute in order. No human needed except key rotations. OpenClaw agents are INDEPENDENT — not in scope.*
