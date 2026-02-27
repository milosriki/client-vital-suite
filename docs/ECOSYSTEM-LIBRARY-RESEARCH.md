# Ecosystem Library Research (Context7-backed)

Date: 2026-02-27
Mode: research-first

## Libraries verified via Context7

### 1) Supabase JS (`/supabase/supabase-js`)
Confirmed patterns:
- Use `.upsert(..., { onConflict: 'col' })` for deterministic merge behavior.
- Use explicit error handling (`error.code`, `error.message`, `error.details`).
- Use filtered `select` queries with minimal columns to reduce payload and null-surface.

Relevance to PTD:
- Aligns with health/ops mart writes and idempotent syncs.
- Supports robust fallback when source systems are temporarily stale.

### 2) TanStack Query (`/tanstack/query`)
Confirmed patterns:
- Global query defaults for retry/retryDelay are valid.
- Per-query retry overrides for volatile endpoints.
- Error boundary reset strategy (`useQueryErrorResetBoundary`) to recover UI state.

Relevance to PTD:
- Directly reduces repeated runtime crash loops and stale-error stuck states.
- Should be applied on high-volatility tabs (Marketing, Command Center, Calls).

### 3) HubSpot Node SDK (`/hubspot/hubspot-api-nodejs`)
Confirmed patterns:
- Batch APIs for contacts/deals updates.
- Associations API v4 for linking contacts/deals/companies.
- Search API limitations (filter-group/sort constraints) must be respected.

Relevance to PTD:
- Needed for owner/status/deal-link integrity and de-dup workflows.
- Reduces sync gaps and ghost-contact side effects.

---

## Skill stack to run whole ecosystem effectively

1. **brainstorming** → define assumptions + source boundaries
2. **deep-learner** → ingest logs/docs/screenshots and extract structured facts
3. **concise-planning** → atomic execution queue
4. **systematic-debugging** → root-cause-first fixes only
5. **data-storytelling** → operator updates with evidence narrative
6. **hubspot-integration** → CRM batch/associations/search correctness
7. **coding-agent-loops** → long-running implementation with retries
8. **session-logs** → loop-prevention and regression memory

---

## Whole-ecosystem solution (recommended)

### Canonical data model (Supabase)
Build/maintain canonical marts:
1. `mart_health_client_daily` (AWS truth)
2. `mart_health_coach_daily` (AWS + GPS verification)
3. `mart_lead_lifecycle_daily` (HubSpot + CallGear)
4. `mart_marketing_daily` (Meta)
5. `mart_revenue_daily` (Stripe + closed-won linkage)
6. `mart_ops_snapshot_daily` (single source for command/daily ops)

### Contract discipline
- Every tab gets explicit: source, required fields, join keys, freshness SLA, fallback policy.
- Every critical widget gets source badge + freshness timestamp.

### Error-family elimination
Targeted closure order:
1. cancel-status canonicalization across scripts/functions
2. runtime formatter hardening (`toFixed` family)
3. snapshot null-safe contracts
4. health contract alignment verification across consumers

### Verification gates
- build + tsc pass
- zero blocking console errors on core tabs
- zero missing-column query errors
- parity checks vs source systems

---

## Why this is the most effective wiring
- Minimizes ad-hoc joins in UI layer
- Prevents semantic drift between tabs
- Preserves source truth while keeping UI fast
- Converts repeated bug families into enforceable contracts
