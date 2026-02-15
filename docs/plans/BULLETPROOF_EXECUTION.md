# BULLETPROOF EXECUTION PLAN — Can't Go Wrong

> **For Antigravity Agent.** Read this file. Execute step by step. Follow every skill referenced. Verify after every batch. Do not skip verification. Do not skip rollback checkpoints.

---

## RULES (Non-Negotiable)

1. **READ the skill file** before starting any batch (path provided)
2. **CHECKPOINT** before each batch: `git stash` or verify clean state
3. **VERIFY** after each batch: run the exact commands listed
4. **ROLLBACK** if verification fails: `git stash pop` or `git checkout .`
5. **COMMIT** only after verification passes — use the exact commit message
6. **UPDATE** the STATUS TRACKER in `autonomous-execution-plan.md` after each batch
7. **NEVER** edit a file without reading it first
8. **NEVER** delete a file without `grep -r` confirming nothing imports it

---

## STATUS TRACKER (Updated: 2026-02-12)

> **Legend:**
>
> - ✅ **DONE** = 100% Complete
> - 🟢 **IN PROGRESS** = Partially complete (show %)
> - 🔴 **NOT STARTED** = 0% Complete
> - 🚨 **CRITICAL** = Blocks production launch

---

### Batch 0: Deploy & Commit

**Status:** ✅ **100% DONE**

- Pushed commits: `82d64ef` + `ea7a2dc`

---

### Batch 1: Cloud Cleanup

**Status:** 🔴 **0% COMPLETE** _(Low Priority - Can Defer)_
**Missing:**

- [ ] Remove Anthropic from 12 Edge Functions
- [ ] Remove `@langchain/*` npm packages
- [ ] Unset dead Supabase secrets

**Impact:** Technical debt cleanup. Not critical.

---

### Batch 3: Quick Wins

**Status:** 🔴 **0% COMPLETE**
**Missing:**

- [ ] 🚨 **CRITICAL:** Register cleanup cron job (memory will grow unbounded)
- [ ] Centralize Deal Stage IDs
- [ ] Fix deals schema mismatch

**Impact:** Step 3.2 is a TIME BOMB. Need TTL enforcement ASAP.

---

### Batch 2A: Typed Errors + Constitutional

**Status:** 🔴 **0% COMPLETE**
**Missing:**

- [ ] Add typed error classes to `auth-middleware.ts`
- [ ] Add constitutional framing to ~35 AI agents

**Impact:** AI quality + brand risk. High priority.

---

### Batch 2B: Token Budget + Memory Retention

**Status:** 🔴 **0% COMPLETE**
**Missing:**

- [ ] 🚨 **CRITICAL:** Wire memory TTL (`expires_at`) to `learning-layer.ts`
- [ ] Wire token budget tracker to `unified-ai-client.ts`

**Impact:** Step 2B.2 is URGENT (same as Batch 3.2).

---

### Batch 2D: HubSpot Consolidation

**Status:** 🔴 **0% COMPLETE**
**Missing:**

- [ ] Verify all sync functions use shared `mapDealFields()`
- [ ] Fix column name mismatches (`deal_stage` → `stage`)

**Impact:** Code duplication + data integrity risk.

---

### Batch 2C: Tool Adoption + Validation

**Status:** 🔴 **0% COMPLETE** _(BIGGEST BATCH: 12-16h)_
**Missing:**

- [ ] 🚨 **CRITICAL:** Add tool-use to `ptd-ultimate-intelligence` and `ai-ceo-master` (AI is neutered without this)
- [ ] Add output validators to 6 marketing agents
- [ ] Dedup migration + unique index on `marketing_agent_signals`

**Impact:** AI can't actually DO anything. It's just a chatbot.

---

### Batch 5: Frontend Hardening

**Status:** 🔴 **0% COMPLETE** _(8-12h)_
**Missing:**

- [ ] 🚨 **EXTREME RISK:** Error boundaries (any unhandled error = white screen)
- [ ] 🚨 **HIGH RISK:** Fix 97 `as any` casts (runtime crashes waiting to happen)
- [ ] Data freshness badges
- [ ] Delete 6 dead pages
- [ ] Remove `console.log` from production
- [ ] Code splitting with `React.lazy()`
- [ ] Zod form validation
- [ ] Fix 88 `select("*")` in frontend
- [ ] Typed Supabase client
- [ ] Fix `SalesTabs.tsx` types

**Impact:** The "Glass Jaw." App will crash without 5.1 and 5.4.

---

### Batch 4: Attribution Pipeline

**Status:** 🔴 **0% COMPLETE** _(15-25h, BUSINESS CRITICAL)_
**Missing (All 8 Steps Sequential):**

- [ ] Add ad attribution columns to `contacts`
- [ ] Link Deals ↔ Stripe via email JOIN
- [ ] Link Calls → Ads/Deals via phone
- [ ] Create `ad_creative_funnel` view (Revenue per Ad)
- [ ] Live currency rates
- [ ] Real churn rate logic
- [ ] Fix aggregator mocks
- [ ] Add `deal.propertyChange` handler

**Impact:** Can't measure marketing ROI. MONEY on the table.

---

### Batch 6: Infrastructure + Security

**Status:** 🟢 **60% COMPLETE** _(Most critical done, cleanup remaining)_

**✅ What's Done:**

- [x] 6.2: Migrated raw Gemini → `UnifiedAI`
- [x] 6.7: Typed `apiClient.ts`
- [x] 6.8: Schema drift fix (`aws_truth_cache`)
- [x] 6.9: Primary Key audit (all tables have PKs)
- [x] 6.10: Index audit (migration created)

**Missing:**

- [ ] 🚨 **SECURITY RISK:** Auth middleware for unprotected Edge Functions
- [ ] 🚨 **DATA LEAK RISK:** RLS audit on `contacts`, `deals`, `stripe_*`
- [ ] 🚨 **SECURITY RISK:** Stripe webhook signature verification
- [ ] Rotate `cron_secret` to env var
- [ ] Fix 158 `select("*")` in backend

**Impact:** 6.1, 6.3, 6.4 are production security holes.

---

### Batch 7: Performance Optimization

**Status:** 🔴 **0% COMPLETE**
**Missing:**

- [ ] Load testing on `marketing-copywriter`
- [ ] Query `pg_stat_statements` for slow queries
- [ ] Frontend bundle analysis

**Impact:** Don't know capacity limits. Blindside risk.

---

## CRITICAL PATH TO PRODUCTION (Priority Order)

**🚨 EXTREME (Do First - 10h):**

1. Batch 5.1: Error Boundaries (2h)
2. Batch 6.1: Auth middleware (3h)
3. Batch 6.3: RLS policies (4h)
4. Batch 6.4: Stripe webhook signature (1h)

**🔴 CRITICAL (Do Next - 13h):** 5. Batch 5.4: Fix `as any` (4h) 6. Batch 3.2: Cleanup cron job (1h) 7. Batch 2B.2: Memory TTL (2h) 8. Batch 2C.1: AI tool-use (6h)

**🟠 HIGH (Do Soon - 18-28h):** 9. Batch 4: Attribution pipeline (15-25h) 10. Batch 5.6: Code splitting (3h)

**Total to Production Ready:** 41-51 hours

---

## BATCH 1: Cloud Cleanup (30 min remaining)

### Pre-Flight

```bash
# Skill to read FIRST:
cat ~/.gemini/antigravity/skills/code-refactoring-refactor-clean/SKILL.md
cat ~/.gemini/antigravity/skills/codebase-cleanup-deps-audit/SKILL.md

# Checkpoint:
cd /Users/milosvukovic/client-vital-suite
git status  # Must be clean
```

### Step 1.1: Remove Anthropic from active Edge Functions (12 files)

**IMPORTANT:** Read each file FULLY before editing. Use `grep -n` to see exact line numbers.

|  #  | File                                                    | What to Remove                                                                                     | How to Verify                                     |
| :-: | :------------------------------------------------------ | :------------------------------------------------------------------------------------------------- | :------------------------------------------------ |
|  1  | `supabase/functions/ptd-ultimate-intelligence/index.ts` | `model: "claude"` refs, dead `generateWithClaude()`, dead `if (persona.model === "claude")` branch | `grep -n "claude\|anthropic" <file>` returns 0    |
|  2  | `supabase/functions/system-health-check/index.ts`       | `ANTHROPIC_API_KEY` from required secrets array                                                    | `grep -n "ANTHROPIC\|anthropic" <file>` returns 0 |
|  3  | `supabase/functions/ai-config-status/index.ts`          | Anthropic connectivity test block                                                                  | `grep -n "ANTHROPIC\|anthropic" <file>` returns 0 |
|  4  | `supabase/functions/generate-lead-replies/index.ts`     | Commented `ANTHROPIC_API_KEY` lines                                                                | `grep -n "ANTHROPIC\|anthropic" <file>` returns 0 |
|  5  | `supabase/functions/generate-lead-reply/index.ts`       | Commented `ANTHROPIC_API_KEY` lines                                                                | `grep -n "ANTHROPIC\|anthropic" <file>` returns 0 |
|  6  | `supabase/functions/intervention-recommender/index.ts`  | Commented `ANTHROPIC_API_KEY` lines                                                                | `grep -n "ANTHROPIC\|anthropic" <file>` returns 0 |
|  7  | `supabase/functions/verify-all-keys/index.ts`           | Anthropic from key mapping                                                                         | `grep -n "ANTHROPIC\|anthropic" <file>` returns 0 |
|  8  | `supabase/functions/_shared/unified-personas.ts`        | Claude model references                                                                            | `grep -n "claude\|anthropic" <file>` returns 0    |
|  9  | `supabase/functions/_shared/langsmith-hub-example.ts`   | Anthropic entries                                                                                  | `grep -n "claude\|anthropic" <file>` returns 0    |
| 10  | `supabase/functions/_shared/content-filter.ts`          | Anthropic entries                                                                                  | `grep -n "claude\|anthropic" <file>` returns 0    |
| 11  | `supabase/functions/_shared/langsmith-tracing.ts`       | Anthropic model mapping                                                                            | `grep -n "claude\|anthropic" <file>` returns 0    |
| 12  | `supabase/functions/_shared/observability.ts`           | Anthropic cost metadata                                                                            | `grep -n "claude\|anthropic" <file>` returns 0    |

**Process for EACH file:**

1. `grep -n "ANTHROPIC\|anth### Protocol A: The "Double-Tap" Verification
   Every change requires two independent checks:
1. **The Action:** Execute the code change (e.g., `run_command` or `replace_file_content`).
1. **The Verification:** Use a _different_ tool to verify (e.g., `grep_search` or `view_file`).
   - _Example:_ If you `rm` a file, you must `ls` to prove it's gone.
   - _Example:_ If you Update a table, you must `SELECT` from it to prove the schema change.

### Protocol B: Skill-First Execution (New for Batch 7+)

**Rule:** No code is written until the relevant Skill is read and pitched.

1. **Select Skill:** Identify the Antigravity Skill from `optimization_skill_map.md`.
2. **Read Full Skill:** Use `view_file` to read the `SKILL.md` artifact.
3. **Mini-Promo:** Log a 1-2 sentence "Hype" summary of the skill's value in `COMPLIANCE_LOG.md`.
4. **Cloud Code Gemini Assistant:** Use this persona to deep-dive into the implementation details.

### Protocol C: The "No-Ghost" Rule

l @langchain/core @langchain/google-genai langchain

````

**Verify:** `grep -r "@langchain" package.json` returns 0 results

### Step 1.3: Unset dead Supabase secrets

```bash
supabase secrets unset ANTHROPIC_API_KEY
supabase secrets unset LOVABLE_API_KEY
````

**Note:** If auth fails, run `supabase login` first.

### Verification Gate ✅

```bash
# ALL must pass before committing:
npm run build                                                    # ✅ Build passes
grep -r "ANTHROPIC\|anthropic\|claude" supabase/functions/ \
  --include="*.ts" -l | grep -v _archive | grep -v node_modules  # ✅ Returns 0 files
grep -r "@langchain" package.json                                 # ✅ Returns nothing
```

### Commit (ONLY if ALL verifications pass)

```bash
git add -A && git commit -m "chore(batch-1): remove all Anthropic/Claude dead code + unused packages

Cleaned 12 active files of Anthropic references, removed 3 unused
LangChain npm packages, unset 2 dead Supabase secrets."
git push
```

### Rollback (if verification fails)

```bash
git checkout .
npm install  # Restore packages
```

---

## BATCH 3: Quick Wins (2h)

### Pre-Flight

```bash
cat ~/.gemini/antigravity/skills/typescript-advanced-types/SKILL.md
cat ~/.gemini/antigravity/skills/postgres-best-practices/SKILL.md
cat ~/.gemini/antigravity/skills/database-design/SKILL.md
```

### Step 3.1: Centralize Deal Stage IDs

1. `grep -rn "appointmentscheduled\|closedwon\|closedlost\|qualifiedtobuy\|contractsent\|decisionmakerboughtin" src/ --include="*.ts" --include="*.tsx" -i` — find all hardcoded stage IDs
2. Create `src/constants/dealStages.ts` with `as const` object
3. Replace all hardcoded values with constant references
4. **Verify:** `npm run build` passes

### Step 3.2: Register cleanup cron

1. Create migration: `supabase/migrations/YYYYMMDDHHMMSS_register_cleanup_cron.sql`
2. Content:

```sql
DO $$
BEGIN
  PERFORM cron.schedule(
    'cleanup-expired-agent-memory',
    '0 3 * * *',
    $$SELECT net.http_post(
      url := 'https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/cleanup-agent-memory',
      headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}'::jsonb
    )$$
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
```

### Step 3.3: Fix deals schema mismatch

1. Read `src/integrations/supabase/types.ts` — find `deals` table columns
2. Read `supabase/functions/_shared/hubspot-manager.ts` — find `mapDealFields()`
3. Compare column names
4. Fix any mismatches in `mapDealFields()`

### Verification Gate ✅

```bash
npm run build                                                     # ✅ Build passes
grep -rn "DEAL_STAGES" src/ --include="*.ts" --include="*.tsx"     # ✅ Shows usage
```

### Commit

```bash
git add -A && git commit -m "feat(batch-3): centralize stage IDs, register cleanup cron, fix deals schema"
git push
```

---

## BATCH 2A: Typed Errors + Constitutional (3-4h)

### Pre-Flight

```bash
cat ~/.gemini/antigravity/skills/error-handling-patterns/SKILL.md
cat ~/.gemini/antigravity/skills/error-handling-patterns/resources/implementation-playbook.md
cat ~/.gemini/antigravity/skills/llm-app-patterns/SKILL.md
cat ~/.gemini/antigravity/skills/agent-orchestration-improve-agent/SKILL.md
```

### Step 2A.1: Add typed error classes to auth-middleware

1. Read `supabase/functions/_shared/auth-middleware.ts`
2. Add `RateLimitError`, `UnauthorizedError`, `ForbiddenError` classes
3. Replace generic `throw new Error(...)` with typed errors
4. Read `supabase/functions/_shared/app-errors.ts` — check if these already exist there (avoid duplication)

### Step 2A.2: Constitutional framing for remaining agents

1. Read `supabase/functions/_shared/unified-prompts.ts` — find `getConstitutionalSystemMessage()`
2. Run: `grep -r "getConstitutionalSystemMessage" supabase/functions/ --include="*.ts" -l | wc -l`
3. Run: `ls supabase/functions/*/index.ts | wc -l` to count total agents
4. For each agent NOT using constitutional framing: PREPEND `getConstitutionalSystemMessage()` to their system prompt
5. **WARNING:** PREPEND, never REPLACE the existing system prompt

### Verification Gate ✅

```bash
npm run build                                                               # ✅ Build passes
grep -r "getConstitutionalSystemMessage" supabase/functions/ \
  --include="*.ts" -l | wc -l                                               # ✅ >= 35
grep -rn "RateLimitError\|UnauthorizedError\|ForbiddenError" \
  supabase/functions/ --include="*.ts" | head -5                             # ✅ Shows usage
```

### Commit

```bash
git add -A && git commit -m "feat(batch-2a): typed errors in auth-middleware + constitutional framing for all agents"
git push
```

---

## BATCH 2B: Token Budget + Memory Retention (6h)

### Pre-Flight

```bash
cat ~/.gemini/antigravity/skills/observability-monitoring-monitor-setup/SKILL.md
cat ~/.gemini/antigravity/skills/llm-app-patterns/SKILL.md
cat ~/.gemini/antigravity/skills/database-design/SKILL.md
```

### Step 2B.1: Wire token budget tracker

1. Read `supabase/functions/_shared/unified-ai-client.ts`
2. After Gemini API call, extract `usageMetadata` from response
3. INSERT into `token_usage_metrics`: `{ agent_name, model, prompt_tokens, completion_tokens, total_tokens }`
4. **CRITICAL:** Fire-and-forget INSERT (NO `await`) — must not slow the hot path
5. Pattern:

```typescript
// After response received:
const usage = response.usageMetadata;
if (usage) {
  supabase
    .from("token_usage_metrics")
    .insert({
      agent_name: agentName,
      model: modelName,
      prompt_tokens: usage.promptTokenCount,
      completion_tokens: usage.candidatesTokenCount,
      total_tokens: usage.totalTokenCount,
    })
    .then(() => {})
    .catch(console.error); // Fire and forget
}
```

### Step 2B.2: Memory retention + namespacing (COMBINED — same file)

1. Read `supabase/functions/_shared/learning-layer.ts`
2. Add `agent_name` parameter to all memory storage functions
3. Add `expires_at` calculation:
   - Short-term: `new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)`
   - Medium-term: 180 days
   - Long-term: 365 days
   - Permanent: `null`
4. Wire `cleanup-agent-memory` edge function to delete `WHERE expires_at < NOW()`

### Verification Gate ✅

```bash
npm run build                                                                # ✅ Build passes
grep -n "token_usage_metrics" supabase/functions/_shared/unified-ai-client.ts # ✅ Shows INSERT
grep -n "expires_at" supabase/functions/_shared/learning-layer.ts             # ✅ Shows TTL logic
grep -n "agent_name" supabase/functions/_shared/learning-layer.ts             # ✅ Shows namespacing
```

### Commit

```bash
git add -A && git commit -m "feat(batch-2b): token budget tracking + memory TTL + agent namespacing"
git push
```

---

## BATCH 2D: HubSpot Consolidation (6-8h)

### Pre-Flight

```bash
cat ~/.gemini/antigravity/skills/hubspot-integration/SKILL.md
cat ~/.gemini/antigravity/skills/code-refactoring-refactor-clean/SKILL.md
```

### Step 2D.1: Verify shared mapDealFields usage

1. `grep -rn "mapDealFields" supabase/functions/ --include="*.ts" -l` — list all files using it
2. Check these 4 files all import the shared version:
   - `sync-single-deal/index.ts`
   - `backfill-deals-history/index.ts`
   - `hubspot-webhook/index.ts`
   - `sync-hubspot-to-supabase/index.ts`
3. If ANY file has inline field mapping → refactor to use `mapDealFields()`

### Step 2D.2: Column name corrections

1. Read `src/integrations/supabase/types.ts` → find `deals` table definition
2. Verify these column names match:
   - `stage` NOT `deal_stage`
   - `owner_id` NOT `hubspot_owner_id`
3. `grep -rn "deal_stage\|hubspot_owner_id\|last_confirmed_at" supabase/functions/ --include="*.ts"` — fix ALL matches

### Verification Gate ✅

```bash
npm run build                                                                           # ✅
grep -rn "deal_stage\|hubspot_owner_id\|last_confirmed_at" supabase/functions/ \
  --include="*.ts"                                                                       # ✅ 0 results
grep -rn "mapDealFields" supabase/functions/ --include="*.ts" -l                         # ✅ 3-4 files
```

### Commit

```bash
git add -A && git commit -m "feat(batch-2d): HubSpot sync consolidation — all functions use shared mapDealFields"
git push
```

---

## BATCH 2C: Tool Adoption + Validation (12-16h) ⚡ BIGGEST

### Pre-Flight

```bash
cat ~/.gemini/antigravity/skills/llm-app-patterns/SKILL.md
cat ~/.gemini/antigravity/skills/agent-orchestration-improve-agent/SKILL.md
cat ~/.gemini/antigravity/skills/backend-dev-guidelines/SKILL.md
cat ~/.gemini/antigravity/skills/dispatching-parallel-agents/SKILL.md
```

### Step 2C.1: Add tool-use to 2 major agents

**Reference implementation:** Read `supabase/functions/ptd-agent-gemini/index.ts` FIRST — this is the pattern to follow.

**Agent 1 — ptd-ultimate-intelligence:**

1. Read `supabase/functions/ptd-ultimate-intelligence/index.ts`
2. Import tools: `import { tools } from "../_shared/tool-definitions.ts"`
3. Pass tools to Gemini API call
4. Add tool-call response loop (check for `functionCall` in response parts)
5. Route calls through `_shared/tool-executor.ts`

**Agent 2 — ai-ceo-master:**

1. Read `supabase/functions/ai-ceo-master/index.ts`
2. Same pattern as above

### Step 2C.2: Output validators for 6 marketing agents (PARALLEL with 2C.1)

1. Create validators:
   - `validateMarketingSignal(obj)` — checks required fields
   - `validateMarketingRecommendation(obj)` — checks structure
   - `validateBudgetProposal(obj)` — checks numeric fields
2. Apply in: `marketing-scout`, `marketing-analyst`, `marketing-predictor`, `marketing-copywriter`, `marketing-loss-analyst`, `marketing-allocator`
3. Change INSERT to UPSERT

### Step 2C.3: Dedup migration (BEFORE unique index)

```sql
-- New migration file
DELETE FROM marketing_agent_signals a USING marketing_agent_signals b
WHERE a.id < b.id AND a.agent_name = b.agent_name AND a.signal_key = b.signal_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_signal
ON marketing_agent_signals(agent_name, signal_key);
```

### Verification Gate ✅

```bash
npm run build                                                               # ✅
grep -n "functionCall\|tool_executor" \
  supabase/functions/ptd-ultimate-intelligence/index.ts                      # ✅ Shows tool loop
grep -n "functionCall\|tool_executor" \
  supabase/functions/ai-ceo-master/index.ts                                  # ✅ Shows tool loop
grep -n "validateMarketing" supabase/functions/marketing-*/index.ts          # ✅ Shows validators
```

### Commit

```bash
git add -A && git commit -m "feat(batch-2c): tool adoption for 2 major agents + output validation for 6 marketing agents"
git push
```

---

## BATCH 5: Frontend Hardening (8-12h)

### Pre-Flight

```bash
cat ~/.gemini/antigravity/skills/react-best-practices/SKILL.md
cat ~/.gemini/antigravity/skills/typescript-advanced-types/SKILL.md
cat ~/.gemini/antigravity/skills/code-refactoring-refactor-clean/SKILL.md
```

### Steps (All parallel — independent files)

|  #   | Task                  | Files                                                           | Verification                                    |
| :--: | :-------------------- | :-------------------------------------------------------------- | :---------------------------------------------- |
| 5.1  | Error boundaries      | `Dashboard.tsx`, `CommandCenter.tsx`, `SetterActivityToday.tsx` | Components wrapped in `<ErrorBoundary>`         |
| 5.2  | Data freshness badges | Key dashboard components                                        | `last_synced_at` displayed                      |
| 5.3  | Delete dead pages     | 6 files (verify with `grep -r` first!)                          | Router has no broken imports                    |
| 5.4  | Fix 97 `as any`       | 37 files                                                        | `grep -rn "as any" src/ \| wc -l` decreases     |
| 5.5  | Remove console.logs   | 3 production files                                              | `grep -rn "console.log" src/ --include="*.tsx"` |
| 5.6  | Code splitting        | All page routes → `React.lazy()`                                | Bundle size < 1MB                               |
| 5.7  | Zod form validation   | Deal creation forms                                             | `npm install zod` + validators                  |
| 5.8  | Fix 88 `select("*")`  | 35 frontend files                                               | `grep -rn 'select("*")' src/ \| wc -l` = 0      |
| 5.9  | Typed Supabase client | Data-fetching hooks                                             | `.returns<Type>()` on queries                   |
| 5.10 | SalesTabs types       | `SalesTabs.tsx` lines 34-43                                     | No `any` props                                  |

**⚠️ Step 5.3 SAFETY CHECK:**
Before deleting ANY page, run:

```bash
grep -r "FishbirdValidation\|IntelligenceDashboard\|SuperDashboard\|UltimateDashboard\|WorkflowStrategy" src/ --include="*.ts" --include="*.tsx" -l
```

Only delete if the page is not imported anywhere except its own file and the router.

### Verification Gate ✅

```bash
npm run build                                                 # ✅ Build passes
npm run build 2>&1 | grep -E "dist/|\.js"                     # ✅ Index chunk < 500KB
grep -rn "as any" src/ --include="*.ts" --include="*.tsx" | wc -l  # ✅ Significantly reduced
grep -rn 'select("*")' src/ --include="*.ts" --include="*.tsx" | wc -l  # ✅ Near 0
```

### Commit

```bash
git add -A && git commit -m "feat(batch-5): frontend hardening — error boundaries, code splitting, type safety, select(*) fix"
git push
```

---

## BATCH 4: Attribution Pipeline (15-25h)

### Pre-Flight

```bash
cat ~/.gemini/antigravity/skills/database-design/SKILL.md
cat ~/.gemini/antigravity/skills/stripe-integration/SKILL.md
cat ~/.gemini/antigravity/skills/postgres-best-practices/SKILL.md
```

### Steps (Sequential — each builds on previous)

| Phase | Task                               | Key Detail                                                                                 |
| :---: | :--------------------------------- | :----------------------------------------------------------------------------------------- |
|  4.1  | Ad attribution columns on contacts | `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attributed_ad_id TEXT` etc.                 |
|  4.2  | Deal ↔ Stripe link                 | JOIN: `deals.contact_email → stripe_customers.email → stripe_charges`                      |
|  4.3  | Call → Ad/Deal links               | Wire `call_records` to `attribution_events` via phone                                      |
|  4.4  | Revenue per Creative view ⭐       | SQL view: `facebook_ads_insights → attribution_events → contacts → deals → stripe_charges` |
|  4.5  | Live currency rates                | Replace hardcoded USD/EUR→AED                                                              |
|  4.6  | Real churn rate                    | No payment in 45+ days = churned                                                           |
|  4.7  | Fix aggregator mocks               | Replace hardcoded "3 creatives" with actual query                                          |
|  4.8  | Deal webhook                       | `hubspot-webhook/index.ts` → `deal.propertyChange` handler                                 |

### Verification Gate ✅

```bash
npm run build                                                                    # ✅
supabase db push                                                                  # ✅ Migrations apply
supabase db execute "SELECT ad_id, ad_name, spend, revenue, roas FROM ad_creative_funnel LIMIT 5"  # ✅ Returns data
```

### Commit

```bash
git add -A && git commit -m "feat(batch-4): attribution pipeline — ad → contact → deal → revenue chain"
git push
```

---

## BATCH 6: Infrastructure + Security (12-16h)

### Pre-Flight

```bash
cat ~/.gemini/antigravity/skills/security-auditor/SKILL.md
cat ~/.gemini/antigravity/skills/production-code-audit/SKILL.md
cat ~/.gemini/antigravity/skills/stripe-integration/SKILL.md
cat ~/.gemini/antigravity/skills/postgres-best-practices/SKILL.md
```

### Steps (Parallel groups)

**Group A — Auth & Security:**

| # | Task | Detail |
|:---:|:---|:---|
| 6.1 | Auth middleware for unprotected EFs | Check `config.toml` for `verify_jwt = false` (exclude webhooks) |
| 6.4 | Stripe webhook signature | Add `stripe.webhooks.constructEvent()` if missing |
| 6.5 | Rotate `cron_secret` | Move to `Deno.env.get("CRON_SECRET")`, `supabase secrets set` |

**Group B — Data Quality:**

| # | Task | Detail |
|:---:|:---|:---|
| 6.3 | RLS audit | Enable on contacts, deals, stripe\__, health_scores |
| 6.6 | 158 `select("_")`backend | Replace with specific columns |
| 6.9 | Primary keys for 10 tables | Dedup first, then add PK |
| 6.10 | Index audit | Query`pg_stat_user_indexes WHERE idx_scan = 0` |

**Group C — Types:**

| # | Task | Detail |
|:---:|:---|:---|
| 6.2 | Migrate raw Gemini → UnifiedAI | 3 functions calling Gemini directly |
| 6.7 | Type `apiClient.ts` | `invoke<any>` → proper types |
| 6.8 | Schema drift fix | Regenerate `types.ts` |

### Verification Gate ✅

```bash
npm run build                                                                         # ✅
supabase functions deploy --all                                                        # ✅
supabase db execute "SELECT tablename, COUNT(*) as policies FROM pg_policies \
  WHERE schemaname='public' GROUP BY tablename ORDER BY policies"                      # ✅ All tables have RLS
grep -rn 'select("*")' supabase/functions/ --include="*.ts" | wc -l                   # ✅ Near 0
grep -rn "generativelanguage.googleapis.com" supabase/functions/ --include="*.ts"      # ✅ 0 (all use UnifiedAI)
```

### Commit

```bash
git add -A && git commit -m "feat(batch-6): infrastructure hardening — auth, RLS, type safety, schema drift, PKs"
git push
```

---

## BATCH 7: ⛔ SKIP

**DO NOT ATTEMPT.** Requires staging environment with production data clone. Mark as "NEEDS MANUAL PLAN" and stop.

---

## POST-COMPLETION CHECKLIST

After ALL batches are done, run:

```bash
# Full verification suite:
npm run build                                                    # ✅ Clean build
grep -r "ANTHROPIC\|anthropic" supabase/functions/ \
  --include="*.ts" | grep -v _archive                             # ✅ 0 results
grep -rn "as any" src/ --include="*.ts" --include="*.tsx" | wc -l # ✅ < 10
grep -rn 'select("*")' . --include="*.ts" | wc -l                # ✅ < 5
grep -rn "console.log" src/ --include="*.tsx" | wc -l             # ✅ 0-3
git log --oneline -10                                             # ✅ All batch commits present
```

### Final Write

Update these files:

1. `docs/plans/autonomous-execution-plan.md` — mark all STATUS TRACKER items `[x]`
2. `progress.md` — add completion summary with scores
3. `CLAUDE.md` — update architecture section if anything changed

---

## SKILL QUICK REFERENCE

When starting a batch, open these skill files:

| Batch | Skills to Read                                                                                                                  |
| :---: | :------------------------------------------------------------------------------------------------------------------------------ |
|   1   | `code-refactoring-refactor-clean`, `codebase-cleanup-deps-audit`                                                                |
|   3   | `typescript-advanced-types`, `postgres-best-practices`, `database-design`                                                       |
|  2A   | `error-handling-patterns` + its `resources/implementation-playbook.md`, `llm-app-patterns`, `agent-orchestration-improve-agent` |
|  2B   | `observability-monitoring-monitor-setup`, `llm-app-patterns`, `database-design`                                                 |
|  2D   | `hubspot-integration`, `code-refactoring-refactor-clean`                                                                        |
|  2C   | `llm-app-patterns`, `agent-orchestration-improve-agent`, `backend-dev-guidelines`, `dispatching-parallel-agents`                |
|   5   | `react-best-practices` + its `rules/*.md`, `typescript-advanced-types`, `code-refactoring-refactor-clean`                       |
|   4   | `database-design` + its `schema-design.md`, `stripe-integration`, `postgres-best-practices`                                     |
|   6   | `security-auditor`, `production-code-audit`, `stripe-integration`, `postgres-best-practices`                                    |

**All skills live at:** `~/.gemini/antigravity/skills/<skill-name>/SKILL.md`
