# MASTER FINISH PLAN — Client Vital Suite
## 100% Project Completion Vision
> Generated: 2026-02-27 01:44 GST | Agent: CRAW-COFOUNDER
> Sources: 3 deep audit reports + CRAW-FINDINGS + API audit + security audit + live repo scan

---

## Current State (Verified Live)

| Metric | Value | Status |
|--------|-------|--------|
| Build | ✅ 9.57s, 0 errors | GREEN |
| TypeScript | ✅ 0 errors | GREEN |
| Tests | ❌ 21 failed / 9 passed / 30 suites | RED |
| Pages | 62 .tsx files | — |
| Edge Functions | 204 dirs | — |
| Hooks | 29 | — |
| Migrations | 241 | — |
| Uncommitted | 7 files (4 new audit docs) | YELLOW |
| OpenClaw Security | 3 critical / 8 warn / 2 info | RED |

---

## PHASE 1: SECURITY LOCKDOWN (P0 — Do First)
> Estimated: 4-6 hours | Risk: HIGH if delayed

### 1.1 OpenClaw Runtime (3 criticals)
- [ ] **Disable device auth bypass**: `dangerouslyDisableDeviceAuth → false`
- [ ] **Lock all Telegram group policies**: `groupPolicy → "allowlist"` on riki, marketing, business, forensic, default
- [ ] **Lock all Telegram DM policies**: `dmPolicy → "pairing"` on all 5 open accounts
- [ ] **Fix config permissions**: `chmod 600 ~/.openclaw/openclaw.json`
- [ ] **Restart gateway + verify**: `openclaw gateway restart && openclaw security audit`
- [ ] **Exit criteria**: `openclaw security audit` shows 0 criticals

### 1.2 Repo Secret Exposure
- [ ] **Untrack `.env.stripe` + `.env.stripe-check`**: `git rm --cached .env.stripe .env.stripe-check`
- [ ] **Rotate exposed Stripe keys** in Stripe dashboard
- [ ] **Rotate exposed RDS password** (`tiM6s1uzuspOsipr` hardcoded in `scripts/aws-sync-bridge.cjs:34`)
- [ ] **Rotate exposed Qwen API key** (`sk-c357...0125` in `~/.openclaw/agents/ai-cofounder/agent/models.json`)
- [ ] **Move sync bridge secrets to env vars**: Replace hardcoded RDS creds with `process.env.RDS_PASSWORD`
- [ ] **Remove hardcoded cron_secret**: `scripts/set-database-settings.sh:37`
- [ ] **Exit criteria**: `git ls-files | rg '\.env'` shows only `.example` files; 0 hardcoded secrets in `rg`

### 1.3 API Auth Hardening
- [ ] **Add auth to Meta CAPI routes**: `api/events/[name].ts`, `api/events/batch.ts`, `api/webhook/backfill.ts` — add `PTD_INTERNAL_ACCESS_KEY` check
- [ ] **Fix empty-key bypass**: `api/meta-cross-validate.ts` — explicit `if (!PTD_KEY) return 401`
- [ ] **Verify AGENT_API_KEY is set** in Vercel production env
- [ ] **Remove master-sync fallback**: Remove `|| Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` from `supabase/functions/master-sync/index.ts:26`
- [ ] **Strengthen auth middleware**: Replace `parts.length !== 3` check with real JWT verification via `supabase.auth.getUser(token)`
- [ ] **Exit criteria**: 0 unauthenticated write endpoints

### 1.4 VITE Client-Side Key Exposure
- [ ] **Remove `VITE_PTD_INTERNAL_ACCESS_KEY`** from client bundle: `src/config/api.ts`, `src/lib/serverMemory.ts`, `src/lib/permanentMemory.ts`
- [ ] **Route client→server calls through authenticated proxy** instead of direct API key
- [ ] **Exit criteria**: `rg VITE_PTD_INTERNAL src` returns 0 hits (excluding `.d.ts`)

### 1.5 Webhook Signature Verification
- [ ] **CallGear**: Implement HMAC-SHA256 verification (TODO already in code)
- [ ] **AnyTrack**: Add webhook secret verification
- [ ] **Calendly**: Add webhook signature check (Calendly supports it)
- [ ] **Exit criteria**: All 3 webhooks reject unsigned payloads

---

## PHASE 2: TEST SYSTEM STABILIZATION (P0)
> Estimated: 3-4 hours | Blast radius: 21 failing suites → 0

### 2.1 Split Node vs Deno Tests (Quick Win — fixes 8 suites)
- [ ] **Remove `supabase/functions` from Jest roots** in `jest.config.ts`
- [ ] **Add `test:node` and `test:deno` scripts** in `package.json`
- [ ] **Add CI orchestration script**: `test:ci` that runs both
- [ ] **Exit criteria**: Jest only runs `tests/` dir; Deno tests run separately

### 2.2 Fix Mock Drift (Quick Win — fixes 1 suite)
- [ ] **Update `tests/useTruthTriangle.test.ts`**: mock chain provides `.maybeSingle()` not `.single()`
- [ ] **Exit criteria**: `useTruthTriangle.test.ts` passes

### 2.3 Fix Stale Test References (Quick Win — fixes 1 suite)
- [ ] **Fix/remove `tests/MarketingAnalytics.test.tsx`**: missing page import
- [ ] **Fix jest-dom matcher typing** in test setup
- [ ] **Exit criteria**: MarketingAnalytics test passes or cleanly removed

### 2.4 Align Prompt/Timing Tests (fixes 2 suites)
- [ ] **Rebaseline `smart-prompt.test.ts`** to current phase taxonomy
- [ ] **Fix `smart-pause.test.ts`** floor-clamp edge case
- [ ] **Exit criteria**: Both pass

### 2.5 Fix UI Assertion Drift (fixes 4 suites)
- [ ] **`Observability.test.tsx`**: Fix duplicate text selector collision
- [ ] **`AttributionLeaks.test.tsx`**: Update expected strings to current UI
- [ ] **`GlobalBrain.test.tsx`**: Update expected stats/memory counts
- [ ] **`SetterCommandCenter.test.tsx`**: Update expected KPI value
- [ ] **Exit criteria**: All 4 pass

### 2.6 Fix Type-Level Breakages (fixes 5 suites)
- [ ] **`AlertCenter.tsx`**: Fix useQuery generic contracts
- [ ] **`AuditTrail.tsx:188`**: Fix `unknown` → renderable type
- [ ] **`useMarketingAnalytics.ts`**: Fix nullable math + accumulator types
- [ ] **`response-parser.test.ts` + `content-filter.test.ts`**: Fix .ts import resolution
- [ ] **Exit criteria**: All compile and pass

### Phase 2 Exit: `CI=1 npm test` → 30/30 suites pass ✅

---

## PHASE 3: MODEL MIGRATION (P1 — Before March 31)
> Estimated: 2-3 hours | Deadline: gemini-2.0-flash shutdown March 31, 2026

### 3.1 Gemini 2.0-flash → 2.5-flash (10 occurrences, 6 files)
- [ ] `supabase/functions/_shared/unified-ai-client.ts`
- [ ] `supabase/functions/vision-analytics/index.ts`
- [ ] `supabase/functions/ai-ceo-master/index.ts` (3 refs)
- [ ] `supabase/functions/multi-agent-orchestrator/index.ts` (2 refs)
- [ ] `supabase/functions/smart-ai-advisor/index.ts`
- [ ] `supabase/functions/ptd-ultimate-intelligence/index.ts` (3 refs)
- [ ] **Exit criteria**: `rg "gemini-2.0-flash" supabase src api` returns 0

### 3.2 text-embedding-004 → gemini-embedding-001
- [ ] **`api/brain.ts`**: Switch to `gemini-embedding-001` with `outputDimensionality: 1536`
- [ ] **Update endpoint**: `POST generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent`
- [ ] **Add L2 normalization** for non-3072 dims
- [ ] **Exit criteria**: Brain API returns embeddings from new model; `rg "text-embedding-004"` returns 0

### 3.3 Raw Gemini Fetch → unified-ai-client (5 bypass files)
- [ ] `supabase/functions/ai-analyst-engine/index.ts`
- [ ] `supabase/functions/ai-config-status/index.ts`
- [ ] `supabase/functions/debug-env/index.ts`
- [ ] `supabase/functions/smart-ai-advisor/index.ts`
- [ ] `supabase/functions/super-agent-orchestrator/index.ts`
- [ ] **Exit criteria**: Only `unified-ai-client.ts` calls `generativelanguage.googleapis.com`

---

## PHASE 4: DATA PIPELINE COMPLETION (P1)
> Estimated: 6-8 hours

### 4.1 AWS Sync Bridge → PowerBI Views (TODO 2)
- [ ] **Switch `scripts/aws-sync-bridge.cjs`** from `vw_schedulers, vw_client_packages, vw_client_master` to `vw_powerbi_schedulers, vw_powerbi_clientpackages, vw_powerbi_clients`
- [ ] **Fix broken `supabasePost` helper** (undefined — from audit finding)
- [ ] **Add launchd/cron orchestration** (missing despite commit message claiming it)
- [ ] **Exit criteria**: Sync runs end-to-end with richer PowerBI data

### 4.2 Client Reviews Sync (TODO 4)
- [ ] **Create `client_reviews` table** in Supabase
- [ ] **Sync from AWS `vw_powerbi_client_reviews`** (80K rows)
- [ ] **Update `introspect_schema_verbose`** RPC
- [ ] **Exit criteria**: Reviews table populated, agent can query it

### 4.3 Client Demographics Sync (TODO 5)
- [ ] **Enrich `clients_full`** or create new table with: birthdate, gender, nationality, height, weight, injury, goals, marketing_campaign
- [ ] **Sync from AWS `vw_powerbi_clients`**
- [ ] **Update `introspect_schema_verbose`** RPC
- [ ] **Exit criteria**: Demographics available in Supabase

### 4.4 Health Score v3 (TODO 3 — depends on 4.2 + 4.3)
- [ ] **Add to `health-score-engine`**: Satisfaction (10pts, from reviews), Revenue Value (10pts, session price), Demographic Risk (5pts)
- [ ] **Resolve split-brain**: Cut over all callers from `calculate-health-scores` → `health-score-engine`
- [ ] **Update cron schedule** to use v3 engine as canonical scorer
- [ ] **Exit criteria**: One health scorer, one cron, all callers unified

### 4.5 Attribution Pipeline Stabilization
- [ ] **Resolve conflicting `view_call_attribution`** definitions in migrations `20260224230000` and `20260225000002`
- [ ] **Create single canonical migration** with stable contract
- [ ] **Exit criteria**: One view definition, no contract drift

---

## PHASE 5: STALE CODE CLEANUP (P2)
> Estimated: 4-5 hours

### 5.1 client_health_scores → client_health_daily (268 refs)
- [ ] **Global find-replace** across 50+ files
- [ ] **Verify queries still work** against actual table
- [ ] **Exit criteria**: `rg "client_health_scores" supabase src` returns 0

### 5.2 LangSmith Cleanup (130 refs)
- [ ] **Remove all LangSmith imports and references** (no longer used)
- [ ] **Exit criteria**: `rg "langsmith|LangSmith" supabase src api` returns 0

### 5.3 Math.random → crypto.randomUUID (16 refs)
- [ ] **Replace in `MetricDrilldownModal.tsx`** (lines 76, 88, 102, 181-182)
- [ ] **Replace in `SystemHealthMonitor.tsx`** (line 42)
- [ ] **Exit criteria**: `rg "Math.random" src` returns 0

### 5.4 Migration Noise Cleanup (9 files)
- [ ] **Remove `.bak` and `remote_stub` files** from `supabase/migrations/`
- [ ] **Exit criteria**: 0 noise files

### 5.5 Missing Files
- [ ] **Create `WIRING_ANALYSIS.md`** (required by `.cursorrules`)
- [ ] **Create `docs/CRON_MANIFEST.md`** (single source of truth for all cron jobs)
- [ ] **Exit criteria**: Both files exist with accurate content

---

## PHASE 6: CORS & POLICY HARDENING (P2)
> Estimated: 2-3 hours

### 6.1 CORS Wildcard Restriction (24 occurrences in API)
- [ ] **Replace `Access-Control-Allow-Origin: *`** with domain allowlist
- [ ] **Allowlist**: `https://client-vital-suite.vercel.app`, `https://*.vercel.app`, `http://localhost:*`
- [ ] **Exit criteria**: No wildcard CORS in production

### 6.2 Edge Function CORS (4 functions)
- [ ] **Switch `sales-aggression`, `client-intelligence-engine`, `ai-analyst-engine`, `update-currency-rates`** to SDK corsHeaders
- [ ] **Exit criteria**: No manual `Access-Control-Allow-Origin: *` in active edge functions

### 6.3 RLS Policy Audit
- [ ] **Inventory all `USING (true)` / `TO anon` grants** in migrations
- [ ] **Tighten to `authenticated`** or ownership-scoped where appropriate
- [ ] **Exit criteria**: No permissive anon reads on sensitive tables

---

## PHASE 7: DEPLOYMENT & VERIFICATION (P1)
> Estimated: 2 hours

### 7.1 Migration Drift Resolution
- [ ] **Identify local-only vs remote-only migrations**
- [ ] **Apply or remove divergent migrations**
- [ ] **Exit criteria**: `supabase migration list --linked` shows 0 drift

### 7.2 Commit & Deploy
- [ ] **Commit all phases** with conventional commits
- [ ] **Deploy frontend**: `npx vercel deploy --prod`
- [ ] **Deploy edge functions**: `supabase functions deploy --project-ref ztjndilxurtsfqdsvfds`
- [ ] **Verify production**: Manual smoke test of critical paths

### 7.3 Post-Deploy Verification
- [ ] `npm run build` ✅
- [ ] `npx tsc --noEmit` ✅
- [ ] `CI=1 npm test` → 30/30 ✅
- [ ] `openclaw security audit` → 0 criticals ✅
- [ ] `rg "gemini-2.0-flash"` → 0 ✅
- [ ] `rg "client_health_scores"` → 0 ✅
- [ ] `rg "Math.random" src` → 0 ✅
- [ ] `rg "langsmith" supabase src api` → 0 ✅
- [ ] `git ls-files | rg '\.env'` → only examples ✅
- [ ] Migration drift → 0 ✅

---

## SCOREBOARD

| Phase | Items | Priority | Est. Hours | Depends On |
|-------|-------|----------|------------|------------|
| 1. Security Lockdown | 19 | P0 | 4-6h | — |
| 2. Test Stabilization | 15 | P0 | 3-4h | — |
| 3. Model Migration | 8 | P1 | 2-3h | Phase 1 |
| 4. Data Pipeline | 10 | P1 | 6-8h | Phase 1 |
| 5. Stale Cleanup | 8 | P2 | 4-5h | Phase 2 |
| 6. CORS & Policy | 5 | P2 | 2-3h | Phase 1 |
| 7. Deploy & Verify | 5 | P1 | 2h | All above |
| **TOTAL** | **70** | — | **23-31h** | — |

---

## EXECUTION ORDER (Optimal)

```
DAY 1 (Today):  Phase 1 (Security) + Phase 2 (Tests)
DAY 2:          Phase 3 (Models) + Phase 4 (Data Pipeline)
DAY 3:          Phase 5 (Cleanup) + Phase 6 (CORS/RLS)
DAY 4:          Phase 7 (Deploy + Full Verification)
```

## NON-GOALS (Explicit)
- ❌ No new features until all 70 items are done
- ❌ No CVS logic in OpenClaw (pg_cron only)
- ❌ No manual data mocking
- ❌ No Webflow changes (needs Webflow access)
- ❌ No Anthropic API features (needs billing)

---

*This is the finish line. 70 items. 4 days. Zero excuses.*
