# PTD Fitness Intelligence Pack - Setup Guide

## Architecture Overview

This project integrates two core systems:
1. **Lovable Frontend** (this repo) - React dashboard for monitoring and control
2. **Stape CAPI Gateway** - Meta Conversions API proxy (https://ap.stape.info)
3. **Supabase pg_cron** - Scheduled automation engine for data processing

## System Components

### 1. Frontend Dashboard (Lovable)
Located at: `/ptd-control`

**Tabs:**
- **Dashboard** - Quick access to all features
- **Health Intelligence** - Client health scoring and analytics
- **CAPI** - Test Meta conversion events
- **Event Mapping** - Configure HubSpot → Meta event mappings
- **Automation** - Trigger n8n workflows
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

### 4. Automation with Supabase pg_cron

Scheduled tasks are now managed through Supabase pg_cron instead of n8n:

**Available Scheduled Jobs:**
- Daily health score calculation
- Monthly coach performance review
- Weekly pattern analysis
- Intervention logging

**Managing Schedules:**
- Configure via Supabase SQL Editor
- Use pg_cron syntax for scheduling
- Monitor execution via Supabase logs

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

Automation is now handled by Supabase pg_cron scheduled jobs:
1. Daily Health Calculation - Runs every morning
2. Monthly Coach Review - Runs on the 1st of each month
3. Weekly Pattern Analysis - Runs every Monday
4. Intervention Logging - Runs continuously as events occur

## Environment Variables

**Supabase Secrets (configured):**
- `STAPE_CAPIG_API_KEY` - Stape CAPI authentication
- `N8N_API_KEY` - n8n workflow authentication (if needed)
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
└── supabase/
    └── schema.sql        # Database schema
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
n8n Workflow (detects lifecycle change)
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
n8n Daily Health Workflow
    ↓
Calculate health scores (aggregator function)
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
- [x] Edge function deployed (send-to-stape-capi)
- [x] Event mappings table populated
- [x] Settings configured in app_settings
- [ ] n8n workflows imported and active
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
3. Verify n8n workflow is using the mapping table

### Scheduled Tasks Not Running
1. Verify pg_cron extension is enabled in Supabase
2. Check Supabase logs for execution history
3. Verify cron job syntax is correct
4. Check database permissions for the cron job user

## Support

For issues or questions:
1. Check Supabase logs (Database, Edge Functions)
2. Review Meta Events Manager diagnostics
3. Check Supabase pg_cron execution logs
4. Review this guide and verify all steps completed

## Next Steps

1. Configure Supabase pg_cron jobs for automation
2. Set up Meta Pixel on ptdfitness.com
3. Test end-to-end: HubSpot → Supabase → CAPI → Meta
4. Monitor health scores and adjust thresholds
5. Configure Telegram alerts for critical events
6. Review pg_cron execution logs for any issues
