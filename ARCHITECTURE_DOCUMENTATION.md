# Client Vital Suite — System Architecture & Data Flow (No Mock Data)

This document captures the real production architecture, data flows, and success metrics for the Client Vital Suite. It reflects the live Vercel + Supabase stack (no mock data) that powers Personal Trainers Dubai (PTD).

## Platform Purpose
- Predict churn and automate interventions using daily client health scoring (0-100).
- Sync sales/marketing data from HubSpot, Meta CAPI, and AnyTrack to drive revenue.
- Detect Stripe anomalies and enrich CRM records with financial intelligence.
- Operate 50+ AI agents that surface insights, answer questions, and execute actions.

## Technology Stack
- **Frontend:** React 18 + TypeScript + Vite, Tailwind + shadcn/ui, hosted on Vercel, real-time via Supabase subscriptions.
- **Backend:** Supabase PostgreSQL, 80+ Edge Functions (Deno/TypeScript), pg_cron for schedules, RLS enforced.
- **Integrations:** HubSpot (CRM), Meta Conversions API (ads), Stripe (payments), AnyTrack (attribution), CallGear (calls).
- **AI:** Claude 3.5 Sonnet (primary), Gemini 2.5 Pro (secondary), 10+ specialist agents, RAG over Supabase knowledge base, persistent memory.

## End-to-End Data Flows (Real System)
- **HubSpot → Supabase → Frontend:** `sync-hubspot-to-supabase` upserts contacts/deals/calls/activities, `health-calculator` scores daily, `intervention-recommender` creates actions, dashboards stream via Supabase.
- **Meta CAPI:** `sync-hubspot-to-capi` maps events (`event_mappings`), hashes PII, sends via Stape to Meta API; `process-capi-batch` handles batches; `capi_events` renders the ROAS dashboard.
- **Stripe Forensics:** `stripe-webhook` ingests payments, `stripe-forensics` analyzes anomalies/payout patterns, writes to `fraud_alerts`, and enriches HubSpot via `enrich-with-stripe`.
- **Health Score Engine:** pg_cron triggers `health-calculator`; combines engagement/financial/relationship/package health/momentum into `client_health_scores`, classifies zones, and triggers interventions.
- **AI Agents:** `ptd-agent-claude`/`ptd-agent-gemini` call a 15-tool toolbox (`client_control`, `lead_control`, `sales_flow_control`, `hubspot_control`, `stripe_control`, `call_control`, `analytics_control`, `intelligence_control`, `get_at_risk_clients`, `get_coach_performance`, `get_proactive_insights`, `get_daily_summary`, `run_sql_query`, `universal_search`, `get_coach_clients`). Unified prompts pull lifecycle mapping, ultimate truth, ROI guidance, RAG knowledge, and memory before responding.

## Scheduling, Webhooks, and Batches
- **Real-time:** Supabase subscriptions feed dashboards; interventions fire within ~5 minutes of zone downgrade.
- **Cron:** Daily 9AM health scoring; 2AM Stripe forensics; 3AM business intelligence aggregation; 6PM daily report; hourly ultimate-truth alignment; on-demand agent queries.
- **Webhooks:** HubSpot → contact/deal sync; Stripe → payments; AnyTrack → attribution; CallGear → calls.
- **Batching:** Meta CAPI batching; health scores and interventions processed in groups to control cost and latency.

## Key Database Assets (Live Tables/Views)
- **Core:** `client_health_scores`, `contacts`, `deals`, `appointments`, `call_records`, `intervention_log`.
- **Marketing/Attribution:** `attribution_events`, `facebook_ads_insights`, `facebook_campaigns`, `events`, `ultimate_truth_events`, `capi_events`.
- **Financial:** `stripe_events`, `stripe_transactions`, `stripe_invoices`, `stripe_subscriptions`, `stripe_refunds`, `fraud_alerts`.
- **AI/RAG:** `agent_memory`, `agent_patterns`, `knowledge_base`, `knowledge_documents`, `proactive_insights`, `prepared_actions`.
- **Analytics Views:** `company_health_aggregates`, `at_risk_clients`, `coach_leaderboard`, `lead_lifecycle_view`, `ultimate_truth_dashboard`.

## Success Metrics
- 30% churn reduction; 1M+ AED revenue protection annually; 40% Meta ROAS uplift; 90% less manual data entry; target 85%+ clients in Green/Purple zones.

## Deployment Footprint
- **Vercel:** Frontend + `/api/*` (health, events, batch, webhook/backfill). Deploy from repo root with project linked.
- **Supabase:** 80+ Edge Functions. Deploy via `deploy-all-functions.sh` (auto-project-ref, auth enforced) once Supabase CLI is authenticated and linked.

## Current Gaps and Next Upgrades
- Improve queueing/retries for agent tasks; expand observability on function outcomes; tighten eval coverage for agents; add CI checks for CLI linkage before deploy.
