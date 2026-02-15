# EXECUTION MASTER PLAN: The Definitive Guide

> **STATUS:** FINAL & APPROVED
> **PROTOCOL:** BULLETPROOF (Skill-Verified)
> **EXECUTOR:** ANTIGRAVITY AGENT

---

## 🛑 NON-NEGOTIABLE PROTOCOL

1. **Pre-Flight:** Read & quote required skills in `COMPLIANCE_LOG.md`.
2. **Execute:** Modify code -> `grep` verify each file immediately.
3. **Gate:** Run the Verification Command Block. **Pass or STOP.**
4. **Log:** Document every step in `COMPLIANCE_LOG.md`.

---

## 🗓️ EXECUTION PHASE SEQUENCE

### PHASE 1: Security Foundation (CRITICAL)

**Goal:** Lock down the application.
**Skills:** `security-auditor`, `database-design`

1. **JWT Verification (126 Functions)**
   - **Target:** All `supabase/functions/*/index.ts`.
   - **Action:** Add `import { validateRequest } ...` to top of handler.
   - **Verify:** `grep -L 'authorization\|Bearer' ...` -> **0 files**.

2. **RLS Policies (100% Coverage)**
   - **Target:** All public tables (including `stripe_*`).
   - **Action:** Enable RLS -> Add Policy (Service=ALL, Anon=Public/Auth).
   - **Verify:** SQL check for unprotected tables -> **0 tables**.

3. **Secret Rotation**
   - **Target:** Hardcoded `sk-` keys.
   - **Action:** Move to Supabase Secrets / `.env`.
   - **Verify:** `grep -r 'sk-\|API_KEY'` -> **0 matches**.

---

### PHASE 2: Dependency Cleanup (HIGH)

**Goal:** Remove technical debt & vendor lock-in.
**Skills:** `codebase-cleanup-deps-audit`, `llm-app-patterns`

1. **UnifiedAIClient (Gemini Only)**
   - **Action:** Create `_shared/unified-ai-client.ts` (Gemini 2.0 Flash).
   - **Export:** `generateText`, `generateJSON`, `generateEmbedding`.
   - **Verify:** `deno check` passes.

2. **Remove OpenAI/Anthropic**
   - **Target:** All functions using old SDKs.
   - **Action:** Refactor to `UnifiedAIClient` -> Uninstall SDKs.
   - **Verify:** `grep -r 'openai\|anthropic'` -> **0 matches**.

---

### PHASE 3: Code Consolidation (MEDIUM)

**Goal:** DRY (Don't Repeat Yourself).
**Skills:** `code-refactoring-refactor-clean`

1. **Deduplicate Functions**
   - **Targets:** `send-email`, `process-webhook`, `generate-report`, `validate-input`, `auth-middleware`.
   - **Action:** Merge to `_shared/` -> Update imports.
   - **Verify:** Single source of truth.

---

### PHASE 4: Hardening (MEDIUM)

**Goal:** Production robustness.
**Skills:** `backend-dev-guidelines`

1. **Rate Limiting**
   - **Action:** Implement `_shared/rate-limiter.ts`.
   - **Limits:** **100** req/min (Auth), **20** req/min (Public).
   - **Verify:** Load test triggers 429.

---

### PHASE 5: Frontend Integration (FINAL)

**Goal:** Ensure everything works for the user.
**Skills:** `react-best-practices`

1. **Integration Test**
   - **Action:** Run full suite + smoke test major flows.
   - **Verify:** `npm test` passes + Build passes.

---

## 📝 PROOF OF WORK: `COMPLIANCE_LOG.md`

Every batch MUST look like this:

```markdown
## Phase X: [Name]

### Skills Verified

- [x] `skill-name`: "Quote from file"

### Execution Log

- [x] Modified <file>: ✅ Verified with grep

### Verification Gate

- [x] <Command>: ✅ PASSED
```

---

**I AM READY TO EXECUTE PHASE 1.**
