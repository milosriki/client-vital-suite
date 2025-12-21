# ✅ AUDIT CHECKLIST

Use this checklist to systematically verify the health and quality of the codebase.

## 1. UI & Frontend (React/Client)

- [ ] **Component Error Boundaries**
  - [ ] Major features wrapped in `<ErrorBoundary>`?
  - [ ] Fallback UI displays cleanly?
  - [ ] Retry button works?

- [ ] **Interaction Safety**
  - [ ] `onClick` handlers wrapped in `try/catch`?
  - [ ] Buttons disabled when `loading` is true?
  - [ ] `toast.error` provides user feedback on failure?
  - [ ] No un-awaited state updates in async functions?

- [ ] **Rendering & State**
  - [ ] Lists have unique `key` props (not just index)?
  - [ ] `useEffect` cleanups implemented (e.g., event listeners)?
  - [ ] No `setState` on unmounted components?
  - [ ] Spinners/Skeletons visible during load?
  - [ ] Spinners **stop** on error/rejection?

- [ ] **Data Formatting**
  - [ ] Dates use locale-aware formatting?
  - [ ] Currency uses `Intl.NumberFormat`?
  - [ ] Text not clipped by `overflow: hidden`?

## 2. API & Network (Backend)

- [ ] **Request Handling**
  - [ ] `fetch` includes `AbortController` signal?
  - [ ] JSON parsing wrapped in `try/catch`?
  - [ ] 404/500 errors handled gracefully?
  - [ ] Non-idempotent requests protected from auto-retry?

- [ ] **Security & Headers**
  - [ ] CORS headers configured correctly?
  - [ ] `x-ptd-key` (or custom auth) forwarded?
  - [ ] Rate limiting enabled (`api/agent.ts`)?
  - [ ] CSP / Security headers present?

## 3. Database (Supabase)

- [ ] **Integrity**
  - [ ] Enum columns (e.g., `agent_type`) match code constants?
  - [ ] `NOT NULL` columns don't accept empty strings?
  - [ ] Foreign keys valid?

- [ ] **Security (RLS)**
  - [ ] RLS enabled on all tables?
  - [ ] Policies cover SELECT, INSERT, UPDATE, DELETE?
  - [ ] Service role used only when necessary?

- [ ] **Realtime**
  - [ ] Subscription channel limit respected?
  - [ ] Auto-reconnect logic handles `CHANNEL_ERROR`?

## 4. Edge Functions (Deno/Node)

- [ ] **Execution**
  - [ ] Environment variables checked at start?
  - [ ] `apikey` AND `Authorization` headers present?
  - [ ] Large payloads avoided (memory limit)?
  - [ ] `Promise.allSettled` used for robustness?

- [ ] **AI & Memory**
  - [ ] LLM API errors caught and handled?
  - [ ] User/Agent messages saved to DB?
  - [ ] RAG search falls back to keywords?
  - [ ] Thread ID persisted correctly?

## 5. Deployment & Ops

- [ ] **Environment**
  - [ ] Production vars not empty/dummy?
  - [ ] Frontend (`VITE_`) vars match backend expectation?
  - [ ] Secrets never logged to console?

- [ ] **Guardrails**
  - [ ] `/api/system-check` returns 200 OK?
  - [ ] Post-deploy smoke test passes?
  - [ ] Alerting (Slack/Email) configured for critical failures?

## 6. Performance

- [ ] **Optimization**
  - [ ] Large assets lazy-loaded?
  - [ ] `console.log` stripped in production?
  - [ ] React Query `staleTime` set appropriately?
  - [ ] Debounce used for frequent inputs/search?

