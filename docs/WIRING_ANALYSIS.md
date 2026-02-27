# WIRING ANALYSIS — Client Vital Suite
> Data flow and integration wiring map
> Updated: 2026-02-27

## Data Sources → Supabase

```
AWS RDS (read-only replica)
  └─ scripts/aws-sync-bridge.cjs
     ├─ vw_schedulers → training_sessions_live
     ├─ vw_client_packages → client_packages_live
     └─ vw_client_master → clients_full
     (Manual run via: node scripts/aws-sync-bridge.cjs)

HubSpot CRM
  ├─ hubspot-webhook (inbound webhooks) → contacts, deals
  ├─ hubspot-webhook-receiver (event processor)
  └─ hourly-hubspot-sync (pg_cron every hour)

Stripe
  ├─ stripe-webhook (payment events) → stripe_events
  └─ stripe-backfill (historical) → stripe_transactions

Meta Ads (Facebook)
  ├─ meta-ads-proxy (Anthropic + Pipeboard MCP) → analysis
  └─ facebook_ads_insights table (cached data)

CallGear (VoIP)
  ├─ callgear-webhook → call_tracking
  └─ fetch-callgear-data (pg_cron daily)

AnyTrack (Conversions)
  └─ anytrack-webhook → anytrack_events

Calendly (Bookings)
  └─ calendly-webhook → calendly_events

TinyMDM (GPS)
  └─ gps-pull-every-6h (pg_cron) → mdm_gps_data
```

## Intelligence Pipeline

```
DATA LAYER
  training_sessions_live + client_packages_live + clients_full
    │
    ▼
HEALTH ENGINE (health-score-engine, pg_cron daily 02:00 UTC)
  → client_health_daily (5D RFM+ scores)
    │
    ├─► client-intelligence-engine (pattern detection)
    │     → prepared_actions (churn alerts, ghost clients)
    │
    ├─► ml-churn-score (sigmoid ML, daily 02:30 UTC)
    │     → proactive_insights (7d/30d/90d churn probability)
    │
    ├─► proactive-insights-generator (LLM, every 2h)
    │     → proactive_insights (call scripts, action items)
    │
    └─► ai-ceo-master (executive AI, daily 03:00 UTC)
          → atlas_actions (strategic recommendations)

GPS INTELLIGENCE
  mdm_gps_data
    └─► coach-intelligence-engine
          → coach_recommendations (trust scores, fraud detection)

RAG LAYER
  knowledge_chunks (pgvector, gemini-embedding-001)
    └─► ptd-brain-api (vector search + LLM)

META ADS INTELLIGENCE
  facebook_ads_insights
    └─► meta-ads-proxy (Anthropic + Pipeboard MCP)
          → Real-time analysis via Claude
```

## Frontend → Backend Wiring

```
Dashboard Pages → Supabase Client (direct queries)
  ├─ ExecutiveOverview → deals, client_health_scores, contacts
  ├─ Coaches → training_sessions_live, clients_full
  ├─ Clients → clients_full, client_health_daily
  ├─ MetaAds → meta-ads-proxy (edge function)
  ├─ RevenueIntelligence → stripe_transactions, deals
  ├─ CoachLocations → mdm_gps_data, coach_recommendations
  └─ PredictiveIntelligence → proactive_insights, ml scores

Vercel API Routes → Supabase Edge Functions
  ├─ /api/events/* → meta-capi (CAPI forwarding)
  ├─ /api/meta-cross-validate → meta-cross-validate
  └─ /api/agent → ptd-brain-api (RAG)
```

## Known Wiring Issues
1. **Split-brain health**: 268 refs to `client_health_scores` (legacy) vs `client_health_daily` (v2)
2. **Attribution chain gap**: ad_id → contact → deal → revenue not fully wired
3. **Token budget tracker**: Broken/unwired — no cost visibility for AI calls
