# Supabase + Gemini API Key Setup — 2026 Design

**Project:** client-vital-suite (PTD Fitness SaaS)  
**Project ID:** ztjndilxurtsfqdsvfds  
**Date:** 2026-02-21  
**Role:** Primary Designer (multi-agent design review)

---

## Executive Summary

This design proposes the recommended Supabase and Gemini API key setup for 2026, covering key types, placement, JWT signing migration, security practices, and Edge Function implications. The project currently uses legacy `anon`/`service_role` JWT keys and `GEMINI_API_KEY` across 143 Edge Functions, Vercel API routes, and local scripts.

---

## 1. Key Types — Decision Log

### 1.1 Supabase API Keys

| Decision | Alternatives | Rationale |
|----------|--------------|-----------|
| **Use legacy `anon` and `service_role` JWT keys for now** | Migrate to `sb_publishable_` / `sb_secret_` | Edge Functions **only** support JWT verification via `anon` and `service_role`. With publishable/secret keys, Supabase requires `--no-verify-jwt` and custom `apikey`-header logic inside every function. Given 143 functions (120+ with `verify_jwt = true`), migration would require significant refactoring. Stay on legacy keys until Supabase adds native support for publishable/secret keys in Edge Functions. |
| **Plan migration to `sb_publishable_` / `sb_secret_` for 2026 H2** | Stay on legacy indefinitely | Supabase recommends publishable/secret keys for rotation, security, and compliance. Once Supabase supports them for Edge Functions (or provides a migration path), adopt them. |
| **Use `VITE_SUPABASE_ANON_KEY` for frontend** | `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env.example` already documents both; they are equivalent for client use. Keep `VITE_SUPABASE_ANON_KEY` for consistency with existing code. |

### 1.2 Gemini API Keys

| Decision | Alternatives | Rationale |
|----------|--------------|-----------|
| **Canonical name: `GEMINI_API_KEY`** | `GOOGLE_API_KEY`, `GOOGLE_GEMINI_API_KEY` | Codebase uses `GEMINI_API_KEY` as primary; `GOOGLE_API_KEY` and `GOOGLE_GEMINI_API_KEY` as fallbacks. Standardize on `GEMINI_API_KEY` for new code. |
| **Frontend: `VITE_GEMINI_API_KEY`** | Server-only Gemini | Frontend may call Gemini directly (e.g., AIAssistantPanel). Use `VITE_` prefix for client-exposed key. Google API keys for Generative Language are safe for client use when restricted by referrer/domain. |

---

## 2. Where Each Key Lives

### 2.1 Placement Matrix

| Key | Location | How Set | Consumers |
|-----|----------|---------|-----------|
| `VITE_SUPABASE_URL` | `.env.local`, Vercel | Vercel Env Vars (all envs) | Frontend (Vite) |
| `VITE_SUPABASE_ANON_KEY` | `.env.local`, Vercel | Vercel Env Vars | Frontend, `supabase.functions.invoke()` |
| `VITE_GEMINI_API_KEY` | `.env.local`, Vercel | Vercel Env Vars | Frontend (if direct Gemini calls) |
| `SUPABASE_URL` | `.env.local`, Vercel | Vercel Env Vars | Vercel API routes, scripts |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local`, Vercel, Supabase | Vercel Env Vars; Supabase Secrets | Vercel API routes, Edge Functions, scripts |
| `GEMINI_API_KEY` | Supabase Secrets, `.env.local` | `supabase secrets set`; `.env.local` for scripts | Edge Functions (40+), scripts |

### 2.2 Detailed Placement

**Supabase Secrets (Edge Functions only):**
```
SUPABASE_URL                    # Injected by platform; optional override
SUPABASE_SERVICE_ROLE_KEY       # Required for service_role DB access
GEMINI_API_KEY                  # Primary AI (canonical)
```
*Note:* `GOOGLE_API_KEY` and `GOOGLE_GEMINI_API_KEY` remain as fallbacks; consolidate to `GEMINI_API_KEY` over time.

**Vercel Environment Variables:**
- **Production / Preview / Development:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`
- **Server-only (no VITE_):** `SUPABASE_SERVICE_ROLE_KEY` for `/api/*` routes

**`.env.local` (gitignored, developer machines):**
- All of the above for local dev
- Plus: `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` for scripts

**Never:**
- Commit `.env` or `.env.local` to git
- Put `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` in frontend bundle (no `VITE_` prefix for these)

---

## 3. JWT Signing: ECC P-256 vs Legacy HS256

### 3.1 Current State

- Project uses **Legacy JWT secret** (HS256) for `anon` and `service_role` keys
- All user session JWTs are signed with the same secret
- Edge Functions with `verify_jwt = true` validate JWTs at the gateway

### 3.2 Migration Path: HS256 → ES256 (ECC P-256)

| Step | Action | Downtime |
|------|--------|----------|
| 1 | Create new standby key (ES256) in Dashboard: Project Settings → JWT | None |
| 2 | Ensure all JWT verification uses `supabase.auth.getClaims()` or JWKS endpoint | None |
| 3 | Rotate keys (standby → current) | None; both keys accepted |
| 4 | Wait for old JWTs to expire (default ~1h for access tokens) | None |
| 5 | Revoke previously used key | None |
| 6 | *(Optional)* Disable `anon`/`service_role` after migrating to publishable/secret keys | Requires publishable/secret migration first |

### 3.3 Edge Functions and verify_jwt

**Critical constraint:** Supabase docs state:

> Edge Functions only support JWT verification via the `anon` and `service_role` JWT-based API keys. You will need to use the `--no-verify-jwt` option when using publishable and secret keys.

**Implication for HS256 → ES256 migration:**
- If you rotate to ES256 signing keys, **user session JWTs** will be signed with ES256
- The gateway's JWT verification must support ES256 (Supabase platform handles this via JWKS)
- **Known issue (Jan 2026):** [supabase/supabase#42244](https://github.com/supabase/supabase/issues/42244) — Edge Functions can return 401 for valid ES256 JWTs after rotating from HS256
- **Workaround:** Deploy affected functions with `--no-verify-jwt` and validate JWT manually inside the function using the JWKS endpoint: `https://ztjndilxurtsfqdsvfds.supabase.co/auth/v1/.well-known/jwks.json`

### 3.4 Recommendation

| Decision | Rationale |
|----------|-----------|
| **Defer ES256 migration until Supabase resolves #42244** | Avoid 401 errors on 120+ Edge Functions. Monitor the issue for a fix. |
| **If migration is required (compliance):** | Use `verify_jwt = false` + manual JWT validation via JWKS for affected functions. Implement a shared `verifyJwtFromJWKS()` helper in `_shared/`. |
| **Do not revoke legacy JWT secret** until all clients use publishable/secret keys | Per Supabase docs, revoking requires disabling anon/service_role first. |

---

## 4. Security: Rotation and Script Handling

### 4.1 Rotation Strategy

| Key Type | Rotation Frequency | Procedure |
|----------|-------------------|------------|
| `GEMINI_API_KEY` | Annually or on suspected leak | Create new key in Google AI Studio → update Supabase secrets + Vercel + `.env.local` → delete old key |
| `SUPABASE_SERVICE_ROLE_KEY` (JWT) | Only if JWT secret compromised | Rotate JWT secret in Dashboard → update all consumers → causes brief downtime |
| `sb_secret_` (future) | Per-component, on leak | Create new secret key in Dashboard → replace in single consumer → delete old key (zero downtime) |

### 4.2 Scripts: `analyze_historical_conversations.mjs` and `test_lisa.mjs`

| Script | Required Secrets | Source | Recommendation |
|--------|------------------|--------|-----------------|
| `analyze_historical_conversations.mjs` | `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` | `process.env` from `.env` / `.env.local` | Use `dotenv/config` (already present). Document in README: "Copy `.env.example` to `.env.local`, add keys. Never commit." |
| `test_lisa.mjs` | `GEMINI_API_KEY` | `process.env` from `.env` / `.env.local` | Same. No Supabase key needed (standalone Gemini test). |

**Secure script pattern:**
```javascript
import 'dotenv/config';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY. Set in .env.local");
  process.exit(1);
}
```

**Add to `.env.example`:**
```
# Local scripts (analyze_historical_conversations.mjs, test_lisa.mjs)
# Copy to .env.local and fill. NEVER commit .env.local.
SUPABASE_URL=https://ztjndilxurtsfqdsvfds.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=AIza...
```

### 4.3 Secret Handling Rules

1. **Never** log full keys; at most log first 4–6 chars for debugging
2. **Never** pass keys in URL query params (often logged)
3. **Prefer** SHA256 hash if you need to log "which key was used"
4. **Scripts:** Load from `.env.local` via `dotenv/config`; fail fast if missing

---

## 5. Edge Functions: verify_jwt Implications

### 5.1 Current Configuration

| verify_jwt | Count | Functions |
|------------|-------|-----------|
| `true` | ~120+ | All agent, sync, and user-invoked functions |
| `false` | 9 | anytrack-webhook, hubspot-anytrack-webhook, calendly-webhook, stripe-webhook, hubspot-webhook, hubspot-webhook-receiver, system-health-check, dialogflow-fulfillment, antigravity-followup-engine |

### 5.2 verify_jwt = true (Default)

- **Behavior:** Supabase gateway validates `Authorization: Bearer <JWT>` before invoking the function
- **Valid JWTs:** `anon` key, `service_role` key, or user session JWT (from Supabase Auth)
- **Invocation:** `supabase.functions.invoke()` sends session JWT automatically when user is logged in; otherwise anon key
- **No change needed** as long as you stay on legacy `anon`/`service_role` keys

### 5.3 verify_jwt = false

- **Behavior:** Gateway does not validate JWT; function receives raw request
- **Use case:** Webhooks (Stripe, HubSpot, Calendly, etc.), cron targets, external callers that cannot send Supabase JWTs
- **Security:** These functions **must** validate callers by other means (e.g., Stripe signature, HubSpot signature, shared secret, or IP allowlist)

### 5.4 If Migrating to sb_publishable_ / sb_secret_

Per Supabase docs:
- Edge Functions do **not** verify `apikey` header when using publishable/secret keys
- You must use `--no-verify-jwt` (i.e., `verify_jwt = false` in config) and implement custom auth inside each function
- **Impact:** All 120+ functions would need an auth layer that checks `apikey` header against an allowlist or validates a short-lived JWT minted by the API Gateway

**Recommendation:** Do not migrate to publishable/secret keys until Supabase adds native Edge Function support. The refactor cost is prohibitive.

---

## 6. Migration Steps (Legacy → New Keys)

### Phase A: No Breaking Changes (Immediate)

1. **Consolidate Gemini env names:** Prefer `GEMINI_API_KEY` everywhere; keep `GOOGLE_API_KEY` as fallback only where needed
2. **Document script secrets:** Update `.env.example` with script-specific vars; add `scripts/README.md` or section in main README
3. **Audit Vercel env:** Ensure `SUPABASE_SERVICE_ROLE_KEY` is not exposed to client (no `VITE_` prefix)

### Phase B: JWT Signing (When Supabase Fixes #42244)

1. Create ES256 standby key in Dashboard
2. Rotate to ES256
3. Monitor Edge Function 401s; if any, apply `verify_jwt = false` + JWKS validation for those functions
4. Revoke old key after expiry window

### Phase C: Publishable/Secret Keys (When Supabase Supports Edge Functions)

1. Create `sb_publishable_` and `sb_secret_` keys in Dashboard
2. Update frontend: `VITE_SUPABASE_ANON_KEY` → `VITE_SUPABASE_PUBLISHABLE_KEY` (or new var)
3. Update Vercel API routes: `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY` (new var)
4. For Edge Functions: wait for native support, or implement custom `apikey` validation
5. Disable `anon` and `service_role` in Dashboard after all clients migrated

---

## 7. Summary Table

| Component | Key | Location | Notes |
|-----------|-----|----------|-------|
| Frontend | `VITE_SUPABASE_ANON_KEY` | Vercel, .env.local | Legacy anon; safe for client |
| Frontend | `VITE_GEMINI_API_KEY` | Vercel, .env.local | Restrict by domain in Google Cloud |
| Vercel API | `SUPABASE_SERVICE_ROLE_KEY` | Vercel Env | Server-only |
| Edge Functions | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Secrets | Injected by platform |
| Edge Functions | `GEMINI_API_KEY` | Supabase Secrets | Canonical name |
| Scripts | `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` | .env.local | Via dotenv/config |

---

## 8. Open Questions for Reviewers

1. **VITE_GEMINI_API_KEY:** Is the frontend still making direct Gemini calls, or is all AI routed through Edge Functions? If the latter, `VITE_GEMINI_API_KEY` may be removable.
2. **system-health-check:** Uses `verify_jwt = false`; how does it authenticate? If unauthenticated, consider IP allowlist or internal-only invocation.
3. **GOOGLE_GEMINI_API_KEY vs GEMINI_API_KEY:** `system-health-check` and `verify-all-keys` reference `GOOGLE_GEMINI_API_KEY`. Should we standardize to `GEMINI_API_KEY` and update those references?

---

*End of design document. Awaiting reviewer feedback.*
