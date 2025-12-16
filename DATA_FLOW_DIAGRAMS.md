# Data Flow Diagrams (Mermaid)

## HubSpot → Supabase → Frontend
```mermaid
flowchart TD
    HubSpot[HubSpot CRM] -->|API Call| SyncFunction[sync-hubspot-to-supabase]
    SyncFunction -->|Upsert| SupabaseDB[(Supabase Postgres)]
    SupabaseDB -->|Subscription| Frontend[React/Vercel UI]
    SupabaseDB -->|Daily Cron| HealthCalc[health-calculator]
    HealthCalc -->|Scores| HealthScores[client_health_scores]
    HealthScores -->|Alerts| Interventions[intervention-recommender]
```

## Meta Conversions API
```mermaid
flowchart TD
    HubSpotEvent[HubSpot Deal Events] -->|Webhook| SyncCAPI[sync-hubspot-to-capi]
    SyncCAPI --> EventMappings[event_mappings]
    EventMappings --> Payload[CAPI Payload]
    Payload --> Hash[SHA-256 PII Hash]
    Hash --> Stape[Stape Gateway]
    Stape --> MetaAPI[Meta CAPI]
    MetaAPI --> CAPIEvents[capi_events]
    CAPIEvents --> Batch[process-capi-batch]
```

## Stripe Forensics & Enrichment
```mermaid
flowchart TD
    StripeWebhook[Stripe Webhook] --> StripeFn[stripe-webhook]
    StripeFn --> StripeEvents[stripe_events]
    Cron[pg_cron 2AM] --> Forensics[stripe-forensics]
    Forensics --> Anomalies[fraud_alerts]
    Forensics --> Enrich[enrich-with-stripe]
    Enrich --> HubSpotContacts[HubSpot Contacts]
```

## Health Score Engine
```mermaid
flowchart TD
    Cron[pg_cron 9AM] --> HealthCalc[health-calculator]
    HealthCalc --> Contacts[contacts]
    HealthCalc --> Deals[deals]
    HealthCalc --> Calls[call_records]
    HealthCalc --> Activities[activities]
    HealthCalc --> ScoreAlgo[Scoring Engine]
    ScoreAlgo --> Engagement[Engagement]
    ScoreAlgo --> Financial[Financial]
    ScoreAlgo --> Relationship[Relationship]
    ScoreAlgo --> Package[Package Health]
    ScoreAlgo --> Momentum[Momentum]
    Engagement --> Final[client_health_scores]
    Financial --> Final
    Relationship --> Final
    Package --> Final
    Momentum --> Final
    Final --> Zones[Zones + Interventions]
```

## Agent Tooling
```mermaid
flowchart TD
    UserQuery[User Query] --> Agent[Claude/Gemini Agent]
    Agent --> ToolSystem[Tool Router]
    ToolSystem --> Client[client_control]
    ToolSystem --> Leads[lead_control]
    ToolSystem --> Sales[sales_flow_control]
    ToolSystem --> HubSpot[hubspot_control]
    ToolSystem --> Stripe[stripe_control]
    ToolSystem --> Calls[call_control]
    ToolSystem --> Analytics[analytics_control]
    ToolSystem --> Intelligence[intelligence_control]
    ToolSystem --> AtRisk[get_at_risk_clients]
    ToolSystem --> CoachPerf[get_coach_performance]
    ToolSystem --> Proactive[get_proactive_insights]
    ToolSystem --> Daily[get_daily_summary]
    ToolSystem --> SQL[run_sql_query]
    ToolSystem --> Search[universal_search]
    ToolSystem --> CoachClients[get_coach_clients]
    Client --> Agent
    Leads --> Agent
    Sales --> Agent
    HubSpot --> Agent
    Stripe --> Agent
    Calls --> Agent
    Analytics --> Agent
    Intelligence --> Agent
    AtRisk --> Agent
    CoachPerf --> Agent
    Proactive --> Agent
    Daily --> Agent
    SQL --> Agent
    Search --> Agent
    CoachClients --> Agent
    Agent --> Response[Final Answer]
```

## Independent Sources → Unified System (Resilient by Design)
```mermaid
flowchart TD
    subgraph IndependentSources[Independent Data Sources]
        CallGear[CallGear\nCall Tracking]
        Stripe[Stripe\nPayments]
        AnyTrack[AnyTrack\nAttribution]
        HubSpot[HubSpot\nCRM]
        Facebook[Facebook Ads\nMeta API]
        Calendly[Calendly\nAppointments]
    end

    subgraph Supabase[(Supabase Postgres - Storage)]
        CallRecords[call_records]
        StripeEvents[stripe_events]
        AttributionEvents[attribution_events]
        Contacts[contacts]
        Deals[deals]
        FacebookInsights[facebook_ads_insights]
        Appointments[appointments]
    end

    subgraph UnifiedSystem[Unified Intelligence]
        HealthScores[client_health_scores]
        UltimateTruth[ultimate_truth_events]
        AIAgents[AI Agents]
        Dashboards[Frontend Dashboards]
    end

    CallGear -->|Webhook| CallRecords
    Stripe -->|Webhook| StripeEvents
    AnyTrack -->|Webhook| AttributionEvents
    HubSpot -->|Sync/API| Contacts
    HubSpot -->|Sync/API| Deals
    Facebook -->|API| FacebookInsights
    Calendly -->|Webhook| Appointments

    CallRecords --> UnifiedSystem
    StripeEvents --> UnifiedSystem
    AttributionEvents --> UnifiedSystem
    Contacts --> UnifiedSystem
    Deals --> UnifiedSystem
    FacebookInsights --> UnifiedSystem
    Appointments --> UnifiedSystem

    UnifiedSystem -->|Unified view| Dashboards
```

**Key principle:** Each source ingests independently—if one is paused, the rest keep flowing. Ultimate truth alignment and the health score engine stitch everything together for predictive signals without requiring Docker or local brokers.
