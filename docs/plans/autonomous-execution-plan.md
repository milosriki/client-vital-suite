# AUTONOMOUS EXECUTION PLAN — Vital Suite Full Stack

> **For Claude:** Read CLAUDE.md first for safety rules. Check progress.md for current state. Execute batches in order. Verify after each. Do not stop.

**Total scope:** 10 batches, ~85-120h, merges 13-agent verified plan + valid Desktop findings + security items
**Sources:** task_plan.md (verified), findings.md (17 sections), intelligence-upgrade-corrected.md (Phase 14 detail)

---

## STATUS TRACKER

Update this section as batches complete:

- [ ] **Batch 0:** Deploy & Commit (45 min) — UNBLOCKS EVERYTHING
- [ ] **Batch 1:** Cloud Cleanup (1h)
- [ ] **Batch 2A:** Intelligence — Typed Errors + Constitutional (3-4h)
- [ ] **Batch 2B:** Intelligence — Token Budget + Memory Retention (6h)
- [ ] **Batch 2C:** Intelligence — Tool Adoption + Validation (12-16h)
- [ ] **Batch 2D:** Intelligence — HubSpot Consolidation (6-8h)
- [ ] **Batch 3:** Quick Wins (2h)
- [ ] **Batch 4:** Attribution Pipeline (15-25h)
- [ ] **Batch 5:** Frontend Hardening + Desktop Findings (8-12h)
- [ ] **Batch 6:** Infrastructure Hardening + Security (12-16h)
- [ ] **Batch 7:** Contact Consolidation — **SKIP IN AUTONOMOUS MODE** (needs manual plan)

---

## BATCH 0: DEPLOY & COMMIT

**Effort:** 45 min | **Risk:** LOW | **Depends on:** Nothing
**Why first:** Everything else is blocked until existing work is committed and deployed.

### Task 0.1: Commit All Current Work

```bash
git add -A
git commit -m "feat: Phase 14 Intelligence Upgrade + Attribution Pipeline + Command Center

Includes: constitutional framing for 17 agents, marketing upsert validators,
memory retention with TTL, mapDealFields shared, attribution deep views,
command center views, weekly health summary, cron cost optimization.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Task 0.2: Deploy Migrations

**STRICT ORDER (layer dependencies):**

```bash
supabase db push
```

If `supabase db push` fails on a specific migration, check:
- Migration #5 (`20260205020000_create_whatsapp_interactions`) may duplicate #2 (`20260204020000`). Compare content. If identical, delete #5.
- `vector` extension must be enabled in Supabase Dashboard before knowledge_base migration runs.

### Task 0.3: Deploy All Edge Functions

```bash
supabase functions deploy --all
```

### Task 0.4: Regenerate Types

```bash
npx supabase gen types typescript --project-id ztjndilxurtsfqdsvfds > src/integrations/supabase/types.ts
```

### Verification

```bash
npm run build
supabase db execute "SELECT COUNT(*) FROM campaign_full_funnel"
supabase db execute "SELECT COUNT(*) FROM token_usage_metrics"
supabase db execute "SELECT * FROM cron.job WHERE jobname LIKE 'cleanup%'"
```

**Done when:** Build passes, views return data, crons registered.

---

## BATCH 1: CLOUD CLEANUP

**Effort:** 1h | **Risk:** LOW | **Depends on:** Batch 0

### Task 1.1: Remove Anthropic Dead Code `[PARALLEL — 5 subagents]`

**Subagent 1 — ptd-ultimate-intelligence/index.ts:**
- Line 39: Delete the commented-out `ANTHROPIC_API_KEY` line
- Lines 50, 85, 200: Change `model: "claude"` to `model: "gemini"` in persona definitions
- Line 578: Delete the entire `if (persona.model === "claude")` branch (dead code path)
- Find function named `generateWithClaude()` → rename to `generateWithAI()` (it actually calls Gemini)

**Subagent 2 — system-health-check + ai-config-status:**
- `system-health-check/index.ts` lines 39-57, 62: Remove `ANTHROPIC_API_KEY` from the required secrets list/array
- `ai-config-status/index.ts` lines 42-43, 115-137: Remove the Anthropic connectivity test block. Keep the OpenAI embeddings test.

**Subagent 3 — super-agent-orchestrator + churn-predictor:**
- `super-agent-orchestrator/index.ts` lines 318, 342-347: Remove the `claudeKey` fallback check and related code
- `churn-predictor/index.ts` lines 24, 29: Delete the two commented-out `ANTHROPIC_API_KEY` lines

**Subagent 4 — generate-lead-replies + intervention-recommender + verify-all-keys:**
- `generate-lead-replies/index.ts` lines 34, 39: Delete commented `ANTHROPIC_API_KEY` lines
- `intervention-recommender/index.ts` lines 32-35: Delete commented `ANTHROPIC_API_KEY` lines
- `verify-all-keys/index.ts` lines 23-24: Remove Anthropic from the function-to-key mapping. Update to show only Gemini/OpenAI.

**Subagent 5 — Shared modules + frontend:**
- `_shared/unified-ai-client.ts` line 29: Change `provider: "gemini" | "anthropic" | "openai"` → `provider: "gemini" | "openai"`
- `_shared/observability.ts`: Find and remove any Anthropic model entries in cost tracking metadata
- `_shared/langsmith-tracing.ts`: Find and remove Anthropic entries from model-to-provider mapping
- `src/components/ai/AIAssistantPanel.tsx`: Find the error message that says "ANTHROPIC_API_KEY" → change to "GEMINI_API_KEY"

### Task 1.2: Remove Unused Frontend Packages

```bash
npm uninstall @langchain/core @langchain/google-genai langchain
```

### Task 1.3: Unset Dead Supabase Secrets

```bash
supabase secrets unset ANTHROPIC_API_KEY
supabase secrets unset LOVABLE_API_KEY
```

**Note:** If `supabase secrets unset` requires auth, run `supabase login` first.

### Verification

```bash
npm run build
# Verify no Anthropic references remain in edge functions:
grep -r "ANTHROPIC\|anthropic\|claude" supabase/functions/ --include="*.ts" -l | grep -v node_modules | grep -v ".git"
# Expected: 0 files (all cleaned). If any remain, clean them.
```

### Commit

```bash
git add -A && git commit -m "chore(batch-1): remove Anthropic dead code, LangChain packages, dead secrets

Cleaned 11 files of Anthropic references, removed 3 unused npm packages,
unset 2 dead Supabase secrets.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

**Done when:** Build passes, grep returns 0 Anthropic references.

---

## BATCH 2A: INTELLIGENCE — Typed Errors + Constitutional

**Effort:** 3-4h | **Risk:** LOW | **Depends on:** Batch 1
**Detail doc:** `docs/plans/2026-02-12-intelligence-upgrade-corrected.md` (Tasks 9 + 7)

### Task 14.9: Typed Errors in Auth Middleware `[PARALLEL with 14.7]`

**File:** `supabase/functions/_shared/auth-middleware.ts`

1. Add typed error classes at the top of the file:
```typescript
export class RateLimitError extends Error {
  constructor(message = "Rate limit exceeded") {
    super(message);
    this.name = "RateLimitError";
  }
}
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}
```
2. Replace all `throw new Error("rate limit...")` → `throw new RateLimitError(...)`
3. Replace all `throw new Error("unauthorized...")` → `throw new UnauthorizedError(...)`
4. Update catch blocks in edge functions that import from auth-middleware to handle typed errors

### Task 14.7: Constitutional Framing — Remaining Agents `[PARALLEL with 14.9]`

**Already done for 17 agents.** Check which agents still need `getConstitutionalSystemMessage()`.

1. Read `supabase/functions/_shared/unified-prompts.ts` — find `getConstitutionalSystemMessage` function
2. Grep all edge function `index.ts` files for `getConstitutionalSystemMessage`
3. For any AI-calling agent that does NOT use it, add it to their system prompt construction
4. The constitutional message should be prepended to the system prompt, NOT replace it

**Target:** All 39 AI-calling agents should have constitutional framing.

### Verification

```bash
npm run build
grep -r "getConstitutionalSystemMessage" supabase/functions/ --include="*.ts" -l | wc -l
# Should be >= 35 (most AI-calling agents)
```

### Commit

```bash
git add -A && git commit -m "feat(batch-2a): typed errors in auth-middleware + constitutional framing for all agents

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## BATCH 2B: INTELLIGENCE — Token Budget + Memory Retention

**Effort:** 6h | **Risk:** LOW-MED | **Depends on:** Batch 2A
**Detail doc:** `docs/plans/2026-02-12-intelligence-upgrade-corrected.md` (Tasks 1, 3+8)

### Task 14.1: Wire Token Budget Tracker

1. In `supabase/functions/_shared/unified-ai-client.ts`:
   - After each Gemini API call, extract `usageMetadata` from response
   - INSERT into `token_usage_metrics` table: `{ agent_name, model, prompt_tokens, completion_tokens, total_tokens, timestamp }`
2. The `token_usage_metrics` table is created by migration `20260213000004` (deployed in Batch 0)
3. Do NOT add tracking to the hot path — use fire-and-forget (no await on the INSERT)

### Task 14.3 + 14.8 COMBINED: Memory Retention + Context Namespacing

**⚠️ MUST be done together — both modify `learning-layer.ts`**

1. In `supabase/functions/_shared/learning-layer.ts`:
   - Add `agent_name` parameter to all memory storage functions
   - Add `expires_at` calculation based on memory tier:
     - Short-term: 90 days
     - Medium-term: 180 days
     - Long-term: 365 days
     - Permanent: null (no expiry)
   - Pass `agent_name` when inserting into `agent_learnings`, `agent_memory`, `agent_patterns`
2. Migration `20260213000005` (deployed in Batch 0) adds the columns
3. Wire `cleanup-agent-memory` edge function to delete rows where `expires_at < NOW()`

### Verification

```bash
npm run build
supabase functions deploy unified-ai-client learning-layer cleanup-agent-memory
# Test token tracking:
curl -X POST "https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/ptd-agent-gemini" \
  -H "Authorization: Bearer <anon-key>" \
  -d '{"query": "test"}'
supabase db execute "SELECT * FROM token_usage_metrics ORDER BY created_at DESC LIMIT 1"
```

### Commit

```bash
git add -A && git commit -m "feat(batch-2b): token budget tracking + memory TTL + agent namespacing

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## BATCH 2C: INTELLIGENCE — Tool Adoption + Validation

**Effort:** 12-16h | **Risk:** MED | **Depends on:** Batch 2B
**Detail doc:** `docs/plans/2026-02-12-intelligence-upgrade-corrected.md` (Tasks 2, 4+6)

### Task 14.2: Universal Tool Adoption `[PARALLEL with 14.4+14.6]`

Add tool-use support to the 2 major agents that lack it:

**ptd-ultimate-intelligence/index.ts:**
1. Import tools from `_shared/tool-definitions.ts` (use `import { tools }` — `getToolDefinitions()` does NOT exist)
2. Pass tools to the Gemini API call
3. Add tool-call response handling loop (check for `functionCall` in response parts)
4. Route tool calls through `_shared/tool-executor.ts`

**ai-ceo-master/index.ts:**
1. Already uses `unifiedAI.chat()` — just need to add tool definitions to the call
2. Add the tool-call loop pattern (same as ptd-agent-gemini uses)

**Pattern to follow:** Look at `supabase/functions/ptd-agent-gemini/index.ts` for the correct tool-call loop implementation.

### Task 14.4 + 14.6 COMBINED: Output Validation + UPSERT Marketing Agents

**⚠️ MUST be done together — both affect marketing agents**

1. Build **object validators** (NOT `JSON.parse` validators — marketing agents build objects programmatically, they don't parse JSON strings):
   - `validateMarketingSignal(obj)` — checks required fields exist
   - `validateMarketingRecommendation(obj)` — checks structure
   - `validateBudgetProposal(obj)` — checks numeric fields
2. Apply validators in these 6 marketing agents before INSERT:
   - `marketing-scout`, `marketing-analyst`, `marketing-predictor`
   - `marketing-copywriter`, `marketing-loss-analyst`, `marketing-allocator`
3. Change INSERT to UPSERT for idempotency
4. **CRITICAL:** Run dedup DELETE before creating UNIQUE indexes:
   ```sql
   -- In a new migration, BEFORE the UNIQUE index:
   DELETE FROM marketing_agent_signals a USING marketing_agent_signals b
   WHERE a.id < b.id AND a.agent_name = b.agent_name AND a.signal_key = b.signal_key;
   -- Then create unique index
   ```

### Verification

```bash
npm run build
supabase functions deploy ptd-ultimate-intelligence ai-ceo-master
supabase functions deploy marketing-scout marketing-analyst marketing-predictor
supabase functions deploy marketing-copywriter marketing-loss-analyst marketing-allocator
```

### Commit

```bash
git add -A && git commit -m "feat(batch-2c): tool adoption for 2 major agents + output validation for 6 marketing agents

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## BATCH 2D: INTELLIGENCE — HubSpot Consolidation

**Effort:** 6-8h | **Risk:** MED | **Depends on:** Batch 2C
**Detail doc:** `docs/plans/2026-02-12-intelligence-upgrade-corrected.md` (Task 5)

### Task 14.5: Consolidate HubSpot Sync

1. The shared `mapDealFields()` function is already in `_shared/hubspot-manager.ts` (done in Phase 14)
2. Verify ALL HubSpot sync functions use the shared version:
   - `sync-single-deal/index.ts`
   - `backfill-deals-history/index.ts`
   - `hubspot-webhook/index.ts` (deal handlers)
   - `sync-hubspot-to-supabase/index.ts`
3. Check for any remaining inline field mapping that doesn't go through `mapDealFields()`
4. **Column name corrections (verified against types.ts):**
   - Use `stage` NOT `deal_stage`
   - Use `last_used_at` NOT `last_confirmed_at`
   - Use `owner_id` NOT `hubspot_owner_id` (check actual column name in deals table)

### Verification

```bash
npm run build
grep -r "mapDealFields" supabase/functions/ --include="*.ts" -l
# Should show 3-4 files all using the shared version
grep -r "deal_stage\|hubspot_owner_id\|last_confirmed_at" supabase/functions/ --include="*.ts"
# Should return 0 results (all corrected)
```

### Commit

```bash
git add -A && git commit -m "feat(batch-2d): HubSpot sync consolidation complete — all functions use shared mapDealFields

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## BATCH 3: QUICK WINS

**Effort:** 2h | **Risk:** LOW | **Depends on:** Batch 0

### Task 3.1: Centralize Booking Stage IDs `[PARALLEL]`

1. Create `src/constants/dealStages.ts`:
```typescript
export const DEAL_STAGES = {
  BOOKED_ASSESSMENT: "123456",  // Find actual IDs in codebase
  COMPLETED_ASSESSMENT: "789012",
  // ... all stage IDs
} as const;
```
2. Grep for hardcoded stage IDs across frontend and replace with constants
3. Target: 5 locations currently hardcoding stage IDs

### Task 3.2: Register cleanup-agent-memory pg_cron `[PARALLEL]`

Create new migration file:
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_register_cleanup_cron.sql
SELECT cron.schedule(
  'cleanup-expired-agent-memory',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/cleanup-agent-memory',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb
  )$$
);
```

### Task 3.3: Fix Deals Schema Mismatch `[PARALLEL]`

- Check if `owner_id` vs `owner_name` columns align between deals table and `mapDealFields()` output
- If mismatch: update `mapDealFields()` to use correct column names from actual schema

### Verification

```bash
npm run build
```

### Commit

```bash
git add -A && git commit -m "feat(batch-3): centralize stage IDs, register cleanup cron, fix deals schema

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## BATCH 4: ATTRIBUTION PIPELINE

**Effort:** 15-25h | **Risk:** MED | **Depends on:** Batch 0
**Goal:** Answer "Which Facebook ad is making me money?"

### Task 4.1: Phase 3 — Ad Attribution on Contacts (2-4h)

1. Add columns to contacts table (new migration):
   ```sql
   ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attributed_ad_id TEXT;
   ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attributed_campaign_id TEXT;
   ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attributed_adset_id TEXT;
   ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attribution_source TEXT;
   ```
2. Wire `sync-hubspot-to-supabase` to populate from `attribution_events` table
3. Match logic: contact email/phone → attribution_events.email/phone within 7-day window

### Task 4.2: Phase 5 — Deal ↔ Stripe Link (4-8h)

1. JOIN path: `deals.contact_email → stripe_customers.email → stripe_charges`
2. Create view or function that matches deals to actual Stripe revenue
3. Handle: multiple charges per customer, partial matches, currency conversion

### Task 4.3: Phase 6 — Call → Ad/Deal Links (3-5h)

1. Wire `call_records` to `attribution_events` via phone number
2. Link calls to deals via contact association
3. Enables: "This call came from ad X and resulted in deal Y"

### Task 4.4: Phase 7 — Revenue per Creative (3-5h) ⭐ KEY DELIVERABLE

1. Create SQL view joining full chain: `facebook_ads_insights → attribution_events → contacts → deals → stripe_charges`
2. Output: `ad_id, ad_name, creative_url, spend, revenue, roas, cpl, cpo`
3. **THIS answers "Ad X spent AED Y and generated AED Z = TRUE ROI of N%"**

### Task 4.5: Phase 8 — Live Currency Rates (1-2h)

1. In `stripe-dashboard-data/index.ts`: replace hardcoded USD/EUR→AED conversion
2. Options: use a free currency API, or store rates in `org_memory_kv`

### Task 4.6: Phase 9 — Real Churn Rate (1-2h)

1. Compute churn from actual client drop-offs (no payment in 45+ days)
2. Replace current computation based on health score zones

### Task 4.7: Phase 10 — Fix Aggregator Mocks (2-3h)

1. Replace hardcoded "3 creatives" + "50 contacts" in dashboard components
2. Query actual data from the views created in 4.4

### Task 4.8: Phase 11 — Deal Webhook (1h)

1. In `hubspot-webhook/index.ts`: add handler for `deal.propertyChange` event
2. On stage change: update local deals table, trigger attribution re-calculation

### Verification

```bash
npm run build
supabase db push  # Deploy new migrations
supabase db execute "SELECT ad_id, ad_name, spend, revenue, roas FROM ad_creative_funnel LIMIT 5"
# Should return real data with actual revenue figures
```

### Commit

```bash
git add -A && git commit -m "feat(batch-4): attribution pipeline complete — ad → contact → deal → revenue chain

Answers 'which Facebook ad is making me money' with real Stripe revenue data.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## BATCH 5: FRONTEND HARDENING + DESKTOP FINDINGS

**Effort:** 8-12h | **Risk:** LOW-MED | **Depends on:** Batch 0

### Task 5.1: Error Boundaries `[PARALLEL]`

Wrap these pages in React error boundaries:
- `src/pages/Dashboard.tsx` (or ExecutiveDashboard)
- `src/pages/CommandCenter.tsx`
- `src/pages/SetterActivityToday.tsx`

Use a simple ErrorBoundary component with "Something went wrong" fallback + retry button.

### Task 5.2: Data Freshness Indicators `[PARALLEL]`

Add `last_synced_at` badges to key dashboard components showing data age.

### Task 5.3: Delete Dead Pages `[PARALLEL]`

Delete these 6 unused pages (741 LOC total):
- `src/pages/Dashboard.tsx` (if duplicate of ExecutiveDashboard — verify first)
- `src/pages/FishbirdValidation.tsx`
- `src/pages/IntelligenceDashboard.tsx`
- `src/pages/SuperDashboard.tsx`
- `src/pages/UltimateDashboard.tsx`
- `src/pages/WorkflowStrategy.tsx`

Also remove their routes from the router configuration.

### Task 5.4: Fix Frontend `any` Types `[PARALLEL]`

- 97 `as any` across 37 files — replace with proper types
- 12 `useState<any>` — add proper generic types
- Priority: data hooks and API response handlers

### Task 5.5: Remove Production console.logs `[PARALLEL]`

Find and remove 3 `console.log` statements in production code.

### Task 5.6: Route-Level Code Splitting (Desktop Finding)

Add `React.lazy()` for page routes:
```typescript
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SalesPipeline = lazy(() => import("./pages/SalesPipeline"));
// ... all 38 pages
```
Wrap in `<Suspense fallback={<PageSkeleton />}>`.
Target: reduce initial bundle from 2.4MB to <1MB.

### Task 5.7: Form Validation (Desktop Finding)

1. Install Zod: `npm install zod`
2. Add validation to high-traffic forms:
   - Deal creation/edit forms
   - Settings forms
   - Any form that writes to Supabase

### Task 5.8: Frontend select("*") Remediation (Desktop Finding)

- 88 instances across 35 frontend files
- Replace `.select("*")` with `.select("id, name, email, ...")` — only columns the component uses
- **Priority:** contacts queries (contacts table has 119 columns, most are PII)

### Task 5.9: Bridge Layer — types.ts Usage (Desktop Finding)

- Only 2 app files import the `Database` type from types.ts
- Add typed Supabase client in key data-fetching hooks
- Pattern: `const { data } = await supabase.from("table").select("col1, col2").returns<Database["public"]["Tables"]["table"]["Row"][]>()`

### Task 5.10: SalesTabs Type Safety (Desktop Finding)

- `src/components/sales-pipeline/SalesTabs.tsx` lines 34-43: all 8 props typed `any`
- Define proper interfaces for each prop

### Verification

```bash
npm run build
# Check bundle size:
npm run build 2>&1 | grep -E "dist/|\.js"
# Target: index chunk < 500KB (was 2.4MB)
```

### Commit

```bash
git add -A && git commit -m "feat(batch-5): frontend hardening — error boundaries, code splitting, type safety, select(*) fix

Reduced bundle size, added form validation, fixed 97 'as any' types,
removed dead pages.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## BATCH 6: INFRASTRUCTURE HARDENING + SECURITY

**Effort:** 12-16h | **Risk:** MED | **Depends on:** Batch 0

### Task 6.1: Auth Middleware for Unprotected EFs `[PARALLEL]`

Add `import { validateRequest } from "../_shared/auth-middleware.ts"` to these 7 functions:
- Check which functions in `supabase/config.toml` have `verify_jwt = false` that are NOT webhooks
- Webhooks (stripe-webhook, hubspot-webhook, anytrack-webhook, calendly-webhook) must stay without JWT — they use their own signature verification
- Add auth check at the top of each unprotected non-webhook function

### Task 6.2: Migrate Raw Gemini → UnifiedAI `[PARALLEL]`

These 3 functions call Gemini API directly instead of using UnifiedAIClient:
- `marketing-copywriter/index.ts`
- `stripe-enterprise-intelligence/index.ts`
- `vision-analytics/index.ts` (may be archived — check first)

Replace direct `fetch("https://generativelanguage.googleapis.com/...")` with `UnifiedAIClient` import.

### Task 6.3: RLS Audit (Other Session + Verified) `[PARALLEL]`

1. Query which tables lack RLS:
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
  SELECT tablename FROM pg_policies
);
```
2. Enable RLS on tables with sensitive data (contacts, deals, stripe_*, health_scores)
3. Add policies: service_role can do everything, anon can read only public data

### Task 6.4: Stripe Webhook Signature Verification (Other Session)

1. In `stripe-webhook/index.ts`: verify the function checks `Stripe-Signature` header
2. If not: add `stripe.webhooks.constructEvent(body, sig, webhookSecret)` verification
3. This prevents forged webhook calls

### Task 6.5: Rotate cron_secret (Blind Spot #4)

1. Grep for hardcoded `cron_secret` values in edge functions (4 files)
2. Move to Supabase Secrets: `supabase secrets set CRON_SECRET=<new-value>`
3. Update all 4 files to use `Deno.env.get("CRON_SECRET")`

### Task 6.6: Backend select("*") Remediation (Desktop Finding)

- 158 instances across 64 backend files
- Replace `.select("*")` with specific columns
- **Priority:** contacts table queries (119 columns including PII like email, phone, address)
- **Second priority:** deals table queries

### Task 6.7: apiClient.ts Type Safety (Desktop Finding)

- `src/lib/apiClient.ts`: `invoke<any>` → `invoke<SpecificResponseType>`
- `body: any` → proper typed params
- This is the main frontend-to-backend bridge — typing it propagates safety everywhere

### Task 6.8: Schema Drift Fix (Desktop Finding)

1. 17+ tables exist in migrations but are missing from `types.ts`
2. Run type regeneration:
```bash
npx supabase gen types typescript --project-id ztjndilxurtsfqdsvfds > src/integrations/supabase/types.ts
```
3. Verify the new types include marketing tables (marketing_agent_signals, etc.)

### Task 6.9: Add Primary Keys to 10 Tables (Blind Spot #1)

1. Identify the 10 tables without primary keys:
```sql
SELECT t.table_name FROM information_schema.tables t
LEFT JOIN information_schema.table_constraints tc
ON t.table_name = tc.table_name AND tc.constraint_type = 'PRIMARY KEY'
WHERE t.table_schema = 'public' AND tc.constraint_name IS NULL;
```
2. Create migration adding PKs (use `id SERIAL PRIMARY KEY` or promote existing unique column)
3. **WARNING:** Adding PK to table with duplicate rows will fail — dedup first

### Task 6.10: Index Audit (4h)

- 323 potentially unused indexes identified
- Query `pg_stat_user_indexes` for `idx_scan = 0` indexes
- Do NOT drop indexes without checking production usage stats
- Create a report, drop only confirmed-unused indexes

### Task 6.11: Cron Consolidation

- Run `SELECT * FROM cron.job` to see all registered crons
- Compare against expected list in CLAUDE.md (14 active crons)
- Remove any orphaned cron entries

### Verification

```bash
npm run build
supabase functions deploy --all
# RLS check:
supabase db execute "SELECT tablename, COUNT(*) as policies FROM pg_policies WHERE schemaname='public' GROUP BY tablename ORDER BY policies"
```

### Commit

```bash
git add -A && git commit -m "feat(batch-6): infrastructure hardening — auth, RLS, type safety, schema drift, PKs

Added auth to unprotected EFs, enabled RLS, fixed 158 select(*),
typed apiClient, regenerated types, added PKs to 10 tables.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## BATCH 7: CONTACT CONSOLIDATION — SKIP IN AUTONOMOUS MODE

**⚠️ DO NOT ATTEMPT AUTONOMOUSLY**

This batch consolidates 4 overlapping contact tables into 1. It requires:
1. Full inventory of all `enhanced_leads` queries (16+ frontend files)
2. Full inventory of all `sales_leads` queries
3. Staging environment with production data clone
4. Full database backup before migration
5. Frontend PR ready with ALL query updates

**Action:** Mark as "NEEDS MANUAL PLAN" in progress.md and stop.

---

## MULTI-AGENT DISPATCH GUIDE

### When to Use Parallel Subagents

| Batch | Parallelism | Subagents |
|-------|-------------|-----------|
| 0 | Sequential | 1 (deploy depends on commit) |
| 1 | **5 parallel** | One per file group (see Task 1.1) |
| 2A | **2 parallel** | Typed errors + constitutional (different files) |
| 2B | Sequential | Shared file dependency (learning-layer.ts) |
| 2C | **2 parallel** | Tool adoption + validation (different agents) |
| 2D | Sequential | Single task |
| 3 | **3 parallel** | 3 independent tasks |
| 4 | Sequential | Each phase builds on previous |
| 5 | **5+ parallel** | Mostly independent UI changes |
| 6 | **4+ parallel** | Auth, RLS, select(*), types all independent |

### Subagent Prompt Template

```
You are a code editing subagent. Your task:

1. Read [specific files]
2. Make [specific changes]
3. Verify: run `npx tsc --noEmit` (or `npm run build` if available)
4. Report: DONE with summary, or FAILED with error message

Do NOT modify files outside your assigned scope.
```

---

## SESSION HANDOFF PROTOCOL

If context is running low or you're at a natural stopping point:

1. Finish current task (do not leave partial edits)
2. Run `npm run build` — fix any errors
3. Commit all work with descriptive message
4. Update `progress.md` with:
   - Which batch/task you completed
   - Any issues encountered
   - What's next
5. Update the STATUS TRACKER at the top of this document
6. Stop cleanly

The next session will read this document + progress.md and continue.

---

## SCORING PROJECTIONS

| After Batch | Intelligence | Infrastructure | Overall |
|------------|-------------|----------------|---------|
| Current | 46.7/100 | 82/100 | 63.8/100 |
| 0 (Deploy) | 46.7 | 85 | 65 |
| 1 (Cleanup) | 46.7 | 86 | 66 |
| 2 (Phase 14) | **~82** | 86 | **~83** |
| 3 (Quick Wins) | 82 | 87 | 84 |
| 4 (Attribution) | 82 | 88 | **~85** |
| 5 (Frontend) | 82 | 90 | **~86** |
| 6 (Infra+Security) | 85 | 95 | **~90** |
| 7 (Contacts) | 88 | 97 | **~92** |
