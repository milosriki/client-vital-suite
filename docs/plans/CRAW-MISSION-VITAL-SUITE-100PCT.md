# MISSION: SHIP VITAL SUITE TO 100% — ZERO REGRESSION

You are completing the PTD Fitness Vital Suite app at `/Users/milosvukovic/client-vital-suite/`.
Batches 0-6 of the autonomous execution plan are DONE. This mission covers ONLY verified remaining gaps.

Every claim below was verified by 6 parallel research agents on 2026-02-23 against the live codebase and production Supabase DB. Nothing is assumed — everything has file paths and line numbers.

---

## GROUND TRUTH (Read these — they are current and accurate)

```
/Users/milosvukovic/client-vital-suite/findings.md                          # 1,231 lines. Forensic audit (2026-02-11). ~80% still accurate.
/Users/milosvukovic/client-vital-suite/docs/plans/autonomous-execution-plan.md  # Batches 0-6 DONE. Batch 7 SKIP.
supabase/functions/_shared/auth-middleware.ts                                # verifyAuth() definition. Lines 11-49.
src/integrations/supabase/types.ts                                          # 9,282 lines. Schema truth. Last updated 2026-02-17.
```

---

## PHASE 1 — DEPLOY WHAT'S BUILT (30 min, zero code changes)

### 1.1 Push 20+ unpushed commits
```bash
cd /Users/milosvukovic/client-vital-suite
git status                          # 27 modified, 39 untracked
npm run build                       # MUST pass before pushing
git add -A && git commit -m "chore: stage all pending work from Feb 22-23 sessions"
git push origin main
```

### 1.2 Apply 7 pending migrations
These are local-only. Production DB does NOT have them:

| Migration | What it does |
|-----------|-------------|
| `20260213000005_memory_retention_and_namespacing.sql` | WARNING: timestamp collision with remote. Check with `supabase migration list` first. |
| `20260219000000_secure_lisa_rag_isolation.sql` | Lisa RAG category isolation |
| `20260220000000_fix_cron_project_urls.sql` | Cron URL fixes |
| `20260220195943_add-coach-client-notes.sql` | Coach-client notes table |
| `20260220_fix_match_knowledge.sql` | Knowledge matching RPC |
| `20260222000000_unified_memory_all_categories.sql` | Unified memory categories |
| `20260222100000_fix_agent_memory_rpcs.sql` | CRITICAL — fixes match_agent_memory + match_memories RPCs |

```bash
supabase migration list --linked     # Verify which are pending
supabase db push --linked            # Apply all pending
```

**COLLISION WARNING**: `20260213000005` exists remotely with DIFFERENT content. Inspect both versions before pushing. If conflict, rename local file to `20260213000006`.

### 1.3 Deploy edge functions
```bash
supabase functions deploy --project-ref ztjndilxurtsfqdsvfds
```

### 1.4 Regenerate types after migration
```bash
npx supabase gen types typescript --project-id ztjndilxurtsfqdsvfds > src/integrations/supabase/types.ts
npm run build   # Verify no type errors
```

**DONE WHEN**: `git log origin/main..HEAD` shows 0 commits ahead. `supabase migration list` shows 0 pending.

---

## PHASE 2 — CRITICAL SECURITY (1-2h)

### 2.1 meta-ads-proxy: ADD AUTH (P0)
**File**: `supabase/functions/meta-ads-proxy/index.ts`
**Problem**: Zero authentication. No verifyAuth, no Bearer check, no JWT. Anyone can invoke the Anthropic API and modify Meta Ads campaigns through this endpoint.
**Fix**: Add `verifyAuth(req)` call at the top of the request handler. Import from `../_shared/auth-middleware.ts`.

### 2.2 callgear-webhook: ADD SIGNATURE VERIFICATION (P0)
**File**: `supabase/functions/callgear-webhook/index.ts`
**Problem**: No auth, no signature check. Anyone can POST fake call data.
**Fix**: Add IP allowlist or shared secret validation. Check CallGear docs for webhook signature headers.

### 2.3 Audit remaining 29 unauthed EFs
31 non-webhook functions lack verifyAuth. Top 5 most dangerous (they mutate data):

| Function | Risk | Action |
|----------|------|--------|
| `create-alerts-table` | DDL — creates tables | Add verifyAuth or make non-HTTP (cron only) |
| `meta-ads-setup-tables` | DDL — creates tables | Add verifyAuth |
| `ml-setup-tables` | DDL — creates tables | Add verifyAuth |
| `setup-full-sync-tables` | DDL — creates tables | Add verifyAuth |
| `setup-notes-table` | DDL — creates tables | Add verifyAuth |

The other 24 (cron jobs, ML pipelines, sync functions) are lower risk but should get Bearer token checks. Spawn a subagent to add `verifyAuth(req)` to all 29 in parallel.

**DONE WHEN**: `grep -rL "verifyAuth" supabase/functions/*/index.ts | grep -v _archive | grep -v webhook | wc -l` returns 0 (excluding webhooks).

---

## PHASE 3 — DATA INTEGRITY (2-4h)

### 3.1 Verify agent memory RPCs work
The migration `20260222100000_fix_agent_memory_rpcs.sql` fixes 3 bugs:
1. `match_agent_memory` used `am.embeddings` (wrong column — actual column is `embedding`)
2. `match_memories` accepted `threshold, count` but callers send `match_threshold, match_count, filter_thread_id`
3. Three edge functions wrote to `embeddings:` key instead of `embedding:`

Code fixes already applied in:
- `supabase/functions/ptd-agent-gemini/index.ts` line 487
- `supabase/functions/ptd-agent-atlas/index.ts` line 466
- `supabase/functions/_shared/unified-brain.ts` line 207

**Verify after deploy**:
```sql
-- Should return rows (2,772 memories exist with embeddings)
SELECT count(*) FROM agent_memory WHERE embedding IS NOT NULL;

-- Test the fixed RPC
SELECT id, similarity FROM match_agent_memory(
  (SELECT embedding FROM agent_memory WHERE embedding IS NOT NULL LIMIT 1),
  0.5, 3, 'ptd-agent-gemini', NULL
);
```

### 3.2 Backfill Stripe transactions
**Problem**: `stripe_transactions` table has 0 rows. The `stripe-backfill` function exists but was never called.
```bash
# Invoke the backfill
curl -X POST "https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/stripe-backfill" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```
Verify: `SELECT count(*) FROM stripe_transactions;` should return > 0.

### 3.3 Fix 2 marketing functions still using INSERT
Only these 2 need UPSERT conversion (the other 7 are already correct):

| Function | Line | Table | Fix |
|----------|------|-------|-----|
| `marketing-loss-analyst/index.ts` | ~170 | marketing data | Change `.insert()` to `.upsert()` with appropriate conflict key |
| `marketing-scout/index.ts` | ~175 | marketing data | Change `.insert()` to `.upsert()` with appropriate conflict key |

Read each file to determine the correct `onConflict` key based on the table schema.

### 3.4 Add CPL/CPO to financial-analytics
**File**: `supabase/functions/financial-analytics/index.ts` (252 lines)
**Problem**: Computes CAC, ARPU, CLV, LTV:CAC ratio — but NO CPL (Cost Per Lead) or CPO (Cost Per Opportunity).
**Fix**: After the existing CAC calculation (line ~140), add:
```typescript
const cpl = totalLeadsNew > 0 ? totalSpend / totalLeadsNew : 0;
const cpo = totalOpportunities > 0 ? totalSpend / totalOpportunities : 0;
```
Include `cpl` and `cpo` in the response object.

### 3.5 Currency rate automation
**File**: `supabase/functions/stripe-dashboard-data/index.ts` lines 15-53
**Current state**: Hardcoded fallback rates (USD=3.67, EUR=4.00). Dynamic override from `org_memory_kv` table EXISTS (line 32-53) but nobody writes to it.
**Fix**: Create a cron-triggered edge function `update-currency-rates` that:
1. Fetches live rates from a free API (e.g., exchangerate-api.com)
2. Writes to `org_memory_kv` with namespace="config", key="currency_rates_aed"
3. Runs daily at 6AM Dubai time

**DONE WHEN**: `SELECT * FROM org_memory_kv WHERE namespace='config' AND key='currency_rates_aed';` returns fresh rates.

---

## PHASE 4 — ATTRIBUTION CHAIN COMPLETION (4-8h)

The core business question: "Which ad made me money?"

Current chain: `Facebook Ad (OK) -> Lead (OK) -> Call (NO ad link) -> Deal (NO Stripe FK) -> Revenue (indirect only)`

### 4.1 Deal-to-Stripe foreign key (CRITICAL)
**Problem**: No direct `stripe_payment_id` on `deals` table. Stripe webhook writes to separate tables. Reconciliation requires cross-table joins.
**Fix**: Add migration:
```sql
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT;
CREATE INDEX IF NOT EXISTS idx_deals_stripe_payment_id ON deals(stripe_payment_id);
```
Then update `stripe-webhook/index.ts` to write `stripe_payment_id` when matching a deal.

### 4.2 Ad ID on contacts (strengthen indirect link)
**Current**: `attribution_events` table captures `fb_ad_id` via `user_email` match (3-hop join). Works but fragile.
**Fix**: Add `fb_ad_id` and `fb_campaign_id` columns to `contacts` table. Update `sync-hubspot-to-supabase` to populate from attribution_events on sync.

### 4.3 VisualDNA ROAS
**File**: `src/components/dashboard/VisualDNA.tsx` lines 28-33
**Current**: Has fallback logic for `purchase_value / spend`. Works IF data source provides the fields.
**Fix**: Ensure the data query that feeds VisualDNA includes `purchase_value` from `fetch-facebook-insights` output. Trace the data flow from API → store → component props.

**DONE WHEN**: Run `SELECT fb_ad_id, deal_value, stripe_payment_id FROM deals WHERE stripe_payment_id IS NOT NULL LIMIT 5;` and get results.

---

## PHASE 5 — CLEANUP (2h)

### 5.1 Resolve 172 remaining select("*")
```bash
grep -rn '\.select("\*")' supabase/functions/ src/pages/ src/hooks/ --include="*.ts" --include="*.tsx" | wc -l
```
Spawn subagents to replace each with named columns. Priority: edge functions first (134 occurrences), then pages (26), then hooks (12).

### 5.2 Audit 70 orphaned remote EFs
```bash
# Compare local vs deployed
comm -23 <(cat deployed_functions.txt | sort) <(ls supabase/functions/ | sort)
```
For each orphan: check if it's a legacy version of a renamed function. If truly dead, delete from remote with `supabase functions delete <name>`.

### 5.3 Restore 3 high-value archived pages (OPTIONAL)
These are complete, working pages in `src/pages/_archived/`. Router has explicit redirects blocking them.

| Page | Lines | Route to add | Value |
|------|-------|-------------|-------|
| `LeadFollowUp.tsx` | 363 | `/lead-follow-up` | 6,617 leads with setter follow-up flags |
| `AttributionLeaks.tsx` | 498 | `/attribution-leaks` | Attribution discrepancy view |
| `WorkflowStrategy.tsx` | 795 | `/workflow-strategy` | AI agent decision dashboard |

To restore: move from `_archived/` back to `pages/`, add route in `src/main.tsx`, remove the redirect entry.

---

## ANTI-PATTERNS (DO NOT DO THESE)

These are mistakes from a previous prompt that was 65% accurate. CRAW must NOT:

| Action | Why it's wrong |
|--------|---------------|
| Delete ANTHROPIC_API_KEY | ACTIVE in meta-ads-proxy dual-AI pipeline (line 255) |
| Delete LOVABLE_API_KEY | ACTIVE (conditional) in stripe-forensics (line 66) |
| Remove enhanced_leads references | ACTIVE in 19 files — UI, hooks, pages, edge functions |
| Rename generateWithClaude() | Function doesn't exist. Already named generateWithAI() at line 585 |
| Re-implement token budget tracking | Already works — lines 744, 750, 578, 579 increment correctly |
| Convert all 9 marketing agents to UPSERT | Only 2 need conversion (loss-analyst, scout). Other 7 are correct |
| Merge enterprise worktree | 457 files diverged, 128 commits behind. DO NOT MERGE without full audit |
| Redo Batches 0-6 | All complete. Verified in autonomous-execution-plan.md |

---

## VERIFICATION PROTOCOL

After each phase, run this checklist:

```bash
# Build passes
npm run build

# Type check passes
npx tsc --noEmit

# No unpushed commits
git log origin/main..HEAD --oneline | wc -l   # Should be 0

# No pending migrations
supabase migration list --linked 2>&1 | grep -c "not applied"  # Should be 0

# Auth coverage (excluding webhooks + archive)
grep -rL "verifyAuth" supabase/functions/*/index.ts | grep -v _archive | grep -v webhook | wc -l

# select("*") count (decreasing toward 0)
grep -rn '\.select("\*")' supabase/functions/ src/ --include="*.ts" --include="*.tsx" | wc -l
```

---

## EXECUTION ORDER

```
PHASE 1 (deploy)  →  PHASE 2 (security)  →  PHASE 3 (data)  →  PHASE 4 (attribution)  →  PHASE 5 (cleanup)
   30 min               1-2h                  2-4h                 4-8h                      2h
```

Total: ~10-16h of CRAW execution time across multiple sessions.

Spawn subagents for:
- Phase 2.3 (29 verifyAuth additions — parallelize across functions)
- Phase 5.1 (172 select("*") replacements — parallelize by directory)
- Phase 5.2 (70 orphan audit — parallelize in batches of 10)

---

## SCORE PROJECTION

| Metric | Current | After Phase 1-2 | After All Phases |
|--------|---------|-----------------|-----------------|
| System Health | 6.5/10 | 7.5/10 | 9.0/10 |
| Security | 4/10 | 8/10 | 9.5/10 |
| Attribution | 3/10 | 3/10 | 8/10 |
| Data Integrity | 5/10 | 7/10 | 9/10 |
| Deploy Hygiene | 3/10 | 8/10 | 9/10 |
| **Overall** | **63.8/100** | **~75/100** | **~92/100** |
