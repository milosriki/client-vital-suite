# API & Vercel Audit Findings — Feb 22, 2026

> Deep audit of Vercel serverless API routes, frontend API patterns, and runtime errors.

---

## Executive Summary

| Status | Count |
|--------|-------|
| **Deployments** | All READY — no build failures |
| **Critical fixes applied** | 2 (OpenAI→Gemini, CORS headers) |
| **Critical findings (unfixed)** | 1 — Meta CAPI endpoints have no auth |
| **CORS \*** | 20+ routes — documented, not changed (may break cross-origin) |
| **Agent auth** | Conditional on AGENT_API_KEY — if unset, endpoint open |

### Severity Overview

| Severity | Issue | Action |
|----------|-------|--------|
| **CRITICAL** | `/api/events/*`, `/api/webhook/backfill` — no auth, sends to Meta CAPI | Add auth before production |
| **HIGH** | Agent auth optional; meta-cross-validate empty-key bypass | Set env vars in Vercel |
| **MEDIUM** | CORS `*` on 20+ routes | Restrict origins when ready |
| **LOW** | DEP0169 punycode deprecation | Upstream fix |

---

## Fixes Applied (2026-02-22)

### 1. api/brain.ts — OpenAI → Gemini (CRITICAL)

**Before:** Used `OPENAI_API_KEY` + `text-embedding-3-small` (project violates Gemini-only mandate).

**After:** Uses `GEMINI_API_KEY` / `GOOGLE_API_KEY` + `text-embedding-004` with 1536 dimensions via REST API.

**Env vars:** `GEMINI_API_KEY`, `GOOGLE_API_KEY`, or `GOOGLE_GEMINI_API_KEY` (in Vercel secrets).

### 2. api/brain.ts — CORS preflight

**Before:** `Access-Control-Allow-Headers: Content-Type` — preflight failed for `x-ptd-key`.

**After:** Added `x-ptd-key`, `Authorization` to allowed headers.

### 3. BrainVisualizer.tsx — Vector dim label

**Before:** Footer showed "VECTOR_DIM: 768 (GEMINI-004)".

**After:** "VECTOR_DIM: 1536 (GEMINI)" — matches actual embedding size.

---

## Verified OK

| Item | Status |
|------|--------|
| Brain API `recent` action | Exists, returns memories |
| Brain API `stats` | Returns `total_knowledge_chunks` alias |
| BrainVisualizer polling | Uses `action=recent`, handles `chunks`/`memories` |
| BrainVisualizer backoff | Exponential backoff + stop after 10 failures |
| getApiUrl query params | Strips for lookup, preserves in URL |
| Agent auth | Checks AGENT_API_KEY when set |

---

## Remaining Issues (Not Fixed)

### CRITICAL: Meta CAPI endpoints — no auth

**Routes:** `/api/events`, `/api/events/[name]`, `/api/events/batch`, `/api/webhook/backfill`

**Risk:** Any origin can POST conversion events to Meta. Enables: ad fraud, analytics pollution, wasted ad spend.

**Recommendation:** Add auth (e.g. shared secret, `x-ptd-key`, or server-side only) before production.

### CORS `*` on 13+ routes

**Risk:** Any website can call these APIs. Combined with missing auth on some routes, enables cross-site abuse.

**Routes:** brain, agent, query, threads, session, memory, user-memory, hubspot, intelligence, stripe/*, events/*, workspace, truth, system, meta-cross-validate, webhook/backfill.

**Recommendation:** Restrict to `https://client-vital-suite.vercel.app` and `https://*.vercel.app` when ready. Requires Vercel env for allowed origins.

### Agent auth optional

**Risk:** If `AGENT_API_KEY` is not set in Vercel, `/api/agent` accepts unauthenticated requests. Rate limit (30/min) is the only guard.

**Recommendation:** Set `AGENT_API_KEY` in production and document in deployment checklist.

### meta-cross-validate empty-key bypass

**Risk:** If `PTD_INTERNAL_ACCESS_KEY` is empty, `Authorization: Bearer ` (empty token) passes auth.

**Recommendation:** Set `PTD_INTERNAL_ACCESS_KEY` in production. Consider explicit check: `if (!PTD_KEY) return 401`.

### DEP0169 deprecation

**Source:** `@supabase/supabase-js` transitive dependency uses deprecated `punycode` module.

**Impact:** Warning only, no functional error. Fix requires upstream package update.

---

## API Route Inventory (Complete)

| Route | Auth | CORS | Notes |
|-------|------|------|-------|
| /api/brain | PTD_INTERNAL (opt) | * | Fixed: Gemini embeddings |
| /api/agent | AGENT_API_KEY (opt) | * | Rate limit 30/min |
| /api/query | PTD_INTERNAL (opt) | * | |
| /api/threads | PTD_INTERNAL (opt) | * | |
| /api/session | PTD_INTERNAL (opt) | * | |
| /api/memory | PTD_INTERNAL (opt) | * | |
| /api/user-memory | PTD_INTERNAL (opt) | * | |
| /api/workspace | PTD_INTERNAL (opt) | * | |
| /api/truth | PTD_INTERNAL (opt) | * | |
| /api/system | PTD_INTERNAL (opt) | * | Proxies to edge functions |
| /api/system-check | PTD_INTERNAL (opt) | — | |
| /api/health | — | — | No CORS |
| /api/meta-cross-validate | Bearer PTD_KEY | * | Empty-key bypass if unset |
| /api/create-agent-memory-table | PTD_INTERNAL (opt) | — | No CORS, DDL |
| /api/events | **NONE** | * | Proxies to meta-capi |
| /api/events/[name] | **NONE** | * | Sends to Meta CAPI |
| /api/events/batch | **NONE** | * | Sends to Meta CAPI |
| /api/webhook/backfill | **NONE** | * | Sends to Meta CAPI |
| /api/stripe | PTD_INTERNAL (opt) | * | |
| /api/stripe/* | PTD_INTERNAL (opt) | * | account, treasury, payouts, forensics |
| /api/hubspot | PTD_INTERNAL (opt) | * | |
| /api/intelligence | PTD_INTERNAL (opt) | * | |

**Auth pattern:** `PTD_INTERNAL_ACCESS_KEY` — when set, requires `x-ptd-key` or `Authorization`. When unset, allows all.

---

## Directions for Agents (Antigravity, CRAW)

**Purpose:** Read this doc, find gaps, append findings to tracked files for overall history.

### Where to write findings

| Path (in repo) | Purpose |
|----------------|---------|
| `docs/API_VERCEL_AUDIT_APPENDIX.md` | Append new findings from Antigravity/CRAW |
| `docs/API_VERCEL_AUDIT_CHANGELOG.md` | Append-only changelog: `YYYY-MM-DD | agent | finding` |

### Format for history tracking (append-only)

Each new finding in `API_VERCEL_AUDIT_APPENDIX.md`:

```markdown
## [YYYY-MM-DD] Agent: <Antigravity|CRAW|Cursor>

### Finding: <short title>
- **Route:** /api/...
- **Issue:** ...
- **Source:** MEMORY.md from <workspace> | code scan | ...
```

Each entry in `API_VERCEL_AUDIT_CHANGELOG.md`:

```
YYYY-MM-DD | agent | one-line finding
```

### MEMORY.md files to check (not in repo — external)

**CRAW did not check these.** Antigravity and CRAW should read and cross-reference:

| Source | Path | Purpose |
|--------|------|---------|
| OpenClaw main | `~/.openclaw/workspace/MEMORY.md` | CRAW lessons |
| OpenClaw 2 | `~/.openclaw/workspace2/MEMORY.md` | |
| OpenClaw forge | `~/.openclaw/workspace-forge/MEMORY.md` | FORGE lessons |
| OpenClaw riki | `~/.openclaw/workspace-riki/MEMORY.md` | |
| OpenClaw business | `~/.openclaw/workspace-business/MEMORY.md` | |
| OpenClaw marketing | `~/.openclaw/workspace-marketing/MEMORY.md` | |
| Antigravity brain | `~/.gemini/antigravity/brain/{uuid}/task.md` | Per-conversation tasks |
| Antigravity brain | `~/.gemini/antigravity/brain/{uuid}/*.md` | Audits, plans, blueprints |

**Prompt for agents:** Extract any API/auth/CORS issues from the above MEMORY.md and brain/*.md files. Append to `docs/API_VERCEL_AUDIT_APPENDIX.md` and add a line to `docs/API_VERCEL_AUDIT_CHANGELOG.md`.

---

## Related Docs

| Doc | Purpose |
|-----|---------|
| [2026-02-22-DEEP-RESEARCH-PROMPT-ENGINEERING.md](plans/2026-02-22-DEEP-RESEARCH-PROMPT-ENGINEERING.md) | Prompt for timeline extraction (OpenClaw, Antigravity, last 5 days) — different scope from this API audit |
| [REVERSE_ENGINEERING_TIMELINE.md](REVERSE_ENGINEERING_TIMELINE.md) | Timeline output from deep research |
| [DEEP_RESEARCH_API_SERVICES.md](DEEP_RESEARCH_API_SERVICES.md) | Deep Research edge function — live API services & data flow |
| [2026-02-22-UNIVERSAL-RESEARCH-PROMPT.md](plans/2026-02-22-UNIVERSAL-RESEARCH-PROMPT.md) | Non-limit research prompt for all agents (RISE+RISEN+CoT) |

---

## Verification Commands

```bash
npm run build          # Must pass
npx tsc --noEmit      # No type errors
# After deploy: Vercel runtime logs — zero 400s on /api/brain
```
