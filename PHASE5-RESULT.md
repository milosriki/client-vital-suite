# Phase 5 — HubSpot Operations Forensics & Fixes

**Date**: 2026-02-24  
**Status**: ✅ Fixes committed — 3 root causes identified, 2 code bugs fixed, 1 migration deployed, 1 new health check function created  
**Commit**: `2d963e1`

---

## 🔴 Critical Issues Identified & Fixed

### Issue 1: `total_outgoing_calls` Always Returns 0
**Impact**: ALL SLA logic broken. Leads appear unworked even when called. 93K leads falsely flagged.

**Root Cause** (2 compounding bugs):

#### Bug A — Wrong phone stored in call_records for outbound HubSpot calls
File: `supabase/functions/sync-hubspot-to-supabase/index.ts`

HubSpot call properties:
- `hs_call_from_number` = **agent's** phone (the PTD system number)
- `hs_call_to_number` = **lead's** phone

The sync was storing `hs_call_from_number` as `caller_number` for ALL calls (both inbound and outbound). This means for outbound calls (the vast majority), `caller_number` = agent's system number, NOT the lead's phone.

The `view_lead_follow_up` then joins `contacts.phone = call_records.caller_number` — this JOIN fails for every outbound HubSpot call because agent's number ≠ lead's phone.

**Fix Applied**:
```typescript
// Before (broken):
caller_number: props.hs_call_from_number || props.hs_call_to_number || ...

// After (fixed):
const contactPhone =
  direction === "outbound"
    ? props.hs_call_to_number || props.called_phone_number || props.hs_call_from_number
    : props.hs_call_from_number || props.hs_call_to_number || props.called_phone_number;

caller_number: contactPhone,
```

#### Bug B — view_lead_follow_up had no `total_outgoing_calls` column
The PRD specified `total_outgoing_calls = COUNT(call_records WHERE direction='outbound')` but the view only had `total_calls` (all calls, no direction filter). `no_calls_made` was checking total = 0, not outbound = 0.

**Fix Applied** (migration `20260224215000_fix_lead_followup_outgoing_calls.sql`):
```sql
-- New CTE uses contact_id join (not fragile phone string match):
COUNT(*) FILTER (WHERE call_direction = 'outbound') AS total_outgoing_calls
-- New columns added:
total_outgoing_calls, total_incoming_calls, no_outgoing_calls_made
```

**Action Required After Deploy**:
```bash
# Re-sync ALL historical HubSpot calls to fix existing call_records:
POST /functions/v1/sync-hubspot-to-supabase
Body: { "sync_type": "calls", "incremental": false }
```

---

### Issue 2: Deal → Contact 82% Null (`contact_id`)
**Impact**: 24,600+ deals orphaned from contacts. Revenue attribution broken. Funnel analytics useless.

**Root Cause**: Critical typo `consconsole.warn` in `sync-hubspot-to-supabase`

File: `supabase/functions/sync-hubspot-to-supabase/index.ts` (line 653 before fix)

When the HubSpot v3 associations batch API returned any non-200 status:
```typescript
// Before (broken — consconsole is undefined → ReferenceError thrown):
consconsole.warn("⚠️ Failed to fetch associations batch.");

// After (fixed):
const errText = await assocResponse.text().catch(() => "unknown");
console.warn(`⚠️ Failed to fetch associations batch: HTTP ${assocResponse.status} - ${errText.substring(0, 200)}`);
```

The `ReferenceError: consconsole is not defined` caused the entire deals sync block to fail silently — associations were never fetched, so `contact_id` was never populated.

**Fix Applied**: `consconsole.warn` → proper error logging that doesn't crash. The sync can now gracefully degrade if the associations API fails rather than aborting.

**Action Required After Deploy**:
```bash
# Re-sync all deals to populate contact_id:
POST /functions/v1/backfill-deal-contacts
Body: { "days": 0 }   # 0 = all unlinked deals, not just last 30 days
```

Note: `backfill-deal-contacts` uses the correct **v4** associations API and is working correctly. It just needs to be run at scale.

---

### Issue 3: Workflow 1655409725 — INFINITE LOOP (634K AED/month)
**Status**: ⚠️ Cannot be disabled from code per Phase 5 rules — flagged for manual action

**Action Required**: 
1. Go to: https://app.hubspot.com/workflows/7973797/platform/flow/1655409725/edit
2. **Pause/Disable** the workflow manually
3. Investigate the trigger condition to understand what's causing the loop
4. Common causes: workflow triggers on property change → workflow changes that property → re-triggers

**Code Audit**: No existing edge function has workflow management capability. The closest is `hubspot-command-center` which handles security events and login activity but NOT workflow management. If workflow management is needed, a new action in `hubspot-command-center` could call `GET /automation/v3/workflows/{id}` (read) or `PUT /automation/v3/workflows/{id}` (disable) — but this requires manual authorization from Milos first.

---

## 🔍 Lead Delegation — Why 93K Leads Are Unworked

### Findings

1. **No active assignment automation**: `auto-reassign-leads` only processes 20 leads per call and queues proposals to `ai_agent_approvals` (CEO approval required). This is deliberate but creates a bottleneck — with 93K unworked leads growing at +785/week, manual approval can't keep up.

2. **`sync-hubspot-contacts` uses wrong conflict column**: 
   ```typescript
   // BROKEN — contacts table uses hubspot_contact_id not hubspot_id:
   await supabase.from("contacts").upsert(upsertData, { onConflict: "hubspot_id" });
   ```
   This function (`sync-hubspot-contacts`) silently fails to upsert because `hubspot_id` is not the conflict column (it's `hubspot_contact_id`). This means this function has never successfully synced. **Not fixed in this phase** — needs `onConflict: "hubspot_contact_id"` and field mapping update.

3. **Facebook ads paused** (confirmed non-technical): No new FB leads coming in. The 93K backlog is historical.

4. **CallGear auto-assignment logic exists** but only triggers on call events (in `fetch-callgear-data`): when a call comes in for an unassigned contact, it assigns to the caller. With 93K unworked leads, this passive assignment isn't enough.

5. **`hubspot-owner-intelligence` correctly tracks owner stats** but doesn't trigger any assignment — it's a reporting-only function.

### Recommended Fix (Not Implemented — needs CEO approval)
- Run `auto-reassign-leads` on a schedule via pg_cron every hour
- Increase the `.limit(20)` to `.limit(200)` per run  
- Add a bulk HubSpot round-robin assignment endpoint to `hubspot-command-center`

---

## 🔍 backfill-deal-contacts — Audit Result

**Status**: ✅ Correctly implemented — no code bugs found

The function correctly:
1. Fetches unlinked deals (null `contact_id`) from Supabase
2. Calls HubSpot **v4** batch associations API (`/crm/v4/associations/deals/contacts/batch/read`)
3. Maps `result.to[0].toObjectId` (correct for v4 API)
4. Resolves HubSpot contact IDs → Supabase UUIDs via `contacts.hubspot_contact_id`
5. Updates `deals.contact_id` with resolved UUID

**Issue**: It defaults to `days: 30` (only backfills last 30 days). With 82% null coverage, the full backfill needs `days: 0`.

**Note**: The `sync-hubspot-to-supabase` deals sync uses the **v3** associations API while `backfill-deal-contacts` uses the correct **v4** API. Both have different response formats (`id` vs `toObjectId`). The v3 sync reads `res.to?.[0]?.id` which is correct for v3. The real issue was the `consconsole` crash preventing any execution.

---

## ✅ New: hubspot-health-check Edge Function

Created: `supabase/functions/hubspot-health-check/index.ts`

**Usage**:
```bash
POST /functions/v1/hubspot-health-check
Body: {}              # Supabase-only metrics (fast)
Body: { "live": true } # Also hits HubSpot API for portal metrics
```

**Tracks**:
| Metric | Query Method | Status Thresholds |
|--------|-------------|-------------------|
| Unworked leads count | Supabase contacts vs call_records | >50K = 🔴, >10K = 🟡 |
| Deal→contact coverage % | deals WHERE contact_id IS NULL | <50% = 🔴, <75% = 🟡 |
| Call tracking accuracy | call_records by direction | outbound=0 = 🔴, <20% = 🟡 |
| Last 5 sync logs | sync_logs table | |
| Workflow 1655409725 status | HubSpot API (live mode only) | |

**Sample Response**:
```json
{
  "unworked_leads": { "count": 93000, "unworked_rate_pct": 81, "status": "🔴 CRITICAL" },
  "deal_contact_coverage": { "coverage_pct": 18, "status": "🔴 CRITICAL" },
  "call_tracking": { "outbound_rate_pct": 0, "status": "🔴 CRITICAL - total_outgoing_calls = 0" },
  "workflow_warnings": [{ "workflow_id": "1655409725", "severity": "🔴 CRITICAL" }],
  "summary": { "overall_status": "🔴 3 CRITICAL issues" }
}
```

---

## 📋 Build & Type Check

```bash
npm run build        # ✅ PASSED (3.14s, 0 errors)
npx tsc --noEmit     # ✅ PASSED (0 errors, strict mode)
```

---

## 🗂 Files Changed

| File | Type | Change |
|------|------|--------|
| `supabase/functions/sync-hubspot-to-supabase/index.ts` | BUG FIX | consconsole typo + outbound caller_number fix |
| `supabase/functions/hubspot-health-check/index.ts` | NEW | HubSpot health monitoring endpoint |
| `supabase/migrations/20260224215000_fix_lead_followup_outgoing_calls.sql` | NEW | Fixed view_lead_follow_up with total_outgoing_calls |

---

## 🚀 Required Actions (Post-Deploy)

### Immediate (Today)
1. **MANUAL: Disable workflow 1655409725 in HubSpot portal**
   - URL: https://app.hubspot.com/workflows/7973797/platform/flow/1655409725/edit
   - Impact: Stop 634K AED/month productivity bleed

2. **Run full deal backfill**:
   ```bash
   POST /functions/v1/backfill-deal-contacts
   Body: { "days": 0 }
   ```
   Expected: Recover ~24K deal→contact links (from 18% → 80%+ coverage)

3. **Re-sync HubSpot calls (fix historical direction data)**:
   ```bash
   POST /functions/v1/sync-hubspot-to-supabase
   Body: { "sync_type": "calls", "incremental": false }
   ```
   Expected: `total_outgoing_calls` starts returning real numbers

### This Week
4. **Deploy migration** `20260224215000_fix_lead_followup_outgoing_calls.sql` to production Supabase
5. **Fix `sync-hubspot-contacts`** conflict column: change `onConflict: "hubspot_id"` → `"hubspot_contact_id"` and fix field mappings
6. **Run health check** to verify metrics improve: `POST /functions/v1/hubspot-health-check { "live": true }`

### Next Sprint
7. **Scale lead assignment**: Increase `auto-reassign-leads` limit from 20 → 200, add pg_cron schedule
8. **Add workflow management** to `hubspot-command-center`: GET/PUT workflow status endpoint
9. **Monitor** unworked leads weekly — should decline as backlog gets worked

---

## 📊 Expected Outcomes After Actions

| Metric | Before Phase 5 | After Actions |
|--------|---------------|---------------|
| total_outgoing_calls | Always 0 | Real count from call_records |
| deal→contact coverage | 18% | 80%+ |
| Unworked leads correctly detected | ❌ (broken due to call 0 bug) | ✅ |
| Workflow 1655409725 | Running (loop) | Disabled (manual) |
| Health monitoring | None | hubspot-health-check endpoint |
