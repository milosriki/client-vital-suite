# Arbiter Report: Supabase + Gemini API Key Setup Design

**Design:** `docs/plans/2026-02-21-supabase-gemini-key-setup-design.md`  
**Date:** 2026-02-21  
**Role:** Integrator / Arbiter Agent

---

## 1. Objection-by-Objection Disposition

### Skeptic (12 objections)

| ID | Severity | Disposition | Rationale |
|----|----------|-------------|-----------|
| **OBJ-001** | High | **ACCEPT** | #42244 is documented by Supabase as expected behavior: `verify_jwt=false` + manual JWKS validation is the documented path. The design currently defers ES256 migration "until Supabase resolves #42244." Supabase will not "fix" this—it is by design. Design must change to treat JWKS validation as the standard path, not a workaround. |
| **OBJ-002** | High | **DEFER** | Edge Functions JWT support reconciliation with current Supabase docs is out of scope for this design. The design correctly cites the constraint. A separate doc-audit task can verify docs alignment. |
| **OBJ-003** | Med | **ACCEPT** | Codebase audit confirms: AIAssistantPanel, PTDControlChat, VoiceChat, FloatingChat all use `/api/agent` (Vercel proxy) → `ptd-agent-gemini` Edge Function. No `import.meta.env.VITE_GEMINI_API_KEY` usage in `src/`. `VITE_GEMINI_API_KEY` is declared in vite-env.d.ts but unused. Design must mark it optional/deprecated or remove from required placement. |
| **OBJ-004** | Med | **REJECT** | Phase C is explicitly conditional ("When Supabase Supports Edge Functions"). Speculative is acceptable for roadmap. |
| **OBJ-005** | Med | **ACCEPT** | JWKS validation is underspecified. Design should add: JWKS URL, caching strategy (TTL), and scope of `verifyJwtFromJWKS()` helper. |
| **OBJ-006** | Med | **ACCEPT** | `GOOGLE_GEMINI_API_KEY` inconsistency: `system-health-check` and `verify-all-keys` reference it; unified-ai-client uses `GEMINI_API_KEY` first. Design must require migration to `GEMINI_API_KEY` for these functions. |
| **OBJ-007** | Low | **REJECT** | system-health-check auth is addressed by SEC-003. |
| **OBJ-008** | Low | **ACCEPT** | Dotenv source: Design says "`.env` / `.env.local`" but scripts should standardize on `.env.local` only. Add explicit note. |
| **OBJ-009–012** | Low | **DEFER** | Minor/speculative; do not block approval. |

### Constraint Guardian (11 items)

| ID | Disposition | Rationale |
|----|-------------|-----------|
| **SEC-003** | **ACCEPT** | system-health-check has `verify_jwt = false` and uses `verifyAuth()` which only checks token format (3 parts), not cryptographic validity. Anyone with a fake `a.b.c` token could call it. Design must require: either (a) IP allowlist for pg_cron + dashboard callers, or (b) real JWT validation (e.g., JWKS or service_role verification) inside the function. Cannot remain as-is. |
| **SEC-001** | **ACCEPT** | Clarify: If `VITE_GEMINI_API_KEY` is unused, document that it is optional and may be removed. Add restriction guidance (referrer/domain) if kept. |
| **SEC-002** | **DEFER** | Leak response procedure is operational; design covers rotation. |
| **SEC-004** | **DEFER** | Fallback deprecation timeline is Phase A; acceptable. |
| **MNT-001** | **ACCEPT** | Migrate system-health-check and verify-all-keys to `GEMINI_API_KEY`. Codebase shows both use `GOOGLE_GEMINI_API_KEY` in metadata; actual Edge Functions use `GEMINI_API_KEY`. Align metadata. |
| **PERF-001, PERF-002** | **ACCEPT** | Add JWKS caching TTL and scope (per-function vs shared) to design. |
| **OP-001, OP-002** | **ACCEPT** | Define rotation downtime expectations and rollout sequence (order of consumers to update). |

### User Advocate (12 concerns)

| ID | Disposition | Rationale |
|----|-------------|-----------|
| **UAC-001** | **ACCEPT** | Add Quick Start section. |
| **UAC-002** | **ACCEPT** | Add "Where do I set X?" table mapping key → location (Supabase Secrets vs Vercel vs .env.local). |
| **UAC-003** | **ACCEPT** | Script-specific error messages (e.g., "For analyze_historical_conversations.mjs, set GEMINI_API_KEY in .env.local"). |
| **UAC-004** | **ACCEPT** | Clarify .env vs .env.local: Use `.env.local` for local dev; `.env` is legacy. Document both for backward compatibility but recommend .env.local. |
| **UAC-005** | **ACCEPT** | Step-by-step "Run scripts" flow. |
| **UAC-006** | **ACCEPT** | "Which key to set?" note for common scenarios. |
| **UAC-007** | **ACCEPT** | Add Supabase Secrets commands (`supabase secrets set GEMINI_API_KEY=...`). |
| **UAC-008–012** | **ACCEPT** | Remaining UX improvements (troubleshooting, verification steps) — batch into "Developer Experience" addendum. |

---

## 2. Decision Log Addendum (Resolved Items)

| # | Decision | Status |
|---|----------|--------|
| D1 | **ES256 migration:** Do not wait for #42244 "fix." Use `verify_jwt=false` + manual JWKS validation as the standard path when migrating. Document JWKS URL, caching, and `verifyJwtFromJWKS()` helper scope. | Resolved |
| D2 | **VITE_GEMINI_API_KEY:** Mark as optional. Frontend routes AI through `/api/agent` → Edge Functions. If no direct Gemini calls exist, document as deprecated/removable. | Resolved |
| D3 | **system-health-check auth:** Must not remain with format-only token check. Require IP allowlist for pg_cron/dashboard, or real JWT validation. | Resolved |
| D4 | **GOOGLE_GEMINI_API_KEY → GEMINI_API_KEY:** Migrate system-health-check and verify-all-keys metadata to `GEMINI_API_KEY`. Update ALL_REQUIRED_SECRETS and REQUIRED_KEYS mappings. | Resolved |
| D5 | **Script dotenv source:** Standardize on `.env.local`; document `.env` as legacy fallback. | Resolved |
| D6 | **Rotation:** Define downtime expectations and consumer update order. | Resolved |
| D7 | **Developer Experience:** Add Quick Start, "Where do I set X?" table, script-specific errors, Supabase Secrets commands. | Resolved |

---

## 3. Disposition

**REVISE** — Design needs changes before approval.

The design is sound in structure and most decisions, but the following revisions are required to meet exit criteria.

---

## 4. Required Revisions for Primary Designer

### 4.1 Mandatory (Must Change)

1. **OBJ-001 / D1 — ES256 migration path**
   - Remove "Defer until Supabase resolves #42244."
   - State: "Use `verify_jwt=false` + manual JWKS validation as the standard path for ES256 migration."
   - Add JWKS section: URL `https://<project>.supabase.co/auth/v1/.well-known/jwks.json`, caching TTL (e.g., 1h), and scope of shared `verifyJwtFromJWKS()` helper.

2. **OBJ-003 / D2 — VITE_GEMINI_API_KEY**
   - Mark `VITE_GEMINI_API_KEY` as **optional** in Placement Matrix.
   - Add note: "Frontend AI flows use `/api/agent` → Edge Functions. If no direct Gemini calls exist, this key may be removed."
   - Remove from required Vercel env list if confirmed unused; or keep as optional with restriction guidance.

3. **SEC-003 / D3 — system-health-check authentication**
   - Require one of: (a) IP allowlist for pg_cron + dashboard callers, or (b) real JWT validation (e.g., verify service_role or anon JWT via JWKS) inside the function.
   - Document that format-only token check is insufficient.

4. **MNT-001 / D4 — GOOGLE_GEMINI_API_KEY migration**
   - Add Phase A task: "Update system-health-check and verify-all-keys to use `GEMINI_API_KEY`."
   - Specify: `ALL_REQUIRED_SECRETS` and `EDGE_FUNCTIONS[].secrets` in system-health-check; `REQUIRED_KEYS` in verify-all-keys.

5. **OBJ-008 / D5 — .env vs .env.local**
   - Add explicit guidance: "Use `.env.local` for local scripts. `.env` is legacy fallback."
   - Update script pattern to prefer `.env.local`.

### 4.2 Recommended (Should Change)

6. **OP-001, OP-002 — Rotation**
   - Add rotation downtime expectations (e.g., "GEMINI_API_KEY: ~5 min; JWT: brief downtime").
   - Add consumer update order (e.g., Supabase Secrets → Vercel → .env.local → scripts).

7. **UAC-001 to UAC-007 — Developer Experience**
   - Add Quick Start section (2–3 steps).
   - Add "Where do I set X?" table.
   - Add script-specific error messages.
   - Add Supabase Secrets commands.

8. **OBJ-005 — JWKS**
   - Specify JWKS caching (TTL, in-memory vs shared) and helper scope.

---

## 5. Summary

| Category | Count |
|----------|-------|
| ACCEPT (design must change) | 18 |
| REJECT (objection overruled) | 3 |
| DEFER (out of scope) | 5 |

**Final disposition:** **REVISE**. The design is approved in principle but requires the mandatory revisions above before final approval. The recommended revisions will improve usability and operational clarity.

---

*End of Arbiter Report.*
