# Edge Functions Summary

**Deployment Date**: 2025-12-08
**Branch**: claude/audit-dashboard-services-019cYmrNzrFjTAnFURTn7yBM

---

## EDGE FUNCTIONS IN THIS DEPLOYMENT

### UPDATED: `fetch-hubspot-live`
**Location**: `/home/user/client-vital-suite/supabase/functions/fetch-hubspot-live/index.ts`
**Status**: ✅ Enhanced with Sync Capabilities
**Lines**: 539 lines

#### New Features Added

##### 1. Contact Sync (`type='contacts', sync=true`)
**Purpose**: Sync HubSpot contacts to database

**API Call**:
```typescript
await supabase.functions.invoke('fetch-hubspot-live', {
  body: {
    type: 'contacts',
    sync: true,
    timeframe: 'today', // or 'yesterday', 'this_month', 'last_month'
    setter: 'matthew' // optional: filter by owner
  }
});
```

**Database Operations**:
- Upserts to `contacts` table
- Conflict resolution on `hubspot_contact_id`
- Maps properties:
  - `hubspot_contact_id` ← `contact.id`
  - `email` ← `properties.email`
  - `first_name` ← `properties.firstname`
  - `last_name` ← `properties.lastname`
  - `phone` ← `properties.phone`
  - `owner_id` ← `properties.hubspot_owner_id`
  - `lifecycle_stage` ← `properties.lifecyclestage`
  - `status` ← `properties.hs_lead_status`
  - `created_at` ← `properties.createdate`
  - `updated_at` ← Current timestamp

**Logging**: Records sync to `sync_logs` table

**Returns**:
```typescript
{
  success: true,
  synced: true,
  contacts: [ /* array of contact objects */ ],
  totalContacts: number,
  deals: [ /* associated deals */ ],
  ownerMap: { /* owner ID to name mapping */ }
}
```

##### 2. Deals Sync (`type='deals', sync=true`)
**Purpose**: Sync HubSpot deals to database

**API Call**:
```typescript
await supabase.functions.invoke('fetch-hubspot-live', {
  body: {
    type: 'deals',
    sync: true
  }
});
```

**Database Operations**:
- Upserts to `deals` table
- Conflict resolution on `hubspot_deal_id`
- Maps properties:
  - `hubspot_deal_id` ← `deal.id`
  - `deal_name` ← `properties.dealname`
  - `deal_value` ← `parseFloat(properties.amount)`
  - `stage` ← `properties.dealstage`
  - `status` ← `properties.hs_is_closed ? 'CLOSED' : 'OPEN'`
  - `close_date` ← `properties.closedate`
  - `closer_id` ← `properties.hubspot_owner_id`
  - `pipeline` ← `properties.pipeline`
  - `created_at` ← `properties.createdate`
  - `updated_at` ← Current timestamp

**Returns**:
```typescript
{
  success: true,
  synced: true,
  type: 'deals',
  recordsSynced: number,
  recordsFailed: number
}
```

##### 3. Owners Sync (`type='owners', sync=true`)
**Purpose**: Sync HubSpot owners/team members to database

**API Call**:
```typescript
await supabase.functions.invoke('fetch-hubspot-live', {
  body: {
    type: 'owners',
    sync: true
  }
});
```

**Database Operations**:
- Upserts to `staff` table
- Conflict resolution on `id`
- Maps properties:
  - `id` ← `owner.id`
  - `name` ← `"${owner.firstName} ${owner.lastName}"`
  - `email` ← `owner.email`
  - `role` ← `'coach'` (default)

**Returns**:
```typescript
{
  success: true,
  synced: true,
  type: 'owners',
  recordsSynced: number,
  recordsFailed: number
}
```

##### 4. Activity Tracking (`type='activity'`)
**Purpose**: Fetch recent call activity from HubSpot

**API Call**:
```typescript
await supabase.functions.invoke('fetch-hubspot-live', {
  body: {
    type: 'activity',
    timeframe: 'today'
  }
});
```

**HubSpot API**: Searches `calls` object with timestamp filter

**Returns**:
```typescript
{
  success: true,
  timeframe: 'today',
  activities: [
    {
      id: string,
      title: string,
      status: string,
      duration: number,
      timestamp: string,
      toNumber: string,
      fromNumber: string,
      ownerId: string
    }
  ],
  totalActivities: number
}
```

#### Sync Logging

All sync operations log to `sync_logs` table:
```typescript
{
  platform: 'hubspot',
  sync_type: 'contacts' | 'deals' | 'owners',
  status: 'success' | 'partial' | 'failed',
  started_at: TIMESTAMPTZ,
  completed_at: TIMESTAMPTZ,
  duration_ms: INTEGER,
  records_processed: INTEGER,
  records_failed: INTEGER,
  error_details: JSONB
}
```

Query logs:
```sql
SELECT * FROM sync_logs
WHERE platform = 'hubspot'
ORDER BY created_at DESC
LIMIT 10;
```

#### Environment Variables Required
```bash
HUBSPOT_API_KEY=your_hubspot_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### Deployment Command
```bash
supabase functions deploy fetch-hubspot-live
```

#### Error Handling
- ✅ API key validation
- ✅ HubSpot API error handling
- ✅ Database upsert error handling
- ✅ Detailed error logging
- ✅ Partial sync support (continues on individual failures)

---

## EXISTING EDGE FUNCTIONS (Reference)

### Core Intelligence Functions

#### 1. `ptd-agent`
**Purpose**: Main AI decision engine
**Actions**: chat, recommend, explain, analyze
**Used By**: AskAI component, dashboards

#### 2. `intervention-recommender`
**Purpose**: Generate personalized interventions
**Input**: Client zones, limits
**Output**: Recommended actions with draft messages

#### 3. `churn-predictor`
**Purpose**: Predict client churn risk
**Input**: Client data, patterns
**Output**: Churn probability, factors

#### 4. `health-calculator`
**Purpose**: Calculate client health scores
**Runs**: Daily at 9:00 AM (cron)
**Updates**: `client_health_scores` table

### Monitoring Functions

#### 5. `ptd-watcher`
**Purpose**: Proactive system monitoring
**Runs**: Every 6 hours (cron)
**Output**: Alerts to `proactive_insights`

#### 6. `pipeline-monitor`
**Purpose**: Sales pipeline health checks
**Monitors**: Deal velocity, conversion rates
**Alerts**: Pipeline issues

#### 7. `anomaly-detector`
**Purpose**: Detect unusual patterns
**Analyzes**: Client behavior, coach performance
**Flags**: Anomalies for review

#### 8. `integration-health`
**Purpose**: Monitor external integrations
**Checks**: HubSpot, Meta, Stripe connections
**Reports**: Health status

### Analytics Functions

#### 9. `coach-analyzer`
**Purpose**: Analyze coach performance
**Runs**: Weekly Monday 8:00 AM (cron)
**Updates**: `coach_performance` table

#### 10. `daily-report`
**Purpose**: Generate daily summary
**Runs**: Daily at 6:00 PM (cron)
**Updates**: `daily_summary` table

### Meta CAPI Functions

#### 11. `sync-hubspot-to-capi`
**Purpose**: Sync conversions to Meta CAPI
**Runs**: Daily at 11:00 AM (cron)
**Processes**: Enriched events

#### 12. `process-capi-batch`
**Purpose**: Batch process CAPI events
**Handles**: Bulk event submission

#### 13. `capi-validator`
**Purpose**: Validate CAPI event format
**Checks**: Required fields, data quality

#### 14. `send-to-stape-capi`
**Purpose**: Alternative CAPI endpoint
**Routes**: Events via stape.io

#### 15. `enrich-with-stripe`
**Purpose**: Enrich events with Stripe data
**Adds**: Payment info, customer value

### Data Quality Functions

#### 16. `data-quality`
**Purpose**: Monitor data quality metrics
**Checks**: Completeness, accuracy, consistency

---

## EDGE FUNCTION DEPLOYMENT CHECKLIST

### Before Deployment
- [x] Code reviewed and tested locally
- [x] Environment variables documented
- [x] Error handling implemented
- [x] Logging added
- [ ] ⚠️ API keys configured in Supabase

### Deploy Commands
```bash
# Deploy single function
supabase functions deploy fetch-hubspot-live

# Deploy all functions
supabase functions deploy --no-verify-jwt

# Check deployment
supabase functions list
```

### After Deployment
- [ ] Test each sync type manually
- [ ] Verify database records created
- [ ] Check sync logs for errors
- [ ] Monitor function logs
- [ ] Test error scenarios

### Testing Commands
```bash
# Test contact sync
curl -X POST https://your-project.supabase.co/functions/v1/fetch-hubspot-live \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"contacts","sync":true,"timeframe":"today"}'

# Test deals sync
curl -X POST https://your-project.supabase.co/functions/v1/fetch-hubspot-live \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"deals","sync":true}'

# Test owners sync
curl -X POST https://your-project.supabase.co/functions/v1/fetch-hubspot-live \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type": application/json" \
  -d '{"type":"owners","sync":true}'
```

---

## RECOMMENDED CRON SCHEDULES

### Add Auto-Sync Jobs
```sql
-- Sync contacts every 15 minutes
SELECT cron.schedule(
  'sync-hubspot-contacts',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/fetch-hubspot-live',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"type": "contacts", "sync": true, "timeframe": "today"}'::jsonb
  );
  $$
);

-- Sync deals every hour
SELECT cron.schedule(
  'sync-hubspot-deals',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/fetch-hubspot-live',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"type": "deals", "sync": true}'::jsonb
  );
  $$
);

-- Sync owners daily at 6:00 AM
SELECT cron.schedule(
  'sync-hubspot-owners',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/fetch-hubspot-live',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"type": "owners", "sync": true}'::jsonb
  );
  $$
);
```

### View Scheduled Jobs
```sql
-- List all cron jobs
SELECT * FROM cron.job ORDER BY jobname;

-- Remove a job
SELECT cron.unschedule('sync-hubspot-contacts');
```

---

## MONITORING & TROUBLESHOOTING

### Check Function Logs
```bash
# View recent logs
supabase functions logs fetch-hubspot-live

# Follow logs in real-time
supabase functions logs fetch-hubspot-live --follow

# Filter by error
supabase functions logs fetch-hubspot-live | grep -i error
```

### Database Queries for Monitoring
```sql
-- Check sync status
SELECT
  platform,
  sync_type,
  status,
  started_at,
  duration_ms,
  records_processed,
  records_failed
FROM sync_logs
WHERE platform = 'hubspot'
ORDER BY started_at DESC
LIMIT 20;

-- Check error rate
SELECT
  sync_type,
  status,
  COUNT(*) as count
FROM sync_logs
WHERE platform = 'hubspot'
  AND started_at >= NOW() - INTERVAL '24 hours'
GROUP BY sync_type, status
ORDER BY sync_type, status;

-- Check sync frequency
SELECT
  sync_type,
  DATE_TRUNC('hour', started_at) as hour,
  COUNT(*) as syncs
FROM sync_logs
WHERE platform = 'hubspot'
  AND started_at >= NOW() - INTERVAL '7 days'
GROUP BY sync_type, hour
ORDER BY hour DESC;
```

### Common Issues

**Issue**: "HUBSPOT_API_KEY not configured"
**Solution**: Add API key to Supabase secrets

**Issue**: "HubSpot API error: 401"
**Solution**: Verify API key is valid and has proper scopes

**Issue**: "Failed to sync contact: <id>"
**Solution**: Check `sync_logs` `error_details` for specific error

**Issue**: Partial sync (some records failed)
**Solution**: Normal - check logs for specific failures, function continues

---

## PERFORMANCE METRICS

### Expected Performance
- Contact sync: ~100 contacts in 5-10 seconds
- Deals sync: ~100 deals in 3-5 seconds
- Owners sync: ~20 owners in 1-2 seconds
- Total memory: <128 MB

### Optimization Tips
1. Limit timeframe to reduce API calls
2. Use batch operations where possible
3. Monitor sync_logs table size (archive old logs)
4. Adjust cron frequency based on data velocity

---

## SUMMARY

**Edge Functions Updated**: 1 (`fetch-hubspot-live`)
**New Capabilities**: 4 (contacts sync, deals sync, owners sync, activity tracking)
**Deployment Status**: ✅ Ready
**Environment Dependencies**: HUBSPOT_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

**Key Benefits**:
- Automated HubSpot data sync
- Comprehensive logging
- Error resilience
- Flexible scheduling
- Real-time activity tracking

**Next Steps**:
1. Deploy function
2. Configure environment variables
3. Test each sync type
4. Schedule cron jobs
5. Monitor performance
