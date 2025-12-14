# PTD Fitness Intelligence Pack - Setup Guide

## Architecture Overview

This project integrates three core systems:
1. **Frontend Dashboard** (this repo) - React dashboard for monitoring and control
2. **Stape CAPI Gateway** - Meta Conversions API proxy (https://ap.stape.info)
3. **Supabase Edge Functions** - Automation engine for data processing

## System Components

### 1. Frontend Dashboard (Lovable)
Located at: `/ptd-control`

**Tabs:**
- **Dashboard** - Quick access to all features
- **Health Intelligence** - Client health scoring and analytics
- **CAPI** - Test Meta conversion events
- **Event Mapping** - Configure HubSpot → Meta event mappings
- **Automation** - Trigger Supabase Edge Functions
- **Settings** - Configure all service connections

### 2. Stape CAPI Integration

**Configuration:**
- Name: rikiki capi
- URL: https://ap.stape.info
- CAPIG Identifier: ecxdsmmg
- API Key: Stored in Supabase secret `STAPE_CAPIG_API_KEY`

**How It Works:**
1. Frontend calls Supabase edge function `send-to-stape-capi`
2. Edge function routes event through Stape gateway
3. Stape forwards to Meta Conversions API
4. Event logged in `capi_events` table

**Supported Features:**
- Test/Live mode switching
- PII hashing (handled by Stape)
- Event validation
- Test event codes for debugging

### 3. Event Mapping System

**Database Table:** `event_mappings`

Maps HubSpot lifecycle stages to Meta standard events:

| HubSpot Event | Meta Event | Parameters |
|---------------|------------|------------|
| initial_lead | Lead | currency: AED |
| marketingqualifiedlead | Lead | currency: AED, content_name: "Marketing Qualified Lead" |
| salesqualifiedlead | Lead | currency: AED, content_name: "Sales Qualified Lead" |
| opportunity | InitiateCheckout | currency: AED |
| customer | Purchase | currency: AED |
| pageview | PageView | {} |
| view_content | ViewContent | currency: AED |

**Managing Mappings:**
- Add new mappings via UI (Event Mapping tab)
- Toggle active/inactive status
- Delete unused mappings
- All changes stored in Supabase

### 4. Supabase Edge Functions Automation

**Scheduled Functions (via pg_cron):**
All automation is handled by Supabase Edge Functions scheduled via PostgreSQL cron:

- `health-calculator` - Daily health score calculation (runs daily at 9 AM)
- `churn-predictor` - AI-powered risk analysis (runs daily)
- `daily-report` - Daily summary email generation (runs daily at 6 PM)
- `coach-analyzer` - Monthly coach performance review (runs monthly)

**Manual Invocation:**
Edge Functions can be invoked directly via Supabase Functions API or through the dashboard UI.

## Database Schema

### Core Tables

**capi_events** - Logs all conversion events
```sql
- event_id (unique)
- event_name (Purchase, Lead, etc.)
- event_time
- currency (default: AED)
- value_aed
- user_email
- user_phone
- fbp, fbc (Meta cookies)
- mode (test/live)
- status
```

**event_mappings** - HubSpot to Meta event configuration
```sql
- hubspot_event_name (unique)
- meta_event_name
- is_active (boolean)
- event_parameters (jsonb)
```

**client_health_scores** - Health intelligence data
```sql
- email
- health_score
- risk_score
- zone (RED/YELLOW/GREEN/PURPLE)
- momentum_indicator
- assigned_coach
```

**app_settings** - System configuration (singleton)
```sql
- supabase_url, supabase_anon_key
- capi_base_url
- meta_pixel_id
- test_event_code
- telegram_bot_token, telegram_chat_id
```

## Supabase Edge Functions

### send-to-stape-capi
**Purpose:** Routes conversion events through Stape CAPI gateway

**Input:**
```json
{
  "eventData": {
    "event_name": "Purchase",
    "user_data": {
      "email": "client@example.com",
      "phone": "+971501234567",
      "fbp": "fb.1.xxx",
      "fbc": "fb.1.xxx"
    },
    "custom_data": {
      "currency": "AED",
      "value": 500.00
    },
    "test_event_code": "TEST12345" // optional, for test mode
  },
  "mode": "test" | "live"
}
```

**Output:**
```json
{
  "success": true,
  "mode": "test",
  "event_id": "evt_1234567890",
  "response": { ... }
}
```

## Usage Workflows

### 1. Testing CAPI Events

1. Navigate to PTD Control → CAPI tab
2. Fill in test data:
   - Email: `test@ptdfitness.com`
   - Phone: `+971501234567`
   - Value: `500`
3. Enable "Use test_event_code" for test mode
4. Click "Send to CAPI"
5. Check Meta Events Manager for test event

### 2. Configuring Event Mappings

1. Navigate to PTD Control → Event Mapping tab
2. Add new mapping:
   - HubSpot Event: `customerevent`
   - Meta Event: `Purchase`
3. Toggle active/inactive as needed
4. Events will automatically use these mappings

### 3. Running Automation

1. Navigate to Automation tab
2. Edge Functions run automatically via scheduled cron jobs
3. Manual triggers available for:
   - Daily Health Calculation (health-calculator)
   - Monthly Coach Review (coach-analyzer)
   - CSV Backfill (via API endpoint)

## Environment Variables

**Supabase Secrets (configured):**
- `STAPE_CAPIG_API_KEY` - Stape CAPI authentication
- `ANTHROPIC_API_KEY` - Claude AI for agent functions
- `HUBSPOT_API_KEY` - HubSpot CRM integration
- `STRIPE_SECRET_KEY` - Stripe payment processing
- `FB_PIXEL_ID` - Meta Pixel ID
- `TELEGRAM_BOT_TOKEN` - For notifications

**Frontend Environment:**
- All configuration stored in `app_settings` table
- No hardcoded secrets in frontend code

## Meta Pixel Configuration

**Your Pixels:**
- PTD 2025 Pixel: 1405173453873048
- PTD Fitness Pixel: 714927822471230

**Standard Events Configured:**
- PageView
- Lead
- InitiateCheckout (opportunity)
- Purchase (customer)
- ViewContent
- Contact

## GitHub Repository Structure

### CONVERSION-API Repo (Backend)
```
CONVERSION-API/
├── server.js              # Express CAPI proxy
├── package.json
├── .env.example
├── README.md
├── scripts/
│   └── test-events.js    # Test scripts
├── supabase/
│   ├── schema.sql        # Database schema
│   └── functions/        # Edge Functions
```

### client-vital-suite Repo (Frontend)
```
client-vital-suite/
├── src/
│   ├── pages/
│   │   └── PTDControl.tsx
│   ├── components/ptd/
│   │   ├── DashboardTab.tsx
│   │   ├── HealthIntelligenceTab.tsx
│   │   ├── CAPITab.tsx
│   │   ├── EventMappingTab.tsx
│   │   ├── AutomationTab.tsx
│   │   └── SettingsTab.tsx
│   └── integrations/supabase/
├── supabase/
│   └── functions/
│       └── send-to-stape-capi/
└── PTD_SETUP_GUIDE.md    # This file
```

## Data Flow

### HubSpot → Meta CAPI Flow

```
HubSpot Event
    ↓
Supabase Edge Function (sync-hubspot-to-supabase)
    ↓
Check event_mappings table
    ↓
Build CAPI payload with mapping
    ↓
Call send-to-stape-capi edge function
    ↓
Stape CAPI Gateway (https://ap.stape.info)
    ↓
Meta Conversions API
    ↓
Log to capi_events table
```

### Health Intelligence Flow

```
HubSpot Contact Data
    ↓
Supabase Edge Function (health-calculator)
    ↓
Calculate health scores
    ↓
Store in client_health_scores table
    ↓
Frontend Dashboard displays metrics
    ↓
Trigger interventions if needed
```

## Deployment Checklist

- [x] Supabase project created and configured
- [x] Stape CAPI gateway active
- [x] Edge functions deployed (send-to-stape-capi, health-calculator, etc.)
- [x] Event mappings table populated
- [x] Settings configured in app_settings
- [x] Cron jobs scheduled for automated Edge Functions
- [ ] Meta Pixel integrated on website
- [ ] Test events validated in Meta Events Manager
- [ ] Production credentials added to Supabase secrets

## Testing

### 1. CAPI Connection Test
```bash
# From PTD Control → CAPI tab
1. Enter test email/value
2. Enable test_event_code
3. Click "Send to CAPI"
4. Verify in Meta Events Manager → Test Events
```

### 2. Event Mapping Test
```bash
# From PTD Control → Event Mapping tab
1. Create mapping: "testevent" → "Lead"
2. Activate mapping
3. Send test event via CAPI tab
4. Check capi_events table for correct event_name
```

### 3. Health Intelligence Test
```bash
# From PTD Control → Health Intelligence tab
1. Click "Recalculate"
2. Verify scores update
3. Check company_health_aggregates view
```

## Troubleshooting

### CAPI Events Not Appearing
1. Check Stape CAPI API key is set: `STAPE_CAPIG_API_KEY`
2. Verify mode (test/live) matches expectations
3. Check edge function logs: Supabase → Functions → send-to-stape-capi → Logs
4. Verify Meta Pixel ID is correct in Settings

### Event Mappings Not Working
1. Ensure mapping is marked as `is_active = true`
2. Check event_mappings table for correct HubSpot event name
3. Verify Edge Function (sync-hubspot-to-supabase) is using the mapping table

### Edge Functions Not Running
1. Check Supabase cron job schedules (pg_cron)
2. Verify Edge Function logs in Supabase Dashboard
3. Test Edge Functions manually via Supabase Functions API
4. Review function error logs for debugging

## Support

For issues or questions:
1. Check Supabase logs (Database, Edge Functions)
2. Review Meta Events Manager diagnostics
3. Check Edge Function execution logs in Supabase Dashboard
4. Review this guide and verify all steps completed

## Next Steps

1. Verify all Edge Functions are deployed and scheduled
2. Configure Supabase secrets (API keys, tokens)
3. Set up Meta Pixel on ptdfitness.com
4. Test end-to-end: HubSpot → Supabase Edge Functions → CAPI → Meta
5. Monitor health scores and adjust thresholds
6. Configure Telegram alerts for critical events
