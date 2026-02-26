# FINAL AUTONOMOUS FINISH PLAN — Client Vital Suite
## Zero-Dependency Execution Blueprint (No Human Needed)
> Generated: 2026-02-27 02:01 GST | Agent: CRAW-COFOUNDER (ai-cofounder)
> Consolidates: MASTER-FINISH-PLAN + CRAW-FINDINGS + KNOWLEDGE.md + 3 deep audit reports + API Audit + MASTER-AUDIT-PROMPT + 12 plan docs from docs/plans/

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
| Google email (Feb 27) | gemini-3-pro-preview dies March 9, gemini-2.0-flash dies March 31 |

---

## CONNECTED DOTS (Items appearing in 2+ sources = highest confidence)

| Issue | Sources | Confidence |
|-------|---------|------------|
| Meta CAPI routes no auth | API Audit + MASTER-AUDIT + Security Audit | **TRIPLE CONFIRMED** |
| RDS password hardcoded in sync bridge | CRAW-FINDINGS + Data Pipeline Audit + Security Audit | **TRIPLE CONFIRMED** |
| Health pipeline split-brain | CRAW-FINDINGS + Data Pipeline Audit + KNOWLEDGE.md | **TRIPLE CONFIRMED** |
| gemini-2.0-flash deprecation | MASTER-AUDIT + Google email + codebase scan | **TRIPLE CONFIRMED** |
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
| OpenClaw agents on deprecated model | Google email + codebase scan (4 agents) | **DOUBLE CONFIRMED** |

---

## EXECUTION WAVES (Dependency-Ordered, Autonomous)

### WAVE 0: IMMEDIATE (Before anything else — 15 min)
> No code changes. Config only. Prevents agent death March 9.

```
0.1  Update 4 OpenClaw agents: gemini-3-pro-preview → gemini-3.1-pro-preview
     Files: ~/.openclaw/openclaw.json
     Agents: riki, marketing, forensic, forge
0.2  Gateway restart
0.3  Verify: openclaw agents list shows 0 deprecated models
```

### WAVE 1: SECURITY STOP-BLEED (4-6 hours)
> Fix everything that could leak data or allow unauthorized access RIGHT NOW.

```
OPENCLAW RUNTIME (15 min)
1.1  dangerouslyDisableDeviceAuth → false
1.2  All telegram groupPolicy → allowlist
1.3  All telegram dmPolicy → pairing (keep default open for @ai_ptdFitness_bot)
1.4  chmod 600 ~/.openclaw/openclaw.json
1.5  Gateway restart + openclaw security audit = 0 criticals

REPO SECRETS (30 min)
1.6  git rm --cached .env.stripe .env.stripe-check
1.7  Move RDS password from sync bridge to env var
1.8  Remove hardcoded cron_secret from scripts/set-database-settings.sh
1.9  Rotate: Stripe keys, RDS password, Qwen API key (manual step by Milos)
     → EXIT: git ls-files | rg '\.env' shows only .example

API AUTH (1-2 hours)
1.10 Add PTD_INTERNAL_ACCESS_KEY to: api/events/[name].ts, api/events/batch.ts, api/webhook/backfill.ts
1.11 Fix empty-key bypass: api/meta-cross-validate.ts → if (!PTD_KEY) return 401
1.12 Verify AGENT_API_KEY set in Vercel production
1.13 Remove master-sync fallback to SUPABASE_SERVICE_ROLE_KEY
1.14 Strengthen auth middleware: real JWT verify (not just split check)

CLIENT BUNDLE (1 hour)
1.15 Remove VITE_PTD_INTERNAL_ACCESS_KEY from: src/config/api.ts, src/lib/serverMemory.ts, src/lib/permanentMemory.ts
1.16 Route client→server calls through authenticated proxy
     → EXIT: rg VITE_PTD_INTERNAL src = 0 (excluding .d.ts)

WEBHOOKS (1 hour)
1.17 CallGear: implement HMAC-SHA256 verification
1.18 AnyTrack: add webhook secret verification
1.19 Calendly: add signature check
     → EXIT: All 3 reject unsigned payloads

P0-SEC-1: Math.random (30 min)
1.20 Replace Math.random() → crypto.randomUUID() in MetricDrilldownModal.tsx + SystemHealthMonitor.tsx
     → EXIT: rg "Math.random" src = 0

P0-SEC-3: Qwen hardcoded key (15 min)
1.21 Remove hardcoded key from supabase/functions/meta-ads-proxy/index.ts:264
     → EXIT: rg "sk-c357" = 0
```

### WAVE 2: TEST STABILIZATION (3-4 hours)
> Fix all 21 failing suites. No code ships without green tests.

```
STRUCTURAL (1 hour — fixes 8 suites)
2.1  Split Jest config: exclude supabase/functions from Jest roots
2.2  Add test:node + test:deno scripts in package.json
2.3  Add test:ci orchestration script

MOCK DRIFT (30 min — fixes 1 suite)
2.4  Update tests/useTruthTriangle.test.ts: .maybeSingle() not .single()

STALE TESTS (30 min — fixes 1 suite)
2.5  Fix/remove tests/MarketingAnalytics.test.tsx
2.6  Fix jest-dom matcher typing

PROMPT/TIMING (30 min — fixes 2 suites)
2.7  Rebaseline smart-prompt.test.ts
2.8  Fix smart-pause.test.ts floor-clamp

UI ASSERTION (1 hour — fixes 4 suites)
2.9  Fix Observability.test.tsx (duplicate text selector)
2.10 Fix AttributionLeaks.test.tsx (expected strings)
2.11 Fix GlobalBrain.test.tsx (stats/memory counts)
2.12 Fix SetterCommandCenter.test.tsx (KPI value)

TYPE BREAKAGES (1 hour — fixes 5 suites)
2.13 Fix AlertCenter.tsx useQuery generics
2.14 Fix AuditTrail.tsx:188 unknown → renderable
2.15 Fix useMarketingAnalytics.ts nullable math
2.16 Fix response-parser.test.ts + content-filter.test.ts imports

→ EXIT: CI=1 npm test = 30/30 ✅
```

### WAVE 3: MODEL MIGRATION (3-4 hours)
> Hard deadline: March 9 (agents), March 31 (edge functions)

```
CODEBASE (2 hours)
3.1  Replace gemini-2.0-flash → gemini-2.5-flash in 6 files (10 refs)
3.2  Replace text-embedding-004 → gemini-embedding-001 in 5 files (6 refs)
3.3  Add L2 normalization for 1536-dim embeddings
3.4  Route 5 raw-fetch files through unified-ai-client
3.5  Verify gemini-3-flash-preview stability (not deprecated)
     → EXIT: rg "gemini-2.0-flash" = 0, rg "text-embedding-004" = 0
```

### WAVE 4: DATA PIPELINE COMPLETION (6-8 hours)
> The TODO 2-5 from CRAW-FINDINGS. Unlocks Health Score v3.

```
SYNC BRIDGE UPGRADE (2 hours)
4.1  Switch aws-sync-bridge.cjs views: vw_schedulers → vw_powerbi_schedulers, etc.
4.2  Fix broken supabasePost helper (undefined)
4.3  Add launchd/cron orchestration
4.4  Move hardcoded RDS creds to env vars (if not done in Wave 1)

CLIENT REVIEWS SYNC (2 hours)
4.5  Create client_reviews table in Supabase
4.6  Build sync from AWS vw_powerbi_client_reviews (80K rows)
4.7  Update introspect_schema_verbose RPC

DEMOGRAPHICS SYNC (1 hour)
4.8  Enrich clients_full with: birthdate, gender, nationality, height, weight, injury, goals, marketing_campaign
4.9  Sync from vw_powerbi_clients
4.10 Update introspect_schema_verbose RPC

HEALTH SCORE v3 (2 hours — depends on 4.5-4.10)
4.11 Add Satisfaction (10pts), Revenue Value (10pts), Demographic Risk (5pts) to health-score-engine
4.12 Cut over all 15 callers from calculate-health-scores → health-score-engine
4.13 Update cron to use v3 engine as canonical scorer
4.14 Write to client_health_daily (not legacy client_health_scores)

ATTRIBUTION (1 hour)
4.15 Resolve conflicting view_call_attribution definitions (2 migrations)
4.16 Create single canonical migration
     → EXIT: One view, one health scorer, one cron
```

### WAVE 5: STALE CODE CLEANUP (4-5 hours)
> Largest ref count items. Machine-assisted find-replace.

```
5.1  client_health_scores → client_health_daily (268 refs, 50+ files)
5.2  Remove LangSmith imports (130 refs)
5.3  Remove .bak + remote_stub migration noise (9 files)
5.4  Clean archived page routes from main.tsx (3 refs)

MISSING FILES
5.5  Create WIRING_ANALYSIS.md (required by .cursorrules)
5.6  Create docs/CRON_MANIFEST.md (single cron source of truth)
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
     ├─ openclaw security audit → 0 criticals ✅
     ├─ openclaw agents list → 0 deprecated models ✅
     ├─ rg "gemini-2.0-flash" = 0 ✅
     ├─ rg "client_health_scores" = 0 ✅
     ├─ rg "Math.random" src = 0 ✅
     ├─ rg "langsmith" supabase src api = 0 ✅
     ├─ git ls-files | rg '\.env' → only .example ✅
     ├─ supabase migration list --linked → 0 drift ✅
     └─ Manual smoke test: 5 critical user paths ✅
```

---

## WRITE-BACK DISCIPLINE (Per Wave)

After EVERY completed fix:
1. `npm run build` (must pass)
2. If new DB table → update introspect_schema_verbose
3. Append finding to `docs/API_VERCEL_AUDIT_APPENDIX.md`
4. Add line to `docs/API_VERCEL_AUDIT_CHANGELOG.md`: `YYYY-MM-DD | CRAW | finding`
5. Add line to `docs/plans/RESEARCH_CHANGELOG.md` if applicable
6. `git commit -m "fix(craw): description"`

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
| Anthropic billing | Needs account top-up | Deferred |

---

## FUTURE WORK (Not in this plan — starts after Wave 7)

From KNOWLEDGE.md intelligence gap (46.7/82):
- Token budget tracker wiring (from BULLETPROOF batch 2B)
- Constitutional framing for 20 agents (from intelligence upgrade plan)
- select(*) remediation (384 instances)
- Tool adoption for ai-ceo-master + ptd-ultimate-intelligence
- Contact consolidation (16-24h project)
- UI: Restore 4 high-value archived pages (LeadFollowUp, Operations, HubSpotLive, Analytics)
- Attribution pipeline full close (ad→lead→call→deal→revenue chain)

---

## SCOREBOARD (FINAL)

| Wave | Items | Priority | Est. Hours | Deadline |
|------|-------|----------|------------|----------|
| 0. Agent Config | 3 | P0 | 0.25h | TODAY |
| 1. Security | 21 | P0 | 4-6h | Day 1 |
| 2. Tests | 16 | P0 | 3-4h | Day 1 |
| 3. Models | 5 | P0 | 3-4h | Before March 9 |
| 4. Data Pipeline | 16 | P1 | 6-8h | Day 2-3 |
| 5. Cleanup | 6 | P2 | 4-5h | Day 3 |
| 6. CORS/RLS | 3 | P2 | 2-3h | Day 3 |
| 7. Deploy | 5 | P1 | 2h | Day 4 |
| **TOTAL** | **75** | — | **24-33h** | **4 days** |

---

*Every finding from every source. Every dot connected. Every dependency mapped. Execute in order. No human needed except key rotations.*
