# EXECUTION WITH SELF-VERIFICATION

> **Based on:** User's Optimization Plan + Antigravity Skills + Bulletproof Protocol
> **Goal:** Autonomous execution with rigorous self-verification at every step.

---

## 🛡️ Pre-Flight Checklist

Complete ALL items below before running any execution commands.

**1. Environment Check**

- [ ] `git status` is clean
- [ ] `npm run build` passes (baseline)
- [ ] Verify access to `~/.gemini/antigravity/skills/`

**2. Skill Availability**

- [ ] `security-auditor` ✅
- [ ] `database-design` ✅
- [ ] `backend-dev-guidelines` ✅
- [ ] `codebase-cleanup-deps-audit` ✅
- [ ] `code-refactoring-refactor-clean` ✅
- [ ] `error-handling-patterns` ✅

---

## 🚀 Phase 1: Security Foundation (Critical)

**Priority:** CRITICAL | **Est. Time:** 2 hours
**Skills:** `security-auditor`, `database-design`

### Task 1.1: JWT Verification (126 Edge Functions)

**Goal:** Add `import { validateRequest } ...` to all unprotected functions.
**Action:**

1. `grep -L 'authorization\|Bearer' supabase/functions/*/index.ts` to find targets.
2. Apply `validateRequest` pattern from `_shared/auth-middleware.ts`.
   **Verification:**

- `grep -L 'authorization\|Bearer' ...` returns 0 files.

### Task 1.2: RLS Policies (All Tables)

**Goal:** 100% RLS coverage.
**Action:**

1. SQL query to find tables without policies.
2. Enable RLS: `ALTER TABLE x ENABLE ROW LEVEL SECURITY`.
3. Create policies (Service Role = ALL, Anon = Select Public).
   **Verification:**

- `SELECT count(*) FROM pg_tables ... WHERE ... NOT IN pg_policies` returns 0.

### Task 1.3: Stripe Table Audit

**Goal:** Verify RLS on `stripe_*` tables.
**Action:** Check `stripe_customers`, `stripe_subscriptions`, etc.
**Verification:** Manual SQL check of policies.

### Task 1.4: AWS Read-Only

**Goal:** Block AWS write operations.
**Action:** `grep -r 'putObject\|deleteObject\|s3.upload'` — remove matches.
**Verification:** grep returns 0.

---

## 🧹 Phase 2: Dependency Cleanup (High)

**Priority:** HIGH | **Est. Time:** 1.5 hours
**Skills:** `codebase-cleanup-deps-audit`, `llm-app-patterns`

### Task 2.1: Build UnifiedAIClient

**Goal:** Single entry point for Gemini 2.0 Flash.
**Action:** Create `supabase/functions/_shared/unified-ai-client.ts`.
**Verification:** `deno check` passes.

### Task 2.2: Migrate OpenAI & Anthropic

**Goal:** Replace SDKs with `UnifiedAIClient`.
**Action:**

1. `grep -r 'openai\|anthropic'` to find usage.
2. Refactor to import `UnifiedAIClient`.
3. Uninstall `openai` and `anthropic` npm packages.
   **Verification:** `grep` returns 0 matches for old SDKs.

### Task 2.3: Remove n8n

**Goal:** Delete dead code.
**Action:** Delete `supabase/functions/n8n-*`.
**Verification:** Directory check.

---

## 🏗️ Phase 3: Code Consolidation (Medium)

**Priority:** MEDIUM | **Est. Time:** 2 hours
**Skills:** `code-refactoring-refactor-clean`, `error-handling-patterns`

### Task 3.1: Deduplicate Functions

**Goal:** Merge duplicates (send-email, process-webhook, etc.).
**Action:** Move to `_shared/` and update imports.
**Verification:** `find ... | xargs grep` shows single source of truth.

### Task 3.2: Standard Error Handling

**Goal:** Uniform error responses.
**Action:** Create `_shared/error-handler.ts`. Wrap all handlers.
**Verification:** Random check of 5 functions shows `try/catch` with shared handler.

---

## 🔒 Phase 4: Hardening (Medium)

**Priority:** MEDIUM | **Est. Time:** 1.5 hours
**Skills:** `security-auditor`

### Task 4.1: Env Var Audit

**Goal:** No hardcoded secrets.
**Action:** `grep -r 'sk-\|API_KEY'`. Move to Supabase Secrets.
**Verification:** grep returns 0.

### Task 4.2: Rate Limiting

**Goal:** Protect public endpoints.
**Action:** Implement `_shared/rate-limiter.ts`. Apply to public functions.
**Verification:** Load test (curl loop) triggers 429.

---

## 🧪 Phase 5: Frontend Integration (Final)

**Priority:** HIGH | **Est. Time:** 2 hours
**Skills:** `react-best-practices`, `production-code-audit`

### Task 5.1: Connection Verification

**Goal:** Ensure frontend talks to updated backend.
**Action:** Audit `apiClient.ts` and fetch calls.
**Verification:** `npm run build` passes.

### Task 5.2: Integration Tests

**Goal:** Verify critical flows.
**Action:** Run existing tests + manual smoke test (Login, Dashboard, AI).
**Verification:** `npm test` passes.

---

## 🔄 Self-Verification Loop (The "Bulletproof" Protocol)

For **EVERY** Phase:

1. **Pre-Flight:** Read Skill + Check git status.
2. **Execute:** Apply changes.
3. **Verify:** Run the specific verification command for that task.
4. **Gate:** If verify fails → ROLLBACK or FIX. Do not proceed.
5. **Commit:** Only after success.
6. **Log:** Update `COMPLIANCE_LOG.md`.

**Ready to start Phase 1?**
