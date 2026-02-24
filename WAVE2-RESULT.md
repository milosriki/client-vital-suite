# Wave 2 — Revenue Intelligence Fixes
**Commit:** `3bc33e5`  
**Date:** 2026-02-25  
**Build:** ✅ `npm run build` — 0 errors  
**Types:** ✅ `npx tsc --noEmit` — 0 errors  

---

## Fixes Delivered (7/7)

### ✅ P0 — Fix 1: Live Currency Rates (no more hardcoded AED rates)
**File created:** `supabase/functions/update-currency-rates/index.ts`

- Fetches live rates from `https://open.er-api.com/v6/latest/AED` (free, no API key)
- Inverts rates correctly: API returns "how many X per 1 AED" → stored as "how many AED per 1 X"
- Stores in `org_memory_kv` (`namespace: config`, `key: currency_rates_aed`)
- `stripe-dashboard-data` already reads from `org_memory_kv` with fallback to hardcoded rates (pre-existing safety net)
- **Cron scheduled:** `20260225000001_wave2_cron_jobs.sql` — daily at 02:00 UTC (06:00 Dubai)

---

### ✅ P0 — Fix 2: enhanced_leads → contacts migration (4 files)

| File | Line | Change |
|------|------|--------|
| `src/components/dashboard/AlertsBar.tsx` | 30 | `.from('enhanced_leads')` → `.from('contacts')` · `conversion_status='new'` → `.is('lead_status', null)` |
| `src/components/dashboard/TodaySnapshot.tsx` | 42 | `.from('enhanced_leads')` → `.from('contacts')` (count only, no field mapping needed) |
| `src/components/hubspot-live/hooks/useHubSpotRealtime.ts` | 118 | `.from("enhanced_leads")` → `.from("contacts")` · select updated to contacts columns · fields mapped: `lead_quality` computed from `total_value`, `conversion_status` from `lead_status`, `source` from `latest_traffic_source` |
| `src/utils/detectTestData.ts` | 152,299 | `enhanced_leads` fake-email check → replaced with `contacts` disposable-domain check · removed `'enhanced_leads'` from `autoFixTestData` tables array |

---

### ✅ P1 — Fix 3: daily_summary race condition eliminated
**File:** `supabase/functions/business-intelligence/index.ts`

- Removed the `daily_summary.upsert()` block (was causing conflicts with `daily-report`)
- Added comment: _"daily_summary is written exclusively by the daily-report function"_
- `daily-report` remains the **single writer** to `daily_summary`

---

### ✅ P1 — Fix 4: New pg_cron schedules
**Migration:** `supabase/migrations/20260225000001_wave2_cron_jobs.sql`

| Job | Schedule | Time (Dubai) |
|-----|----------|-------------|
| `update-currency-rates` | `0 2 * * *` | 06:00 |
| `populate-loss-analysis` | `15 2 * * *` | 06:15 |
| `populate-baselines` | `0 3 * * *` | 07:00 |
| `ad-creative-analyst` | `0 4 * * *` | 08:00 |
| `true-roas-calculator` | `0 5 * * *` | 09:00 |

Pattern: `net.http_post` with `current_setting('app.settings.service_role_key')` — matches existing cron pattern exactly. Each cron is idempotent (preceded by `cron.unschedule()` in `DO $$ EXCEPTION WHEN OTHERS THEN NULL` block).

---

### ✅ P2 — Fix 5: NorthStarWidget configurable
**File:** `src/components/dashboard/bi/NorthStarWidget.tsx`

- Added `northStarLabel?: string` prop (default: `"500k ARR"`)
- Hardcoded `"500k ARR"` replaced with `{northStarLabel}`
- Parent can now pass `northStarLabel="1M ARR"` when the goal changes
- Zero breaking changes — default maintains existing behaviour

---

### ✅ P2 — Fix 6: exec_sql RPC removed (SQL injection vector)
**File:** `supabase/functions/ai-trigger-deploy/index.ts`

- `supabase.rpc("exec_sql", { sql_query: sql })` **removed**
- Replaced with a `pending_manual_migration` status update + clear error message
- DDL SQL is now logged for manual application via `supabase/migrations/`
- Returns structured response with the SQL preview for the operator
- The validation code (allowed operations, WHERE bypass detection) remains as documentation

---

### ✅ P2 — Fix 7: Churn predictions → proactive_insights alerts wired
**File:** `supabase/functions/churn-predictor/index.ts`

- After churn scores calculated: if `churn_probability > 70` (70% = 0.7 on decimal scale), INSERT into `proactive_insights`
- Uses correct schema: `insight_type`, `priority`, `title`, `content`, `source_agent`, `source_data`, `affected_entities`, `is_read`, `is_dismissed`
- Graceful error handling: failure to insert insights does NOT fail the main prediction response
- Note: `ml-churn-score` already had this wiring (`churn_score >= 70` → proactive_insights insert) — gap was only in `churn-predictor`

---

## Verification

```
✅ npm run build     → 4,656 modules transformed, 0 errors
✅ npx tsc --noEmit  → 0 type errors (strict mode)
✅ git commit        → 14 files changed, 668 insertions(+), 79 deletions(-)
```

## Files Changed
```
supabase/functions/update-currency-rates/index.ts          [NEW]
supabase/migrations/20260225000001_wave2_cron_jobs.sql     [NEW]
src/components/dashboard/AlertsBar.tsx
src/components/dashboard/TodaySnapshot.tsx
src/components/dashboard/bi/NorthStarWidget.tsx
src/components/hubspot-live/hooks/useHubSpotRealtime.ts
src/utils/detectTestData.ts
supabase/functions/business-intelligence/index.ts
supabase/functions/ai-trigger-deploy/index.ts
supabase/functions/churn-predictor/index.ts
```

## Next Actions Required (by Operator)
1. **Deploy edge function:** `supabase functions deploy update-currency-rates --project-ref ztjndilxurtsfqdsvfds`
2. **Apply migration:** `supabase db push --project-ref ztjndilxurtsfqdsvfds` (runs the cron job migration)
3. **Trigger currency rates once manually** to populate `org_memory_kv` immediately (don't wait for 6 AM Dubai cron)
4. **Verify `proactive_insights` unique constraint** — if you want to prevent duplicate churn alerts per client, add: `ALTER TABLE proactive_insights ADD UNIQUE (insight_type, (affected_entities->'clients'->0->>'email'));` or use a daily archive approach.
