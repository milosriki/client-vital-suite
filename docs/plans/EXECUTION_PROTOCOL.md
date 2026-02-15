# EXECUTION PROTOCOL: The Perfect Plan

> **STATUS:** DEFINITIVE
> **PROTOCOL:** BULLETPROOF (Skill-Verified)
> **EXECUTOR:** ANTIGRAVITY AGENT

---

## 🛑 MANDATORY RULES

1. **READ FIRST:** Before ANY batch, read the required skill files. Quote them in `COMPLIANCE_LOG.md`.
2. **VERIFY EVERY STEP:** Run `grep` checks after every single file edit.
3. **PASS EVERY GATE:** Run the Verification Command Block. If it fails, STOP.
4. **LOG EVERYTHING:** Update `COMPLIANCE_LOG.md` with proofs.
5. **NO SHORTCUTS:** Follow the exact sequence below.

---

## 🗓️ EXECUTION SEQUENCE

### PHASE 1: Security Foundation (CRITICAL)

**Status:** 🔴 NOT STARTED
**Skills to Read:** `security-auditor`, `database-design`, `backend-dev-guidelines`

**Tasks:**

1. **JWT Verification:**
   - Target: All 126 edge functions in `supabase/functions/`.
   - Action: Add `import { validateRequest } ...` to unprotected functions.
   - Verify: `grep -L 'authorization\|Bearer' supabase/functions/*/index.ts` -> Must be 0.
2. **RLS Policies:**
   - Target: All public tables without policies.
   - Action: Enable RLS, add Service Role + Anon policies.
   - Verify: SQL check for 0 unprotected tables.
3. **Secret Rotation:**
   - Target: Hardcoded `sk-` and `API_KEY` strings.
   - Action: Move to Supabase Secrets.
   - Verify: `grep -r 'sk-\|API_KEY'` -> Must be 0.
4. **AWS Read-Only:**
   - Target: `s3.upload` or write calls.
   - Action: Remove/Block.
   - Verify: `grep` check.

### PHASE 2: Dependency Cleanup (HIGH)

**Status:** 🟡 NOT STARTED
**Skills to Read:** `codebase-cleanup-deps-audit`, `llm-app-patterns`

**Tasks:**

1. **UnifiedAIClient:**
   - Action: Create `_shared/unified-ai-client.ts` (Gemini 2.0 Flash).
   - Detail: Export `generateText`, `generateJSON`, `generateEmbedding`. Implements retry logic.
   - Verify: `deno check` passes.
2. **Remove OpenAI/Anthropic:**
   - Action: Refactor all calls to `UnifiedAIClient`. Uninstall SDKs.
   - Verify: `grep -r 'openai\|anthropic'` -> Must be 0.
3. **Deduplicate Middleware:**
   - Action: Merge 3 `auth-middleware` copies into `_shared/`.
   - Verify: Single source of truth.

### PHASE 3: Code Consolidation (MEDIUM)

**Status:** 🟡 NOT STARTED
**Skills to Read:** `code-refactoring-refactor-clean`, `error-handling-patterns`

**Tasks:**

1. **Deduplicate Functions:**
   - Targets: `send-email`, `process-webhook`, `generate-report`, `validate-input`, `format-response`, `auth-middleware`, `error-handler`.
   - Action: Migrate all to `_shared/`.
   - Verify: `find ... | xargs grep` shows single source.
2. **Standard Error Handling:**
   - Action: Implement `_shared/error-handler.ts`. Standard JSON format: `{ error, code, details }`.
   - Verify: Check random handlers.

### PHASE 4: Hardening (MEDIUM)

**Status:** 🟡 NOT STARTED
**Skills to Read:** `security-auditor`, `backend-dev-guidelines`

**Tasks:**

1. **Rate Limiting:**
   - Action: Implement for public endpoints.
   - Limits: 100 req/min (Auth), 20 req/min (Public).
   - Verify: Load test (curl loop) triggers 429.
2. **Env Var Audit:**
   - Action: Ensure `.env.example` includes ALL required vars.
   - Verify: `cat .env.example` matches usage.

### PHASE 5: Frontend Integration (FINAL)

**Status:** ⚪ NOT STARTED
**Skills to Read:** `react-best-practices`, `production-code-audit`

**Tasks:**

1. **Frontend Connection Check:**
   - Action: Verify API calls match new backend.
   - Verify: `npm run build` passes.
2. **Integration Tests:**
   - Action: Run full suite + manual smoke test (Login, Dashboard, AI).
   - Verify: `npm test` passes.

---

## 📝 COMPLIANCE LOG FORMAT

For **EVERY** Batch, you MUST write this to `docs/plans/COMPLIANCE_LOG.md`:

```markdown
## Phase X: [Name]

### Skills Verified

- [x] Skill Name: "Quote from file"

### Execution Log

- [x] Modified <file>: ✅ Verified with grep

### Verification Gate

- [x] <Command>: ✅ PASSED
```

---

## 🚨 EMERGENCY ROLLBACK

If Verification Gate fails:

1. `git checkout .` (Discard changes)
2. Log failure in `COMPLIANCE_LOG.md`.
3. Stop and ask user.

---

**I WILL FOLLOW THIS EXACTLY.**
**STARTING PHASE 1 NOW.**
