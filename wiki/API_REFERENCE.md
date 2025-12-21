# API Reference — Edge Functions & Vercel Routes

## Vercel Serverless Routes (`/api/*`)
- `/api/health` — live status (JSON `{status:"ok"}`)
- `/api/events/[name]` — event ingest
- `/api/events/batch` — batch ingest
- `/api/webhook/backfill` — backfill webhook

Deploy from repo root with Vercel CLI linked to `client-vital-suite` to ensure these routes are included.

## Supabase Edge Functions (Selected, Real)
- **HubSpot Sync:** `sync-hubspot-to-supabase`, `sync-hubspot-to-capi`
- **Health & Interventions:** `health-calculator`, `intervention-recommender`
- **Stripe:** `stripe-webhook`, `stripe-forensics`, `enrich-with-stripe`
- **Meta/Attribution:** `process-capi-batch`, `ultimate-truth-alignment`, `anytrack-webhook`
- **AI Agents:** `ptd-agent-claude`, `ptd-agent-gemini`, `intelligence-router`
- **Ops:** `daily-report`, `business-intelligence`, `facebook-insights-fetch`

Deploy via `deploy-all-functions.sh` (auto discovers 80+ functions; requires Supabase CLI auth + project ref). No mock functions are used.
