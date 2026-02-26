# AUDIT: Data Pipeline Reliability (Last 5 Days)
**Repo:** `/Users/milosvukovic/client-vital-suite`  
**Window audited:** ~2026-02-21 → 2026-02-26  
**Generated:** 2026-02-26

---

## Executive Verdict

- **AWS sync bridge:** **PARTIALLY RELIABLE** (core enrichment fixed, but critical security + orchestration gaps remain).
- **Migration state:** **DRIFTED / NOISY** (duplicate/overlapping attribution migrations, `.bak` and `remote_stub` artifacts in migration chain).
- **Health score pipeline:** **SPLIT-BRAIN** (new `health-score-engine` exists, but cron and many callers still point to legacy `calculate-health-scores` / `health-calculator`).
- **Attribution pipeline:** **PARTIALLY DONE** (deep schema/view work landed, but conflicting `view_call_attribution` definitions and mixed semantics).
- **Cron orchestration:** **ACTIVE BUT FRAGMENTED** (many schedules; some unschedule protection, but no single source-of-truth + health-v2 not wired end-to-end).

---

## Scope & Evidence

Primary evidence from commits and files:
- `db50090` feat: AWS sync bridge + intelligence engine + launchd config
- `3ed6713` fix: sync bridge enrichment
- `10b979f` feat: health-score-engine v2.0
- `4d1b46a` feat: client-intelligence-engine
- `1f37314`, `6a7eefa` ai-analyst-engine
- `4838559` attribution deep truth migration
- `5f9b7c5` view_call_attribution migration
- `3bc33e5` wave2 cron jobs
- `848b756` churn priority + cancel filters fix

Audited files include:
- `scripts/aws-sync-bridge.cjs`
- `supabase/functions/health-score-engine/index.ts`
- `supabase/functions/client-intelligence-engine/index.ts`
- `supabase/functions/ai-analyst-engine/index.ts`
- `supabase/functions/master-sync/index.ts`
- `supabase/migrations/20260224230000_attribution_deep_truth.sql`
- `supabase/migrations/20260225000002_view_call_attribution.sql`
- `supabase/migrations/20260225000003_view_attribution_coverage.sql`
- `supabase/migrations/20260225000001_wave2_cron_jobs.sql`
- migration directory hygiene (`*.bak`, `*_remote_stub.sql`)

---

## 1) AWS Sync Bridge Audit

### What is done (VERIFIED)
- **Bridge implemented** in `scripts/aws-sync-bridge.cjs` with:
  - RDS pull + Supabase upsert/insert batching
  - retries/backoff
  - package sync + post-sync enrichment (`enrichPackages`) for:
    - `last_coach`
    - `last_session_date`
    - `sessions_per_week`
    - `future_booked`
- Commit `3ed6713` specifically addresses prior null enrichment gap.

### What is stale/risky
- **SECURITY DEBT (CRITICAL, VERIFIED):** hardcoded secrets present in bridge:
  - RDS password fallback literal
  - Supabase service role key fallback literal
- **Orchestration gap (VERIFIED):** commit message mentions launchd config, but repo contains only `scripts/aws-sync-bridge.cjs` (no `.plist`, no install/uninstall/health scripts).
- **Observability gap (VERIFIED):** `reportSync()` calls `supabasePost(...)` but function is not defined in this file; errors are swallowed by `try/catch`, making sync reporting effectively unreliable/silent.

### Reliability rating
- **Data correctness trend:** improved.
- **Operational reliability:** medium.
- **Security posture:** unacceptable until secrets are removed.

---

## 2) Migration Drift Audit

### Drift symptoms (VERIFIED)
- Migration folder includes non-canonical artifacts:
  - `*.bak` files (e.g. `20260223130000_contact_consolidation.sql.bak`, `20260224215000_fix_lead_followup_outgoing_calls.sql.bak`)
  - multiple `*_remote_stub.sql` files.
- Overlapping attribution migrations redefine same objects:
  - `20260224230000_attribution_deep_truth.sql` creates rich `view_call_attribution`
  - `20260225000002_view_call_attribution.sql` re-creates a different shape for the same view
- This creates **order-dependent behavior** and difficult rollback semantics.

### Impact
- Fresh environments may apply a different final definition than expected if migration order is modified.
- Engineers can misread “current truth” by inspecting older migration content.

### Reliability rating
- **Schema determinism:** medium-low.
- **Rollback confidence:** low until normalization.

---

## 3) Health Score Pipeline Audit

### What is done (VERIFIED)
- New engine exists: `supabase/functions/health-score-engine/index.ts`
  - writes to `client_health_daily`
  - pattern detection into `client_health_patterns`
  - data freshness check from `training_sessions_live.synced_at`
- UI/data consumers are partially migrated to `client_health_daily`.

### What is stale/inconsistent (VERIFIED)
- Legacy function still active in ecosystem:
  - cron migration `20260213100000_fix_cron_cost_optimization.sql` schedules **`calculate-health-scores`** under cron name `health-calculator`
- Multiple services still invoke `health-calculator` (legacy naming/function path), while new v2 engine is separate.
- Net effect: **split-brain scoring** risk (HubSpot-score pipeline vs AWS-based daily health pipeline).

### Reliability rating
- **Computation quality:** high for v2 engine.
- **System consistency:** low-medium due to dual path.

---

## 4) Attribution Pipeline Audit

### What is done (VERIFIED)
- Deep attribution framework landed (`20260224230000_attribution_deep_truth.sql`):
  - `view_call_attribution`
  - `fn_attribution_coverage()`
  - confidence scoring + enrichment functions
  - supporting indexes
- Additional coverage view migration added (`20260225000003_view_attribution_coverage.sql`).

### What is stale/risky (VERIFIED)
- `view_call_attribution` is redefined with different columns/logic in later migration `20260225000002_view_call_attribution.sql`.
  - earlier version: LEFT JOIN + mixed match methods (`contact_id`/phone)
  - later version: JOIN on phone-normalized only and different call columns
- Inconsistent semantics can break downstream dashboards/functions expecting prior column names.

### Reliability rating
- **Core capability:** strong.
- **Contract stability:** medium-low until single canonical view contract is declared.

---

## 5) Cron Orchestration Audit

### What is done (VERIFIED)
- Wave2 cron rollout exists (`20260225000001_wave2_cron_jobs.sql`) with unschedule-before-schedule pattern.
- Historical cron cleanup exists (`20260213100000_fix_cron_cost_optimization.sql`).

### What is stale/risky (VERIFIED)
- Cron landscape is broad and fragmented across many migrations.
- No single “current desired schedule manifest” in repo.
- Health v2 engine not clearly promoted to canonical scheduled scorer.
- Bridge orchestration is external/local (launchd) with no repo-managed deployment artifact.

### Reliability rating
- **Scheduler availability:** likely okay.
- **Change safety + operator clarity:** medium-low.

---

## Done vs Stale Matrix

| Area | Done | Stale / Risk |
|---|---|---|
| AWS sync bridge | Enrichment fix landed, retries + batching | Hardcoded secrets; missing launchd artifacts; broken/silent sync reporting helper |
| Migration integrity | Important migrations landed | `.bak` + `remote_stub`; overlapping redefinitions (attribution views) |
| Health scoring | v2 engine implemented with richer logic | Legacy cron + legacy callers still active (split-brain) |
| Attribution | Multi-source system and indexes in place | Conflicting `view_call_attribution` definitions |
| Cron orchestration | Many jobs configured, unschedule guards used | No single canonical schedule manifest; mixed generations of jobs |

---

## Finish Plan (Rollback-Safe Ordering)

## Phase 0 — Safety Snapshot (must do first)
1. Export current production `cron.job` rows + current definitions of:
   - `view_call_attribution`, `view_attribution_coverage`
   - functions: `fn_attribution_coverage`, health-related function endpoints mapping
2. Tag git + DB state as `pre-pipeline-stabilization-2026-02-26`.

**Rollback:** restore DB object definitions from snapshot SQL + re-apply previous cron rows.

## Phase 1 — Security Hardening (no behavior change)
1. Remove hardcoded RDS password and Supabase service key from `scripts/aws-sync-bridge.cjs`.
2. Enforce fail-fast if env vars missing.
3. Rotate any exposed credentials immediately.

**Rollback:** none needed for schema; runtime rollback = restore previous script version (not recommended).

## Phase 2 — Bridge Orchestration Reliability
1. Add repo-managed launchd assets:
   - `scripts/launchd/com.ptd.aws-sync-bridge.plist`
   - install/uninstall/status scripts
2. Fix `reportSync()` implementation (`supabasePost` bug) and make failures explicit in logs.
3. Add heartbeat output and failure counters.

**Rollback:** disable plist job and run manual sync command.

## Phase 3 — Canonical Health Pipeline Cutover
1. Decide canonical scorer = `health-score-engine` (recommended).
2. Add dedicated cron migration for v2 engine schedule.
3. Decommission or isolate legacy `calculate-health-scores` cron path.
4. Update all callers (`health-calculator` references) to canonical endpoint or an adapter shim.

**Rollback:** keep legacy cron disabled-but-preserved SQL; re-enable old schedule if v2 fails.

## Phase 4 — Attribution Contract Stabilization
1. Choose one canonical `view_call_attribution` schema.
2. Create new migration that explicitly redefines to canonical contract + compatibility aliases if needed.
3. Add a contract test query set for downstream consumers.

**Rollback:** re-apply prior view definition migration SQL captured in Phase 0.

## Phase 5 — Migration Chain Hygiene
1. Remove/relocate non-migration artifacts from migration execution path (`*.bak`, `*_remote_stub.sql`).
2. Document migration policy: one object contract owner, no silent redefinitions without deprecation note.
3. Add CI guard to reject `.bak`/`remote_stub` in `supabase/migrations/`.

**Rollback:** N/A (repo hygiene + CI rule).

## Phase 6 — Cron Source-of-Truth
1. Add `docs/CRON_MANIFEST.md` generated from actual intended jobs.
2. Add verification script comparing manifest vs live cron jobs.

**Rollback:** manifest-only (no production risk).

---

## High-Priority Immediate Actions (next 24h)
1. **Rotate exposed credentials** (bridge script).
2. **Patch bridge secrets + fail-fast env validation**.
3. **Fix bridge sync reporting function bug**.
4. **Declare canonical health scoring path and schedule**.
5. **Ship attribution view contract migration to remove ambiguity**.

---

## Final Assessment

The last 5 days delivered major progress on AWS-backed intelligence and attribution depth, but reliability is currently constrained by **security debt**, **pipeline split-brain**, and **migration/cron contract drift**. The system is close to stable, but requires a short hardening sprint to become rollback-safe and operationally deterministic.
