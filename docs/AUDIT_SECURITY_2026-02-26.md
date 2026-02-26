# Security Audit Report — 2026-02-26

**Scope:**
- Repo: `/Users/milosvukovic/client-vital-suite`
- OpenClaw runtime posture (local host)
- Focus: secret exposure risk, auth gaps, policy drift

**Method (verified):**
- `openclaw status --deep`
- `openclaw security audit --deep`
- static repo scan (`rg`, targeted code review)
- config permission and policy review

---

## Executive Summary

- **P0 (Immediate):** 8
- **P1 (High):** 6
- **P2 (Medium):** 4

Top risks are:
1. **OpenClaw control plane is overexposed** (device auth disabled + open DM/group policy + world-readable config).
2. **Secrets hygiene drift** (`.env.stripe` and `.env.stripe-check` are tracked in git, likely containing live/non-placeholder values).
3. **Weak/insufficient auth in critical functions** (JWT structure checks instead of token verification; webhook endpoints without signature verification; fallback secret anti-pattern).
4. **RLS policy drift** (many permissive `USING (true)` / `TO anon` / broad grants in migrations and setup functions).

---

## OpenClaw Runtime Findings (Starting Point)

### Verified from `openclaw status --deep`
- `Security audit: Summary: 15 critical · 8 warn · 2 info`
- `gateway.controlUi.dangerouslyDisableDeviceAuth=true`
- Multiple Telegram accounts with `groupPolicy="open"`
- Multiple Telegram accounts with `dmPolicy="open"`
- `~/.openclaw/openclaw.json` is mode `644` (world-readable)

### P0-1: Device auth disabled on control UI
- **Evidence:** `gateway.controlUi.dangerouslyDisableDeviceAuth=true`
- **Impact:** Unauthorized control-plane access risk if network path is exposed.
- **Fix (immediate):**
  - File: `~/.openclaw/openclaw.json`
  - Set:
    - `gateway.controlUi.dangerouslyDisableDeviceAuth: false`
  - Apply:
    ```bash
    chmod 600 ~/.openclaw/openclaw.json
    openclaw gateway restart
    openclaw status --deep
    ```

### P0-2: Open Telegram DM/group policy on multiple accounts
- **Evidence (config parse):** accounts with `groupPolicy=open` and `dmPolicy=open`: `riki, marketing, business, forensic, default`
- **Impact:** Any external actor can interact with bots; expands attack surface for tool misuse/social prompt injection.
- **Fix (immediate):**
  - File: `~/.openclaw/openclaw.json`
  - For each exposed account under `channels.telegram.accounts.<account>`:
    - `groupPolicy: "allowlist"`
    - `dmPolicy: "allowlist"` (or explicit pairing flow)
    - add strict `allowFrom` / group allowlists
  - Restart/verify:
    ```bash
    openclaw gateway restart
    openclaw status --deep
    openclaw security audit --deep
    ```

### P0-3: OpenClaw config file permission too broad
- **Evidence:** `~/.openclaw/openclaw.json mode=644`
- **Impact:** Local users/processes can read tokens/settings.
- **Fix:**
  ```bash
  chmod 600 ~/.openclaw/openclaw.json
  ls -l ~/.openclaw/openclaw.json
  ```

---

## Repo Findings — Secret Exposure

### P0-4: Tracked env files in git history
- **Evidence:**
  - `git ls-files | rg '\.env'` =>
    - `.env.example`
    - `.env.stripe`
    - `.env.stripe-check`
    - `backend/.env.example`
- `.gitignore` correctly blocks `.env*`, but already-tracked files bypass ignore.
- Additional check shows `.env.stripe` / `.env.stripe-check` contain non-placeholder values.
- **Impact:** Potential secret leakage in current tree and git history.

#### Immediate remediation
```bash
cd /Users/milosvukovic/client-vital-suite

# stop tracking sensitive env files
git rm --cached .env.stripe .env.stripe-check

# ensure only sanitized examples remain
git add .env.example backend/.env.example .gitignore

git commit -m "security: untrack sensitive env files"
```

#### Mandatory key rotation (if ever exposed)
- Rotate all keys found in these env files (Stripe, Supabase service role, HubSpot, Meta, OpenAI, Telegram, etc.) in their providers.
- Re-seed secrets in secret stores only:
  - Supabase: `supabase secrets set ...`
  - Vercel: `vercel env add ...`
  - OpenClaw config/secret store as applicable.

#### Optional deep history cleanup (if repo published/shared)
```bash
# Use git-filter-repo if history rewrite is acceptable
pip3 install git-filter-repo
cd /Users/milosvukovic/client-vital-suite
git filter-repo --path .env.stripe --path .env.stripe-check --invert-paths
# force-push required after coordination
```

---

## Repo Findings — Auth Gaps

### P0-5: Auth middleware only validates JWT shape, not signature/claims
- **File:** `supabase/functions/_shared/auth-middleware.ts`
- **Evidence:** token accepted if `token.split('.').length === 3`
- **Impact:** Forged unsigned JWT-like strings can pass middleware checks.
- **Fix:** Replace with real verification via Supabase Auth (e.g., `auth.getUser(token)`) and enforce issuer/audience/expiry.

### P0-6: `master-sync` allows service-role key fallback as cron secret
- **File:** `supabase/functions/master-sync/index.ts`
- **Evidence:**
  - `const CRON_SECRET = Deno.env.get("MASTER_SYNC_CRON_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;`
- **Impact:** If service role key leaks, cron auth boundary collapses.
- **Fix:**
  - Require dedicated random cron secret only.
  - Remove fallback entirely.
  - Reject startup if `MASTER_SYNC_CRON_SECRET` missing.

### P1-1: Webhook endpoint without signature verification (CallGear)
- **File:** `supabase/functions/callgear-webhook/index.ts`
- **Evidence:** TODO for HMAC verification; currently accepts payload without signature.
- **Impact:** Anyone can spoof webhook events and pollute operational data.
- **Fix:**
  - Implement provider signature verification (HMAC SHA-256 with shared secret).
  - Reject unsigned/invalid signatures with `401`.

### P1-2: Backend API endpoints have no authn/authz gate
- **File:** `backend/server.js`
- **Evidence:** `/api/events/:name`, `/api/events/batch`, `/api/webhook/backfill` are callable without auth token/signature; only rate limit present.
- **Impact:** Unauthorized event injection to Meta CAPI, data poisoning, cost abuse.
- **Fix options:**
  - Require HMAC signature header (preferred for webhooks), or
  - Require API key/JWT on all write endpoints.

---

## Repo Findings — RLS / Policy Drift

### P0-7: Extensive permissive RLS patterns (`USING (true)`, `TO anon`, broad grants)
- **Evidence examples:**
  - `supabase/migrations/20251019105826_094e0602-c1bc-4090-99fd-9ee850fad389.sql`
  - `supabase/migrations/20251220230948_fix_critical_missing_tables.sql`
  - `supabase/migrations/20260218180000_aws_ops_tables.sql`
  - `supabase/migrations/20260225000001_coach_crosscheck_views.sql`
  - multiple setup functions creating `anon_read_*` policies
- **Impact:** Potential unauthorized reads across sensitive operational tables.
- **Fix (staged):**
  1. Inventory all policies granting anon/public broad read.
  2. Restrict to `authenticated` or role-scoped access (`is_admin()`, tenant/user ownership checks).
  3. Remove unnecessary `GRANT SELECT ... TO anon` on sensitive views/functions.

#### Useful commands
```bash
cd /Users/milosvukovic/client-vital-suite

# policy drift inventory
rg -n "TO anon|USING \(true\)|GRANT SELECT .* TO anon|FOR ALL USING \(true\)" supabase/migrations supabase/functions

# generate migration to tighten policies
supabase migration new harden_rls_20260226
```

### P1-3: Policy setup logic embedded in runtime functions
- **Files:** e.g. `supabase/functions/setup-coach-intelligence/index.ts`, `supabase/functions/fix-all-dashboard-rls/index.ts`, `supabase/functions/tinymdm-setup-tables/index.ts`
- **Risk:** Drift and accidental re-introduction of permissive policies outside audited migrations.
- **Fix:** Move all DDL/policy changes to migrations only; lock down runtime functions to data operations.

---

## Additional Findings

### P1-4: CORS is broadly enabled in backend proxy
- **File:** `backend/server.js`
- **Evidence:** `app.use(cors())` default allow-all.
- **Fix:** restrict origins to known production/admin domains.

### P2-1: Archive code still contains privileged patterns
- **Path:** `supabase/functions/_archive/**`
- **Risk:** accidental deployment/reuse of stale insecure code.
- **Fix:** hard-exclude from deployment, or move outside `supabase/functions` tree.

### P2-2: Rate limiting is in-memory/per-isolate only
- **File:** `supabase/functions/_shared/auth-middleware.ts`
- **Risk:** ineffective under horizontal scaling/restarts.
- **Fix:** centralize in Redis/KV or upstream gateway limits.

### P2-3: Logging may include sensitive payload fields
- **Files:** webhook and backend handlers logging request bodies/results.
- **Fix:** structured redaction (`email`, `phone`, tokens, IDs) before logging.

### P2-4: Security checks should be CI-enforced
- **Fix:** add CI gates for secret scan + RLS drift scan + OpenClaw config lint.

---

## Prioritized Remediation Plan

## P0 — Do now (today)
1. Lock OpenClaw config and close exposed chat policies.
2. Disable `dangerouslyDisableDeviceAuth` and restart gateway.
3. Remove tracked env secret files (`.env.stripe`, `.env.stripe-check`) and rotate keys.
4. Replace weak JWT-shape auth check with real token verification.
5. Remove `master-sync` cron-secret fallback to service-role key.
6. Start RLS hardening for anon/public read on sensitive tables.

## P1 — Next 24–72h
1. Add webhook signature verification to CallGear and other inbound webhooks.
2. Add authn/authz on backend `/api/*` write endpoints.
3. Restrict CORS to allowlist.
4. Remove runtime DDL/policy mutation functions; migration-only governance.

## P2 — This week
1. Remove/archive stale function trees from deploy path.
2. Move rate limiting to shared store.
3. Add log redaction policy.
4. Add CI security gates and fail builds on drift.

---

## Verification Checklist (post-fix)

```bash
# OpenClaw posture
openclaw status --deep
openclaw security audit --deep

# repo hygiene
git ls-files | rg '\.env'           # should only show safe examples
rg -n "token\.split\('\.'\)\.length === 3" supabase/functions
rg -n "MASTER_SYNC_CRON_SECRET\) \|\| Deno\.env\.get\(\"SUPABASE_SERVICE_ROLE_KEY\"\)" supabase/functions

# policy drift quick check
rg -n "TO anon|USING \(true\)|GRANT SELECT .* TO anon" supabase/migrations supabase/functions
```

---

## Risk Status
- Current posture: **High risk** until P0 items are completed.
- Most urgent blast-radius reducers: OpenClaw policy lockdown + key rotation + auth hardening + RLS tightening.
