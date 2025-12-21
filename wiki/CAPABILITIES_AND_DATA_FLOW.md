# End-to-end capabilities, data flow, and mock-data removal plan

This is a field guide to how the app is supposed to work (Stripe forensics, HubSpot, call data, RAG memory, proactive agents) and how to get off mock data. It keeps every function intact—no feature reductions—while focusing on correctness and synchronization across Vercel and Supabase.

## What the system does today (capabilities at a glance)
- **Vercel `/api/*` serverless routes**: 4 endpoints (health, event ingest, batch ingest, webhook backfill). They proxy real inputs into Supabase and downstream automations.
- **Supabase Edge Functions (65)**: Business logic, webhooks, ETL, enrichment, and agent helpers for analytics, HubSpot sync, Stripe reconciliation, RAG prep, and proactive signals.
- **Stripe forensics**: Functions that reconcile payouts, charges, disputes, and anomalies against your internal ledger for finance/ops accuracy.
- **HubSpot sync**: Functions and API routes that push/pull CRM entities, ensuring contacts/deals/activities stay in step with app state.
- **Call/Setter intelligence**: Event handlers and Supabase tables that capture call outcomes, durations, recordings, and coach/rep performance for coaching and QA.
- **RAG memory + learning loop**: Vectorized knowledge base + conversation and decision logs in Supabase to ground agent answers and capture what worked.
- **Proactive/agent surface**: Agents watch events, raise alerts, and answer questions with live context (payments, CRM, call stats, interventions).

## How the data flows (high level)
1) **Ingress (Vercel `/api/*`)** → validates/persists events into Supabase (raw tables or queues).
2) **Processing (Supabase Edge Functions)** → enrich, reconcile, and fan-out to integrations:
   - Stripe: forensic reconciliations, refunds, dispute trails, payout checks.
   - HubSpot: contact/deal upserts, activity logging, pipeline health.
   - Call data: normalize setters/callers, attach recordings/notes, QA scoring hooks.
3) **Storage (Supabase DB)** → facts + vector memory (`knowledge_base`, `agent_conversations`, `agent_decisions`, `proactive_insights`).
4) **Serving**
   - **UI** pulls real data from Supabase views/functions (no mock data expected in production).
   - **Agents** answer via RAG + recent conversations + decision logs; they can trigger follow-up actions (alerts, backfills, retries).

## Getting off mock data (keep all functions, make them real)
- **Replace fixture inputs with live sources**
  - Point local env to production (or staging) Supabase + Vercel env vars.
  - Disable any mock toggles/flags in frontend state or scripts; use real `/api/events` and `/api/webhook/backfill` payloads.
- **Verify ingress is live**
  - `curl -i https://client-vital-suite.vercel.app/api/health` → expect 200.
  - Send a sample live event to `/api/events/{name}` and confirm it lands in Supabase raw tables.
- **Confirm Supabase link and functions**
  - `./check-cli-connections.sh` → must show Vercel + Supabase logged in and linked.
  - `supabase functions list` → should list all 65 functions; if not, re-link with the correct project ref.
- **Run the full deploys (no reductions)**
  - Vercel: `vercel --prod` from repo root (ensures `/api` is deployed).
  - Supabase Edge: `./deploy-all-functions.sh` (auto-resolves project ref; fails fast if auth/ref missing).
- **Data sanity checks (Stripe, HubSpot, calls)**
  - Stripe: compare charges/payouts vs. internal tables; run forensic function to flag gaps.
  - HubSpot: pick a contact/deal and verify round-trip (Supabase → HubSpot → Supabase).
  - Calls: ingest a fresh call record; verify it appears with correct caller/setter mapping and QA flags.
- **RAG memory refresh**
  - Re-index knowledge base with current facts (Stripe anomalies, HubSpot deal states, call summaries).
  - Verify agent answers cite recent data and decisions (no stale mock content).

## How agents answer “all the things”
- **Inputs blended**: live Supabase facts (payments, CRM, calls) + vector RAG + conversation history + decision logs.
- **Stripe forensic answers**: cite charge/payout/dispute tables; flag mismatches and suggest remediation.
- **HubSpot answers**: read latest contact/deal pipelines; propose fixes (stage corrections, missing owners) and log back to HubSpot.
- **Call intelligence**: summarize setter performance, QA scores, and blockers; suggest coaching actions.
- **Learning loop**: decisions and outcomes are logged; successful interventions feed back into `knowledge_base` for better future answers.
- **Proactivity**: background watchers raise alerts for anomalies (revenue drops, pipeline stalls, low connect rates) and can trigger backfills.

## Minimal daily checklist (stay synchronized)
1) `./check-cli-connections.sh` → both CLIs authenticated/linked.
2) `vercel --prod` (from repo root) → `/api` live.
3) `./deploy-all-functions.sh` → Supabase Edge live.
4) Smoke tests: health endpoint, one event ingest, Stripe forensic check, HubSpot round-trip, call record ingest.
5) Agent spot-check: ask for Stripe payouts summary, HubSpot pipeline blockers, and setter call summary; ensure answers cite fresh data.

## If something is red/ERR
- Treat it as a blocker: re-auth (`vercel login`, `supabase login`), re-link projects, rerun deploys.
- Re-test ingress and sample workflows before assuming the UI or agents are correct.
