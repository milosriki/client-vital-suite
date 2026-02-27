# REGRESSION FIX LOG (Research-Only)

Date: 2026-02-27
Mode: Research / ranking only (no implementation in this document)

## Evidence Inputs
- `reports/systematic-debug-history-findings.md`
- `docs/source-scan-routes.json`
- `docs/SOURCE-TRUTH-MATRIX.md`
- `docs/TAB-DATA-CONTRACTS.md`
- Route/nav wiring: `src/main.tsx`, `src/components/Navigation.tsx`
- Static scans in this session:
  - `snapshot_date` usage map
  - `client_health_daily` column audit (`docs/client-health-daily-column-audit.md`)
  - cancel-status filter scan in `src/`, `supabase/functions`, `scripts`

---

## Ranking Model
Severity Score = **Impact (1-5) × Scope (1-5) × Confidence (1-5)**

- Impact: business/user outage risk
- Scope: number of tabs/flows affected
- Confidence: strength of evidence

---

## P0 Queue (Execute First)

### P0-1 — Runtime number formatting crash family (`toFixed`)
- Score: **100** (Impact 5 × Scope 4 × Confidence 5)
- Evidence:
  - 10-day signature count: `runtime_tofixed = 218`
  - Screenshot error: "Cannot read properties of undefined (reading 'toFixed')" on Marketing Command Center
  - 275 `toFixed` call-sites across codebase (many safe, but broad risk surface)
- Affected tabs likely: Marketing, Command Center, Business Intelligence, Revenue cards/formatters
- Root-cause hypothesis: mixed nullability assumptions in metric formatters and table rows
- Research verdict: **Critical regression family; must be closed with shared safe formatter policy + smoke tests**

### P0-2 — Health schema contract drift (`client_health_daily`)
- Score: **80** (Impact 5 × Scope 4 × Confidence 4)
- Evidence:
  - 10-day signature count: `db_missing_column_42703 = 108`
  - Historical mismatch between legacy expected fields and canonical health schema
  - Current column audit now reports `missing=0` for direct select strings (mitigation likely in place)
- Affected tabs: Clients, Coaches, Alerts, Executive, Health Detail, predictions overlays
- Research verdict: **Mitigated but requires post-mitigation live verification across all dependent tabs**

### P0-3 — DailyOps snapshot null-family (`snapshot_date`)
- Score: **75** (Impact 5 × Scope 3 × Confidence 5)
- Evidence:
  - 10-day signature count: `runtime_snapshot_date = 46`
  - Prior crash pattern in DailyOps/Command Center snapshot rendering
  - `snapshot_date` still central in data contract
- Affected tabs: Daily Ops, Command Center, widgets consuming latest snapshot
- Research verdict: **Must enforce strict null-safe + stale snapshot fallback**

### P0-4 — Wrong cancel-status logic in pipeline code
- Score: **75** (Impact 5 × Scope 3 × Confidence 5)
- Evidence:
  - 10-day signature count: `aws_cancel_filter_wrong = 102`
  - Current scan still found plain `Cancelled` logic in key scripts/functions:
    - `scripts/sync-aws-sessions.mjs`
    - `supabase/functions/aws-session-sync/index.ts`
    - `scripts/sync-aws-to-supabase.cjs`
    - `supabase/functions/setup-coach-intelligence/index.ts` (uses broad `LIKE 'Cancelled%'`)
- Correct canonical logic:
  - Real cancels = `status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked'`
- Affected tabs: Coaches, health/trust logic, operations summaries, analytics integrity
- Research verdict: **Data truth risk; fix before trusting cancel-rate KPIs**

### P0-5 — Auth/availability instability (401/1008 + browser control outages)
- Score: **60** (Impact 4 × Scope 3 × Confidence 5)
- Evidence:
  - 10-day signature count: `auth_401 = 157`
  - Repeated 1008/pairing and browser control service timeouts in logs
- Affected flows: live verification cadence, agent/browser test reliability
- Research verdict: **Operational blocker for verification pipeline; app fixes may ship without proper live confidence if unresolved**

---

## P1 Queue (Next)

### P1-1 — CallGear ↔ HubSpot call outcome reconciliation
- Score: 48 (Impact 4 × Scope 3 × Confidence 4)
- Why: call analytics and lead progression quality depends on consistent call status, owner mapping, recording coverage.

### P1-2 — Lead lifecycle integrity (contacts without deals / owner drift / status gaps)
- Score: 48 (Impact 4 × Scope 3 × Confidence 4)
- Why: impacts Pipeline, Lead Tracking, Setter Command quality and speed-to-lead enforcement.

### P1-3 — Source trust UX gaps (badges + freshness timestamps)
- Score: 36 (Impact 3 × Scope 3 × Confidence 4)
- Why: prevents operator misread (e.g., MoM +100% with prev=0, stale snapshots interpreted as live).

### P1-4 — Redirect-tab ownership visibility
- Score: 27 (Impact 3 × Scope 3 × Confidence 3)
- Why: `/lead-follow-up`, `/attribution-leaks-detail`, `/workflow-strategy` redirect behavior hides source contracts.

---

## P2 Queue
- Standardize formatter utility adoption across all number-rendering components.
- Add route-level source contract lint/check to prevent drift.
- Add automated tab smoke suite against production alias.

---

## Recommended Execution Order
1. P0-4 cancel-status canonicalization (data truth)
2. P0-2 health contract live verification + remaining drift closure
3. P0-1 runtime formatter hardening where still unsafe
4. P0-3 snapshot null/fallback hardening
5. P0-5 verification infra stability (auth/browser)
6. P1 items by business impact

---

## Exit Criteria for Research Phase
- Ranked queue accepted by operator
- P0 scope frozen with explicit file list
- Regression implementation plan prepared (no scope drift)
