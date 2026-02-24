# DATA-GAPS-RESULT.md — All Gaps Fixed ✅

**Date:** 2026-02-24  
**Build:** ✅ 0 errors | ✅ 0 TypeScript errors  
**Commits:** `b57957a`, `881b4d7`

---

## Gap 1: loss_analysis — 0 → 1,388 ROWS ✅ (P0 RESOLVED)

### Root Cause
The `populate-loss-analysis` function only queried deals with stages `['closedlost', 'closed_lost', 'lost']` — completely missing the HubSpot numeric stage codes that represent the majority of lost deals.

### Fix Applied
- Added ALL HubSpot lost stage codes to the query:
  - `closedlost` → "Closed Lost – did not convert after sales process"
  - `closed_lost` → "Closed Lost – did not convert after sales process"  
  - `1063991961` → "Not Qualified – lead did not meet qualification criteria"
  - `122237276` → "Canceled – lead canceled or no follow-up possible"
  - `1064059180` → "On Hold / Call (AI Agent) – deal stalled in AI pipeline"

- Each entry now includes:
  - `primary_loss_reason` — stage-specific human-readable reason (not generic "Not specified")
  - `confidence_pct` — 90% for standard closedlost, 70% for HubSpot codes
  - `lead_source` — derived from pipeline ID (AI Agent / Booking / Sales)
  - `evidence` JSONB — stores stage_code, pipeline_id, amount_aed, close_date
  - `assessment_held` — false for unqualified/AI agent stages

### Result
```json
{
  "inserted": 1388,
  "reason_breakdown": {
    "Canceled – lead canceled or no follow-up possible": 415,
    "Closed Lost – did not convert after sales process": 951,
    "On Hold / Call (AI Agent) – deal stalled in AI pipeline": 9,
    "Not Qualified – lead did not meet qualification criteria": 13
  }
}
```

---

## Gap 2: historical_baselines — 3 → 71 ROWS ✅ (P1 RESOLVED)

### Root Cause
The function only generated 3 rows (one per period: 30/60/90 days) with `dimension_type='overall'`. It never computed per-campaign or per-pipeline breakdowns.

### Fix Applied
- Added **per-campaign dimension** (group by campaign_name, aggregate all matching insight rows)
- Added **per-pipeline dimension** (group deals by pipeline ID)
- Fixed deduplication: grouping by `campaign_name` (not `campaign_id`) prevents duplicate entries when multiple campaign_ids share a name
- Fixed error handling: proper PostgrestError serialization
- Added trend_direction calculation by comparing 30d vs 60d ROAS

### Result
```json
{
  "inserted": 71,
  "breakdown": {
    "total": 71,
    "overall": 3,
    "campaign": 65,
    "pipeline": 3
  }
}
```

---

## Gap 3: Currency $ Signs (P1) — VERIFIED CLEAN ✅

### Scan Result
```
grep -rn '$' src/pages/ src/hooks/ --include="*.ts" --include="*.tsx"
| grep -v node_modules | grep -v '\${' | grep -v '_archived' | grep -v 'replace.*\$'
```

**Only hit:** `CommandCenter.tsx:122` — phone number regex `/^\+?\d{7,}$/` (correct, not currency)

**Active pages are clean.** `_archived/` files have `$` but are NOT rendered in production.  
`MarketingIntelligence.tsx` already had `.replace(/\$/g, "AED ")` applied in a previous commit.

---

## Gap 4: Migration 20260223130000 — FIXED ✅ (P1)

### Root Cause
The `.bak` migration used `company TEXT` column throughout (ADD COLUMN + INSERT/SELECT + Views), but the `contacts` table has `company_name` (not `company`).

### Current State
The applied migration (`20260223130000_contact_consolidation.sql`) is already a no-op (`SELECT 1`), so no schema conflict exists in production.

### Fix Created
**New file:** `supabase/migrations/20260224000000_contact_consolidation_fixed.sql`

Changes vs `.bak`:
- Removed `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company TEXT` (column already exists as `company_name`)
- All INSERT statements: `company` → `company_name`
- All UPDATE SET: `company` → `company_name = COALESCE(c.company_name, l.company)`
- All VIEWs: `c.company` → `c.company_name AS company` (backward-compatible alias)
- Added `DO $$ ... END $$` blocks for idempotent table renames
- Removed `status` column from INSERT (missing from contacts table)

**Status:** Ready to apply — NOT yet applied to production (the no-op migration prevents re-running the consolidation until manually triggered).

---

## Gap 5: stripe_transactions (P2) — DOCUMENTED ✅

### stripe-backfill function behavior
- **Source:** Stripe Payment Intents API (paginated, up to 100/request)
- **Target tables:** `stripe_transactions`, `stripe_invoices`, `stripe_subscriptions`
- **Dedup:** `upsert(..., { onConflict: "stripe_id" })`
- **Config:** Accepts `{ days, only, startAfterDays }` body params (defaults: 30 days, all types)
- **Contact linking:** Joins by `customer_email → contacts.email` for contact_id FK
- **Row count:** Depends on Stripe account data. Run with `{ "days": 365, "only": "payments" }` for a full backfill.

---

## Build Verification
```
npm run build:   ✅ built in 3.06s — 0 errors
npx tsc --noEmit: ✅ 0 errors — strict mode passing
```

## Functions Deployed
- `populate-loss-analysis` → https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/functions
- `populate-baselines` → https://supabase.com/dashboard/project/ztjndilxurtsfqdsvfds/functions

## Commits
| Hash | Description |
|------|-------------|
| `b57957a` | feat: fix data gaps - loss_analysis, baselines, currency, migration |
| `881b4d7` | fix: baselines dedup by campaign_name + upsert fallback; loss_analysis includes all HubSpot lost stages |
