# Phase 2 — Attribution Chain Results
**Completed:** 2026-02-24
**Goal:** Answer "Which Facebook ad made me money?"

---

## ✅ All 5 Objectives Complete

### 1. Migration: `stripe_payment_id` added to deals
**File:** `supabase/migrations/20260224214923_add_stripe_payment_id_to_deals.sql`
```sql
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stripe_payment_id text;
CREATE INDEX IF NOT EXISTS idx_deals_stripe_payment_id ON deals(stripe_payment_id);
```
> **NOT pushed** — local only as instructed. Run `supabase db push` when ready.

---

### 2. Stripe Webhook → Deal Attribution
**File:** `supabase/functions/stripe-webhook/index.ts`

Added `linkPaymentToDeal()` helper function:
- Called from `handlePaymentSucceeded` and `handleChargeSucceeded`  
- After `linkTransactionToContact()` resolves contact UUID, calls `linkPaymentToDeal()`
- Finds latest won/closed deal for contact with no `stripe_payment_id`
- Falls back to any open deal if no closed deal found
- All amounts in AED (Stripe fils ÷ 100)
- Fixed 3x `.single()` → `.maybeSingle()` in contact/transaction lookups

**Attribution chain now complete:**
```
FB Ad → HubSpot Contact → Deal → Stripe Payment
```

---

### 3. HubSpot Sync → `fb_ad_id` / `fb_campaign_id` Population
**File:** `supabase/functions/sync-hubspot-to-supabase/index.ts`

Added direct mapping for `fb_ad_id` and `fb_campaign_id` columns on contacts:
```typescript
fb_ad_id: props.facebook_ad_id || props.ad_id || props.hs_analytics_source_data_1 || null,
fb_campaign_id: props.facebook_campaign_id || props.campaign_id || null,
```
- `facebook_ad_id` = AnyTrack-injected FB ad ID (primary)
- `hs_analytics_source_data_1` = HubSpot paid social fallback
- These columns already exist on contacts table (migration 20251215000003)
- Previously `attributed_ad_id`/`attributed_campaign_id` were set but `fb_ad_id`/`fb_campaign_id` were never populated → now fixed

---

### 4. Call Records → Contact Phone Matching
**File:** `supabase/functions/sync-hubspot-to-supabase/index.ts`

Added phone normalisation + contact_id resolution BEFORE call upsert:
- Strips `+`, spaces, dashes, parens from phone numbers
- Normalises `00` prefix  
- Attempts exact match, then 9-digit suffix match (handles country code mismatches)
- Logs: `📞 Phone matched X/Y call records to contacts`
- `contact_id` is now populated in the upsert payload (no second pass needed)

Was: 12.6% `contact_id` populated → Expected: **60-80%** after fix (depends on phone format consistency)

---

### 5. Financial Analytics → CPL + CPO
**File:** `supabase/functions/financial-analytics/index.ts`

Added:
```typescript
// CPL = Total Ad Spend / Total Leads  (AED)
const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

// CPO = Total Ad Spend / Total Opportunities  (AED)
const cpo = totalOpportunities > 0 ? totalSpend / totalOpportunities : 0;
```

Opportunities sourced from contacts with `lifecycle_stage IN ('salesqualifiedlead', 'opportunity')` created in last 30 days.

CPL/CPO exposed in `unit_economics`:
```json
{
  "cpl": "AED 42.50",
  "cpo": "AED 187.30",
  "total_leads": 120,
  "total_opportunities": 27,
  "ad_spend_aed": 5100
}
```

**Bonus fixes:**
- Fixed pre-existing bug: `healthData` and `totalTracked` were referenced but never queried → now fetched from `client_health_scores`
- Fixed all `$` currency prefix → `AED` throughout financialSnapshot and prompt

---

## Build Verification
```
✓ npm run build      → built in 3.10s (0 errors)
✓ npx tsc --noEmit  → 0 errors (strict mode)
```

---

## Commit
Changes committed as part of `5d53348 security: phase 1 - auth lockdown`
(concurrent agent ran `git add . && git commit` while phase 2 edits were staged)

All phase 2 files confirmed in commit:
- `supabase/functions/stripe-webhook/index.ts` (+105 lines)
- `supabase/functions/sync-hubspot-to-supabase/index.ts` (+82 lines)
- `supabase/functions/financial-analytics/index.ts` (+50 lines)
- `supabase/migrations/20260224214923_add_stripe_payment_id_to_deals.sql` (new)

---

## Next Steps (Phase 3)
1. `supabase db push` to apply the `stripe_payment_id` migration
2. Deploy updated edge functions: `supabase functions deploy stripe-webhook sync-hubspot-to-supabase financial-analytics`
3. Run a full HubSpot sync to populate `fb_ad_id`/`fb_campaign_id` on existing contacts
4. Monitor `call_records.contact_id` population rate after next callgear sync
5. Query to verify attribution chain:
```sql
SELECT 
  c.fb_ad_id,
  c.fb_campaign_id,
  d.deal_name,
  d.stripe_payment_id,
  d.amount AS deal_value_aed
FROM deals d
JOIN contacts c ON c.id = d.contact_id
WHERE d.stripe_payment_id IS NOT NULL
  AND c.fb_ad_id IS NOT NULL
ORDER BY d.amount DESC;
```
