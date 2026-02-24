# AUTONOMOUS EXECUTION PLAN — Client Vital Suite
## Date: 2026-02-24 | Orchestrator: CRAW (Opus) | Agents: Claude Code + Codex
## Status: READY TO LAUNCH

---

## MISSION
Execute the 8-phase FINAL PLAN autonomously while Milos is at work.
Each phase runs as an independent coding agent in a tmux session with Ralph retry loops.
CRAW (this session) orchestrates, monitors, and handles cross-phase dependencies.

---

## ARCHITECTURE

```
CRAW (Opus) — Master Orchestrator
  ├── Phase 0: STABILIZE    → tmux: cvs-phase0  (Codex, ~30min)
  ├── Phase 1: SECURITY     → tmux: cvs-phase1  (Claude Code, ~2h)
  ├── Phase 2: ATTRIBUTION  → tmux: cvs-phase2  (Claude Code, ~3h) [after Phase 0+1]
  ├── Phase 3: REVENUE      → tmux: cvs-phase3  (Claude Code, ~2h) [after Phase 2]
  ├── Phase 4: GPS          → tmux: cvs-phase4  (Codex, ~2h)      [after Phase 1]
  ├── Phase 5: HUBSPOT      → tmux: cvs-phase5  (Claude Code, ~2h) [after Phase 2]
  ├── Phase 6: AI/RAG       → tmux: cvs-phase6  (Claude Code, ~3h) [after Phase 2+5]
  ├── Phase 7: DASHBOARD    → tmux: cvs-phase7  (Claude Code, ~2h) [after Phase 2+3]
  └── Phase 8: AUTOMATION   → tmux: cvs-phase8  (Claude Code, ~3h) [after Phase 6+7]
```

### Dependency Graph (Parallel Where Possible)
```
Phase 0 ──┬── Phase 1 ──┬── Phase 2 ──┬── Phase 3 ──── Phase 7 ─── Phase 8
           │              │              └── Phase 5 ──── Phase 6 ──┘
           │              └── Phase 4
           └── (types.ts regen needed by all)
```

### Wave Execution
- **Wave 1** (immediate): Phase 0 (deploy/stabilize)
- **Wave 2** (after Phase 0): Phase 1 (security) + Phase 4 (GPS — independent)
- **Wave 3** (after Phase 1): Phase 2 (attribution)
- **Wave 4** (after Phase 2): Phase 3 (revenue) + Phase 5 (HubSpot) — parallel
- **Wave 5** (after Phase 5): Phase 6 (AI/RAG)
- **Wave 6** (after Phase 3+6): Phase 7 (dashboard) + Phase 8 (automation)

---

## PHASE PRDs (Agent Instructions)

### PHASE 0 — STABILIZE (cvs-phase0)
```
You are working on the Client Vital Suite at /Users/milosvukovic/client-vital-suite/

MISSION: Deploy all pending code to production. Zero local-only artifacts.

CONTEXT:
- Supabase project: ztjndilxurtsfqdsvfds
- Vercel team: milos-projects-d46729ec
- 10 local-only migrations need pushing
- 7 remote-only migrations need pulling
- 192 local edge functions, 198 deployed
- Build currently passes (verified)

TASKS:
- [ ] Run `supabase migration list --linked` and document exact drift
- [ ] Pull 7 remote-only migrations: `supabase migration pull --linked` (or manually create matching files)
- [ ] Review all 10 local-only migrations for safety (read each SQL file)
- [ ] Push migrations: `supabase db push --linked` (if safe) or deploy individually
- [ ] If migration collision on 20260213000005: inspect BOTH versions, resolve conflict
- [ ] Deploy all edge functions: `supabase functions deploy --project-ref ztjndilxurtsfqdsvfds`
- [ ] Regenerate types: `npx supabase gen types typescript --project-id ztjndilxurtsfqdsvfds > src/integrations/supabase/types.ts`
- [ ] Verify build: `npm run build` must pass
- [ ] Verify typecheck: `npx tsc --noEmit` must pass
- [ ] Deploy frontend: `npx vercel deploy --prod --yes --scope milos-projects-d46729ec`
- [ ] Commit any changes: `git add . && git commit -m "chore: phase 0 - stabilize deployments"`

RULES:
- DO NOT modify any application logic
- DO NOT delete any migrations or functions
- If a migration fails, STOP and document why — do NOT force it
- If build breaks after type regen, fix ONLY the type errors (minimal changes)
- Real data only — never mock anything

DONE WHEN: 0 pending migrations, all functions deployed, build green, Vercel deployed.
```

### PHASE 1 — SECURITY LOCKDOWN (cvs-phase1)
```
You are working on the Client Vital Suite at /Users/milosvukovic/client-vital-suite/

MISSION: Zero unauthenticated mutating endpoints. Zero client-side secrets.

CONTEXT:
- Auth middleware: supabase/functions/_shared/auth-middleware.ts (exports verifyAuth)
- 29 edge functions missing verifyAuth (non-webhook, non-public)
- 5 GPS functions with ZERO auth: tinymdm-sync, tinymdm-devices, tinymdm-gps-history, gps-dwell-engine, verify-sessions-gps
- callgear-webhook has no signature verification
- Debug helpers exposed in prod: window.testFunction, window.debugApi, etc.
- VITE_PTD_INTERNAL_ACCESS_KEY leaks in client bundle

TASKS:
- [ ] Gate ALL debug helpers: wrap window.* assignments in `if (import.meta.env.DEV)` blocks
  - Search: `grep -rn "window\." src/ --include="*.ts" --include="*.tsx" | grep -i "test\|debug\|dev"`
- [ ] Move VITE_PTD_INTERNAL_ACCESS_KEY server-side:
  - Remove from any client-side code
  - Use only in edge functions via Deno.env.get()
  - If used for internal API auth, replace with proper session auth
- [ ] Add verifyAuth to 29 unauthed edge functions:
  - Import: `import { verifyAuth } from "../_shared/auth-middleware.ts";`
  - Add at top of handler: `const user = await verifyAuth(req); if (!user) return new Response("Unauthorized", { status: 401 });`
  - List functions by running: `grep -rL "verifyAuth" supabase/functions/*/index.ts | grep -v _shared | grep -v _archive | grep -v webhook | grep -v node_modules`
- [ ] Add verifyAuth to 5 GPS functions (same pattern)
- [ ] Add signature verification to callgear-webhook:
  - Check if CallGear sends HMAC signature header
  - If yes: verify with shared secret from Deno.env.get("CALLGEAR_WEBHOOK_SECRET")
  - If no: add IP allowlist check (CallGear IPs)
- [ ] Verify build: `npm run build` must pass
- [ ] Verify typecheck: `npx tsc --noEmit` must pass
- [ ] Deploy all modified functions: `supabase functions deploy --project-ref ztjndilxurtsfqdsvfds`
- [ ] Deploy frontend (if client code changed): `npx vercel deploy --prod --yes --scope milos-projects-d46729ec`
- [ ] Commit: `git add . && git commit -m "security: phase 1 - auth lockdown on all endpoints"`

RULES:
- DO NOT change any business logic — only add auth checks
- DO NOT remove any existing functionality
- Webhook endpoints (callgear-webhook, hubspot-webhook, stripe-webhook, anytrack-webhook, calendly-webhook) use signature verification, NOT session auth
- Public endpoints (health checks, public API) should remain public — verify each one
- If unsure whether a function should be public: ADD auth (safer default)
- verifyAuth pattern: check existing authed functions for the exact import path and usage

DONE WHEN: `grep -rL "verifyAuth\|webhook\|public\|health" supabase/functions/*/index.ts | grep -v _shared | grep -v _archive | grep -v node_modules | wc -l` = 0
```

### PHASE 2 — ATTRIBUTION CHAIN (cvs-phase2)
```
You are working on the Client Vital Suite at /Users/milosvukovic/client-vital-suite/

MISSION: Answer "Which Facebook ad made me money?" with real traced data.

CONTEXT:
- 5 attribution sources: Meta Ads API, AnyTrack webhooks, Meta CAPI (Stape), HubSpot CRM, HubSpot Lead Forms
- deals table missing stripe_payment_id column
- fb_ad_id/fb_campaign_id columns EXIST on contacts but are never populated during sync
- call_records.contact_id only 12.6% populated
- financial-analytics edge function missing CPL (Cost Per Lead) and CPO (Cost Per Opportunity)
- Currency: ALL values in AED. Stripe stores fils → divide by 100.

TASKS:
- [ ] Create migration: Add stripe_payment_id (text, nullable) to deals table
  - `supabase migration new add_stripe_payment_id_to_deals`
  - SQL: `ALTER TABLE deals ADD COLUMN IF NOT EXISTS stripe_payment_id text;`
  - Add index: `CREATE INDEX IF NOT EXISTS idx_deals_stripe_payment_id ON deals(stripe_payment_id);`
- [ ] Wire stripe-webhook to populate stripe_payment_id on deals when payment succeeds
  - Find the stripe webhook handler, add logic to match payment to deal and set stripe_payment_id
- [ ] Fix sync-hubspot-to-supabase to populate fb_ad_id/fb_campaign_id on contacts
  - These columns exist — the sync function just doesn't map them
  - HubSpot property names: facebook_ad_id, hs_analytics_source_data_1
- [ ] Improve call_records.contact_id coverage:
  - Add phone number matching: JOIN contacts ON call_records.phone = contacts.phone
  - Add email fallback matching
  - Create a backfill function or add to existing sync
- [ ] Add CPL and CPO to financial-analytics edge function:
  - CPL = total_ad_spend / total_leads (AED)
  - CPO = total_ad_spend / total_opportunities (AED)
  - Include in the response alongside existing metrics
- [ ] Create update-currency-rates edge function:
  - Fetch AED/USD rate from free API (e.g., exchangerate-api.com)
  - Store in org_memory_kv table (key: 'fx_aed_usd', value: rate)
  - Designed for pg_cron daily at 6AM Dubai time
- [ ] Push migration, deploy modified functions
- [ ] Verify build + typecheck pass
- [ ] Commit: `git add . && git commit -m "feat: phase 2 - attribution chain (stripe→deal, fb→contact, call→contact)"`

RULES:
- ALL currency in AED (divide Stripe fils by 100)
- Real data only — test queries against live Supabase
- Use .maybeSingle() not .single() for SELECT queries
- All new functions need verifyAuth (except webhooks)
- Deno imports need .ts extension

DONE WHEN: `SELECT stripe_payment_id FROM deals WHERE stripe_payment_id IS NOT NULL LIMIT 1;` returns a row after next Stripe payment.
```

### PHASE 4 — GPS + COACH INTELLIGENCE (cvs-phase4)
```
You are working on the Client Vital Suite at /Users/milosvukovic/client-vital-suite/

MISSION: Mathematical proof of coach accountability via GPS verification.

CONTEXT:
- TinyMDM API WORKING: Public key 95431b34..., Secret f174b5fd...
- Account ID: 0985d3686a827df2ee9b7a3142973df3
- 32 Samsung tablets, all GPS active
- DB has 3,258 location events, 275 coach visits
- 5 GPS functions exist: tinymdm-sync, tinymdm-devices, tinymdm-gps-history, gps-dwell-engine, verify-sessions-gps
- Auth should already be added by Phase 1

TASKS:
- [ ] Verify all 5 GPS functions have verifyAuth (Phase 1 dependency)
- [ ] Test tinymdm-sync with real API call — verify 32 devices returned
- [ ] Test gps-dwell-engine thresholds: 100m radius, 15min minimum dwell
  - Run with real data, verify coach_visits are created correctly
- [ ] Test verify-sessions-gps: ±60min window for session-GPS correlation
  - Check session timestamps vs GPS timestamps, verify match logic
- [ ] Create/verify view_coach_behavior_scorecard:
  - Metrics: dwell time, visits/day, on-time %, distance traveled
  - Must use real GPS + session data
- [ ] Add GPS staleness monitoring:
  - Alert if any device hasn't reported location in >24h
  - Query: `SELECT device_id, MAX(timestamp) FROM device_locations GROUP BY device_id HAVING MAX(timestamp) < NOW() - INTERVAL '24 hours'`
- [ ] Verify build + typecheck
- [ ] Deploy modified functions
- [ ] Commit: `git add . && git commit -m "feat: phase 4 - GPS coach intelligence verified"`

RULES:
- Real GPS data only (3,258 events in DB)
- TinyMDM API: use secrets from Supabase env (TINYMDM_PUBLIC_KEY, TINYMDM_SECRET_KEY)
- All functions need verifyAuth
- Coach privacy: GPS data is for business verification only

DONE WHEN: coach_visits populated, scorecard returns data, GPS verification ≥90% coverage.
```

---

## BLOCKED PHASES (Document Only — Execute When Unblocked)

### PHASE 3 — REVENUE RECOVERY (after Phase 2)
Focus: Failed payment recovery, package renewal alerts, revenue leakage detection, lost deal follow-up.
Revenue impact: AED 600K-1.2M/year.

### PHASE 5 — HUBSPOT OPERATIONS (after Phase 2)
Focus: Kill infinite loop workflow 1655409725, fix total_outgoing_calls, lead delegation.
Requires: HubSpot API token (CONFIRMED WORKING: pat-na1-51c5fb87...)

### PHASE 6 — AI ENGINE + RAG (after Phase 2+5)
Focus: Atlas ReAct engine, RAG pipeline, Lisa NEPQ improvements, cost caps.
Requires: Anthropic API balance (currently $0 — blocks some features)

### PHASE 7 — DASHBOARD COMPLETION (after Phase 2+3)
Focus: Wire war-room, audit pages, fix 13 failing tests, reduce select("*").

### PHASE 8 — AUTOMATION + GROWTH (after Phase 6+7)
Focus: Daily CEO briefing cron, Lisa lost-deal re-engagement, alert system.

---

## MONITORING PROTOCOL

CRAW checks tmux sessions every ~15 minutes:
```bash
# Check all sessions
tmux -S ~/.tmux/sock list-sessions

# Check specific phase output
tmux -S ~/.tmux/sock capture-pane -t cvs-phase0 -p | tail -30

# Check git for commits from agents
cd /Users/milosvukovic/client-vital-suite && git log --oneline -5
```

### Intervention Rules
1. Agent stuck >30min on same error → CRAW reviews and steers
2. Build breaks → CRAW pauses dependent phases
3. Migration fails → CRAW investigates before allowing next phase
4. Agent completes → CRAW verifies, then launches next wave

---

## SUCCESS CRITERIA

| Phase | Verification Command | Expected |
|-------|---------------------|----------|
| 0 | `supabase migration list --linked \| grep "\|                   \|" \| wc -l` | 0 |
| 1 | `grep -rL "verifyAuth" supabase/functions/*/index.ts \| grep -v _shared \| grep -v _archive \| grep -v webhook \| wc -l` | 0 |
| 2 | Column stripe_payment_id exists on deals | ✅ |
| 4 | `SELECT count(*) FROM coach_visits WHERE created_at > NOW() - INTERVAL '7 days'` | >0 |
| ALL | `npm run build && npx tsc --noEmit` | 0 errors |
