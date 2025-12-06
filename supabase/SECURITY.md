# Supabase Security Configuration

This document describes the security configurations for the PTD Fitness Supabase backend.

## Row Level Security (RLS)

All tables have RLS enabled with the following policy structure:

### Sensitive Data Tables
- `client_health_scores`
- `coach_performance`
- `intervention_log`
- `daily_summary`
- `weekly_patterns`

**Policies:**
- `authenticated` role: Read access only
- `service_role`: Full CRUD access (used by edge functions)

### Agent Tables
- `agent_knowledge`
- `agent_conversations`
- `agent_decisions`
- `proactive_insights`
- `agent_metrics`

**Policies:**
- `authenticated` role: Read access, limited write access for specific operations
- `service_role`: Full CRUD access (used by edge functions)

## Edge Function Authentication

### User-Facing Functions (JWT Required)
These functions require a valid Supabase JWT token:
- `ptd-agent` - AI chat interface
- `health-calculator` - Health score calculations
- `daily-report` - Daily summary generation
- `anomaly-detector` - Anomaly detection
- `churn-predictor` - Churn prediction
- `coach-analyzer` - Coach performance analysis
- `intervention-recommender` - Intervention recommendations
- `data-quality` - Data quality checks
- `integration-health` - Integration health monitoring
- `pipeline-monitor` - Pipeline monitoring
- `ptd-watcher` - System monitoring

### Webhook/Integration Functions (API Key Validation)
These functions use API key validation instead of JWT. They validate using the shared `_shared/auth.ts` module:
- `process-capi-batch` - Meta CAPI batch processing
- `sync-hubspot-to-capi` - HubSpot to CAPI sync
- `send-to-stape-capi` - Stape CAPI integration
- `enrich-with-stripe` - Stripe enrichment
- `fetch-hubspot-live` - HubSpot data fetch
- `capi-validator` - CAPI validation
- `fix-n8n-workflows` - n8n workflow fixes
- `setup-workflows` - Workflow setup
- `update-n8n-workflow` - n8n workflow updates

**API Key Authentication:**
Functions validate using either:
1. `x-api-key` header with `WEBHOOK_API_KEY` environment variable
2. `Authorization: Bearer <key>` with service role key

### Shared Authentication Module
All webhook functions import authentication utilities from `_shared/auth.ts`:
```typescript
import { corsHeaders, validateApiKey, unauthorizedResponse } from "../_shared/auth.ts";
```

## Environment Variables Required

```
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

# Webhook Authentication
WEBHOOK_API_KEY=  # For service-to-service calls

# External Services
HUBSPOT_API_KEY=
STAPE_CAPIG_API_KEY=
ANTHROPIC_API_KEY=
```

## Security Best Practices

1. **Never expose `service_role` key** in client-side code
2. **Use `anon` key** for frontend applications
3. **Rotate `WEBHOOK_API_KEY`** periodically
4. **Monitor edge function logs** for unauthorized access attempts
5. **Review RLS policies** when adding new tables
