# MEGA CODE AUDIT PROMPT (System-Wide Health Check)

**Objective:** Perform a deep, forensic-level audit of the entire codebase to identify hidden bugs, missing error handling, performance bottlenecks, security risks, and integration failures. This audit must cover every layer: Frontend (React/UI), Backend (API/Edge Functions), Database (Supabase/PostgreSQL), AI Agents (Logic/Memory), and Deployment (Vercel/Environment).

---

## 🛑 AUDIT INSTRUCTIONS FOR AI ASSISTANT

You are an expert Senior Software Architect and Security Auditor. Your task is to scan the provided codebase files against the comprehensive checklist below.

**For every issue found, you must provide:**
1. **File Path:** Exact location of the issue.
2. **Line Number(s):** Where the code is problematic.
3. **Issue Type:** (Critical / Warning / Improvement)
4. **Description:** Why this is a problem.
5. **Fix Code:** The exact code snippet to resolve the issue.

---

## 🔍 SECTION 1: UI & FRONTEND (React, Tailwind, UX)

**Goal:** Ensure a seamless, error-free user experience with robust state management.

- [ ] **Component Error Boundaries:**
  - Are all major feature sections wrapped in an `ErrorBoundary`?
  - Does the UI fail gracefully without crashing the entire app?
- [ ] **Button Click Handlers:**
  - Do ALL click handlers (`onClick`) have `try/catch` blocks?
  - Is there a `toast.error()` or user notification on failure?
  - Are buttons disabled (`disabled={loading}`) during async operations?
- [ ] **Form Validation:**
  - Are all inputs validated before submission?
  - are empty strings (`""`) handled correctly?
- [ ] **Loading States:**
  - Are spinners/skeletons shown during data fetching?
  - Do spinners **stop** if the promise rejects? (Check `finally` blocks).
- [ ] **React Keys:**
  - Do all `.map()` lists have a unique `key` prop? (Avoid using `index` if possible).
- [ ] **Async State Safety:**
  - Are state setters (`setLoading`, `setData`) guarded against unmounted components?
- [ ] **Accessibility:**
  - Do icon-only buttons have `aria-label`?
  - Is keyboard navigation (Tab/Enter) supported?

---

## 🔌 SECTION 2: API & BACKEND (Vercel, Edge Functions)

**Goal:** Ensure reliable, secure, and performant server-side operations.

- [ ] **Error Handling:**
  - Do all API routes return standardized JSON error responses (e.g., `{ error: "message" }`)?
  - Are 4xx and 5xx status codes used correctly?
  - Is `JSON.parse` wrapped in `try/catch` to prevent crashes on invalid payloads?
- [ ] **Headers & CORS:**
  - Are CORS headers (`Access-Control-Allow-Origin`, etc.) correctly configured?
  - **CRITICAL:** Is the `x-ptd-key` (or equivalent auth header) explicitly allowed and forwarded?
- [ ] **Authentication:**
  - Do protected routes verify `Authorization` tokens (JWT) or API keys?
  - Are Supabase Service Role keys **never** exposed to the client?
- [ ] **Rate Limiting:**
  - Is there rate limiting logic (e.g., `rateLimit()` function) on public endpoints?
  - Does the rate limit store reset on cold starts (or use persistent storage)?
- [ ] **Environment Variables:**
  - Are all required env vars checked at the start of execution?
  - Is there a fallback or error if a var is missing or empty string?
- [ ] **Edge Function Limits:**
  - Are large payloads avoided (Deno 128MB limit)?
  - Is `Promise.allSettled` used instead of `Promise.all` for parallel independent tasks?

---

## 🗄️ SECTION 3: DATABASE (Supabase, PostgreSQL)

**Goal:** Maintain data integrity, security, and performance.

- [ ] **Constraints & Types:**
  - Do `CHECK` constraints (e.g., `agent_type IN (...)`) match the code enums?
  - Are `NOT NULL` columns protected against empty strings if intended?
- [ ] **RLS Policies:**
  - Is Row Level Security (RLS) enabled on ALL tables?
  - Are policies correctly defined for `select`, `insert`, `update`, `delete`?
- [ ] **Query Safety:**
  - Are Supabase client calls checking `if (error) throw error`?
  - Is `single()` used only when exactly one row is expected?
- [ ] **Migrations:**
  - Are there any long-running migrations that could lock the DB?
  - Do migration files use safe UUID generation (e.g., `gen_random_uuid()` vs deprecated `uuid_generate_v4()`)?

---

## 🤖 SECTION 4: AI AGENTS & MEMORY

**Goal:** Ensure agents operate logically and memory is persistent.

- [ ] **Error Handling:**
  - Does the agent function handle LLM API failures (rate limits, timeouts)?
  - Is there a retry mechanism with backoff?
- [ ] **Memory System:**
  - Are user queries and agent responses **always** saved to `agent_memory`?
  - Are `agent_type` values consistent with DB constraints?
- [ ] **RAG & Search:**
  - Does `searchMemory` fall back to keyword search if vector search fails?
  - Are embeddings generated successfully before insertion?
- [ ] **Context Management:**
  - Is thread ID properly passed and maintained across turns?
  - Is the context window managed to prevent token limit errors?

---

## 🔒 SECTION 5: SECURITY

**Goal:** Prevent unauthorized access and data leaks.

- [ ] **Sensitive Data:**
  - Are secrets (API keys, connection strings) NEVER logged to console?
  - Are SQL error details truncated/sanitized before sending to client?
- [ ] **Input Validation:**
  - Is all user input sanitized before use in SQL or shell commands?
- [ ] **Auth Flows:**
  - Are `apikey` and `Authorization` headers both checked where required?
- [ ] **Security Headers:**
  - Are CSP (Content Security Policy) and Referrer-Policy headers set?

---

## 🚀 SECTION 6: PERFORMANCE & DEPLOYMENT

**Goal:** Optimize speed and reliability.

- [ ] **Bundle Size:**
  - Are large assets (images/SVGs) lazy-loaded or external?
  - Are unused imports removed?
- [ ] **React Query:**
  - Is `staleTime` configured appropriately (avoid `Infinity` for dynamic data)?
- [ ] **Console Logs:**
  - Are `console.log` statements removed or stripped in production builds?
- [ ] **Deployment Guardrails:**
  - Is there a `/api/system-check` that runs post-deploy?
  - Are required env vars verified before promoting to production?

---

## 📝 AUDIT REPORT TEMPLATE

Please output the audit results in this format:

### 🔴 CRITICAL ISSUES (Must Fix Immediately)
1. **[File Path]**: Issue description...
   - *Fix:* `code snippet`

### 🟡 WARNINGS (Potential Bugs/Edge Cases)
1. **[File Path]**: Issue description...
   - *Fix:* `code snippet`

### 🔵 IMPROVEMENTS (Performance/Best Practices)
1. **[File Path]**: Suggestion...

---

**START AUDIT NOW.**

