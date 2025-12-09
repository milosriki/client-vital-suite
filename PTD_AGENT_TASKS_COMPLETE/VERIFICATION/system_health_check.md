# PTD Fitness - System Health Check

**Document Version**: 1.0
**Last Updated**: 2025-12-09
**Purpose**: Final verification checklist for PTD Fitness system upgrade

---

## Table of Contents

1. [Pre-Verification Checklist](#pre-verification-checklist)
2. [Task 19: Frontend Verification](#task-19-frontend-verification)
3. [Task 20: System Health Verification](#task-20-system-health-verification)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Rollback Procedures](#rollback-procedures)
6. [Success Criteria](#success-criteria)

---

## Pre-Verification Checklist

Before starting verification, ensure all previous tasks (1-18) are complete:

- [ ] All database migrations executed successfully
- [ ] All Edge Functions deployed to Supabase
- [ ] Frontend components built without errors
- [ ] Environment variables configured (ANTHROPIC_API_KEY, HUBSPOT_API_KEY)
- [ ] Supabase project is accessible and running

---

## Task 19: Frontend Verification

### Overview
Verify that all dashboard components are working correctly and displaying real-time data.

### 19.1 - Dashboard Loads Without Console Errors

**Step-by-Step Instructions:**

1. **Open the Application**
   ```bash
   # Start development server (if not already running)
   npm run dev
   ```

2. **Navigate to Dashboard**
   - Open browser to `http://localhost:5173` (or your configured port)
   - Navigate to the Dashboard page
   - Open browser DevTools (F12)
   - Switch to Console tab

3. **Check for Errors**
   - Look for any red error messages
   - Check Network tab for failed requests (status codes 4xx, 5xx)

**Expected Results:**
- ✅ Dashboard page loads within 2-3 seconds
- ✅ No red error messages in console
- ✅ No TypeScript compilation errors
- ✅ All API requests return 200 status codes
- ✅ Page renders completely without blank sections

**Common Issues & Solutions:**

| Issue | Solution |
|-------|----------|
| `Cannot read property 'map' of undefined` | Data query may be returning null. Check if `useQuery` has proper fallback values |
| `401 Unauthorized` | Check Supabase authentication. User may need to log in again |
| `404 Not Found` on API call | Verify Edge Function is deployed and URL is correct |
| `CORS error` | Check Supabase project settings allow requests from localhost |

---

### 19.2 - ErrorMonitor Component Visible

**Step-by-Step Instructions:**

1. **Locate ErrorMonitor Component**
   - On Dashboard page, look for error monitoring section
   - Should be visible near the top of the page
   - Component path: `/src/components/dashboard/ErrorMonitor.tsx`

2. **Verify Component Display**
   - Component should show one of two states:
     - **Green/Success**: "All Systems Operational"
     - **Red/Warning**: Error alert with details

3. **Test Error Detection**
   ```sql
   -- In Supabase SQL Editor, insert a test error:
   INSERT INTO sync_logs (service_name, status, error_message, created_at)
   VALUES ('test-service', 'error', 'Test error for verification', NOW());
   ```

4. **Refresh Dashboard**
   - ErrorMonitor should now show red alert
   - Error message should be visible
   - "Resolve" button should be present (if implemented)

**Expected Results:**
- ✅ ErrorMonitor component renders without crashing
- ✅ Shows real-time data from `sync_logs` table
- ✅ Displays errors from last 24 hours
- ✅ Updates automatically when new errors occur
- ✅ Red alert banner appears when errors exist

**Test Cleanup:**
```sql
-- Remove test error after verification
DELETE FROM sync_logs WHERE service_name = 'test-service';
```

**Common Issues & Solutions:**

| Issue | Solution |
|-------|----------|
| Component not visible | Check Dashboard.tsx imports ErrorMonitor component |
| "No data" error | Verify `sync_logs` table exists and has SELECT permissions |
| Component crashes on render | Check TypeScript types match database schema |
| Updates not real-time | Verify Supabase realtime is enabled for `sync_logs` table |

---

### 19.3 - SyncStatusBadge Shows Status

**Step-by-Step Instructions:**

1. **Locate SyncStatusBadge**
   - Look for status indicator (dot/badge) on Dashboard
   - Usually near header or in status panel
   - Component path: `/src/components/dashboard/SyncStatusBadge.tsx`

2. **Check Status Indicator**
   - **Green Dot + "Live"**: Last sync < 1 hour ago
   - **Yellow Dot + "Delayed"**: Last sync 1-24 hours ago
   - **Red Dot + "Stale"**: Last sync > 24 hours ago

3. **Verify Data Freshness**
   ```sql
   -- Check latest successful sync in Supabase SQL Editor:
   SELECT service_name, created_at, status
   FROM sync_logs
   WHERE status = 'success'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

4. **Test Badge Updates**
   - Trigger a manual sync (see Task 20.4)
   - Badge should update to "Green/Live" within 60 seconds
   - Hover over badge should show tooltip with last sync time

**Expected Results:**
- ✅ Badge displays correct color based on data freshness
- ✅ Tooltip shows exact timestamp of last sync
- ✅ Badge updates automatically (polling every 60 seconds)
- ✅ Text label matches status (Live/Delayed/Stale)
- ✅ Component handles case when no sync logs exist

**Common Issues & Solutions:**

| Issue | Solution |
|-------|----------|
| Badge always shows "Stale" | Verify `sync_logs` has recent entries with `status='success'` |
| Badge doesn't update | Check `refetchInterval` is set in useQuery (should be ~60000ms) |
| Tooltip doesn't appear | Verify hover events are properly bound |
| Wrong color displayed | Check timestamp comparison logic in component |

---

### 19.4 - Executive Briefing Card Populated

**Step-by-Step Instructions:**

1. **Locate Executive Briefing**
   - Look for "Executive Briefing" or "Daily Summary" card on Dashboard
   - Should display AI-generated insights
   - Data comes from `daily_summary.executive_briefing` column

2. **Verify Content Display**
   - Card should show:
     - Executive summary text (generated by AI)
     - System health status
     - Key metrics (utilization rate, etc.)
     - Action plan (Top 3 priorities)
     - Timestamp of when briefing was generated

3. **Check Data Source**
   ```sql
   -- Verify daily_summary has data:
   SELECT
     report_date,
     executive_briefing,
     system_health_status,
     max_utilization_rate,
     action_plan,
     created_at
   FROM daily_summary
   ORDER BY report_date DESC
   LIMIT 1;
   ```

4. **Trigger AI Generation (if empty)**
   ```bash
   # Manually trigger business-intelligence function:
   curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/business-intelligence' \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

**Expected Results:**
- ✅ Card displays formatted executive briefing text
- ✅ System health status shows "All Systems Go" or specific warnings
- ✅ Utilization metrics are displayed as percentages
- ✅ Action plan shows 3 prioritized items
- ✅ Timestamp indicates briefing is from today
- ✅ Content is readable and properly formatted

**Common Issues & Solutions:**

| Issue | Solution |
|-------|----------|
| Card is empty | Run `business-intelligence` function manually (see curl command above) |
| "Loading..." never completes | Check database query is returning data, verify table/column names |
| Briefing is outdated | Verify cron job is scheduled (see Task 20.1) |
| Formatting looks broken | Check if component handles markdown/HTML in briefing text |
| Action plan not showing | Verify `action_plan` column is JSONB and properly formatted |

---

### 19.5 - No TypeScript/Build Errors

**Step-by-Step Instructions:**

1. **Run Type Check**
   ```bash
   # In project root directory:
   npm run type-check
   # or
   npx tsc --noEmit
   ```

2. **Check for Warnings**
   ```bash
   npm run build
   ```

3. **Review Output**
   - Look for errors (❌ red)
   - Note warnings (⚠️ yellow) - acceptable but should be minimal
   - Check build completes successfully

**Expected Results:**
- ✅ `npm run type-check` completes with 0 errors
- ✅ `npm run build` succeeds and creates dist folder
- ✅ No "Cannot find module" errors
- ✅ No type mismatch errors
- ✅ Build size is reasonable (< 5MB for main bundle)
- ✅ All components export properly

**Common Issues & Solutions:**

| Issue | Solution |
|-------|----------|
| "Property does not exist on type" | Update TypeScript types in `src/integrations/supabase/types.ts` |
| "Module not found" | Run `npm install` to ensure all dependencies are installed |
| Build hangs/freezes | Clear cache: `rm -rf node_modules/.vite` and rebuild |
| Type errors in Supabase types | Regenerate types: `supabase gen types typescript --local > src/integrations/supabase/types.ts` |

---

## Task 20: System Health Verification

### Overview
Verify that all backend systems, cron jobs, and data pipelines are functioning correctly.

---

### 20.1 - All 3 Cron Jobs Scheduled

**Step-by-Step Instructions:**

1. **Access Supabase Dashboard**
   - Log in to https://supabase.com
   - Select your PTD Fitness project
   - Navigate to "Database" → "Extensions"
   - Verify `pg_cron` extension is enabled

2. **Check Scheduled Jobs**
   ```sql
   -- In Supabase SQL Editor, run:
   SELECT
     jobid,
     jobname,
     schedule,
     command,
     active
   FROM cron.job
   ORDER BY jobname;
   ```

3. **Verify Expected Jobs**

   | Job Name | Schedule | Function | Status |
   |----------|----------|----------|--------|
   | `business-intelligence-daily` | `0 7 * * *` (7 AM UTC daily) | `business-intelligence` | ✅ Active |
   | `lead-reply-every-2h` | `0 */2 * * *` (Every 2 hours) | `generate-lead-reply` | ✅ Active |
   | `hubspot-sync-hourly` | `0 * * * *` (Every hour) | `sync-hubspot-to-supabase` | ✅ Active |

4. **Check Job History**
   ```sql
   -- View recent job executions:
   SELECT
     jobid,
     runid,
     job_pid,
     database,
     username,
     command,
     status,
     return_message,
     start_time,
     end_time
   FROM cron.job_run_details
   ORDER BY start_time DESC
   LIMIT 20;
   ```

**Expected Results:**
- ✅ 3 cron jobs are present in `cron.job` table
- ✅ All jobs have `active = true`
- ✅ Schedule syntax matches expected cron expressions
- ✅ Job commands point to correct Edge Functions
- ✅ Recent job runs show successful executions

**Manual Job Trigger (for testing):**
```sql
-- Trigger a job manually:
SELECT cron.schedule('test-run', '* * * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/business-intelligence',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  )$$
);

-- Wait 1 minute, then remove test job:
SELECT cron.unschedule('test-run');
```

**Common Issues & Solutions:**

| Issue | Solution |
|-------|----------|
| `pg_cron` not found | Enable extension: `CREATE EXTENSION IF NOT EXISTS pg_cron;` |
| Jobs not running | Check `active` column is true, verify service role key is correct |
| Jobs failing with 401 | Update Authorization header with valid service_role_key |
| Jobs not in list | Run migration: `supabase/migrations/20251205000001_setup_cron_schedules.sql` |
| Timezone confusion | Cron runs in UTC. Convert to your local time zone for expectations |

---

### 20.2 - sync_logs Receiving Entries

**Step-by-Step Instructions:**

1. **Check Table Exists**
   ```sql
   -- Verify sync_logs table structure:
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'sync_logs'
   ORDER BY ordinal_position;
   ```

   Expected columns:
   - `id` (uuid)
   - `service_name` (text)
   - `status` (text: 'success', 'error', 'warning')
   - `error_message` (text, nullable)
   - `metadata` (jsonb, nullable)
   - `created_at` (timestamp)

2. **Check for Recent Entries**
   ```sql
   -- View recent sync logs:
   SELECT
     id,
     service_name,
     status,
     error_message,
     created_at,
     metadata
   FROM sync_logs
   ORDER BY created_at DESC
   LIMIT 20;
   ```

3. **Verify Log Coverage**
   ```sql
   -- Check which services are logging:
   SELECT
     service_name,
     status,
     COUNT(*) as log_count,
     MAX(created_at) as last_logged
   FROM sync_logs
   GROUP BY service_name, status
   ORDER BY service_name, status;
   ```

4. **Test Manual Logging**
   ```sql
   -- Insert test log entry:
   INSERT INTO sync_logs (service_name, status, metadata)
   VALUES (
     'system-health-check',
     'success',
     jsonb_build_object(
       'test', true,
       'timestamp', NOW(),
       'verification_step', '20.2'
     )
   );
   ```

**Expected Results:**
- ✅ `sync_logs` table exists with correct schema
- ✅ Table contains entries from last 24 hours
- ✅ Multiple services are logging (hubspot-sync, business-intelligence, etc.)
- ✅ Mix of success and error statuses (errors are normal, but should be < 10%)
- ✅ Metadata contains useful debugging information
- ✅ No gaps > 1 hour in logging (services should log regularly)

**Performance Check:**
```sql
-- Verify indexes exist for fast queries:
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'sync_logs';
```

Expected indexes:
- Index on `created_at` (for time-based queries)
- Index on `status` (for filtering errors)
- Index on `service_name` (for service-specific logs)

**Common Issues & Solutions:**

| Issue | Solution |
|-------|----------|
| Table doesn't exist | Run migration: `supabase/migrations/20251209_phase1_foundation.sql` |
| No entries in last 24h | Manually trigger functions (see Task 20.4) or check cron jobs |
| Only test entries | Verify Edge Functions are calling logging utility correctly |
| Duplicate entries | Check if functions are being triggered multiple times |
| Missing metadata | Update functions to include `metadata` parameter when logging |

---

### 20.3 - Leads Getting ai_suggested_reply

**Step-by-Step Instructions:**

1. **Check Column Exists**
   ```sql
   -- Verify ai_suggested_reply column:
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'leads'
     AND column_name = 'ai_suggested_reply';
   ```

2. **Check AI Replies Generated**
   ```sql
   -- Find leads with AI replies:
   SELECT
     id,
     name,
     email,
     status,
     ai_suggested_reply,
     created_at,
     updated_at
   FROM leads
   WHERE ai_suggested_reply IS NOT NULL
   ORDER BY updated_at DESC
   LIMIT 10;
   ```

3. **Verify Reply Quality**
   - Review sample AI replies
   - Check that replies are:
     - Personalized (mention lead name)
     - Relevant to lead's inquiry
     - Professional tone
     - Actionable (include next steps)
     - Reasonable length (100-300 words)

4. **Check Coverage Rate**
   ```sql
   -- Calculate percentage of leads with AI replies:
   SELECT
     COUNT(*) as total_leads,
     COUNT(ai_suggested_reply) as leads_with_ai_reply,
     ROUND(100.0 * COUNT(ai_suggested_reply) / COUNT(*), 2) as coverage_percentage
   FROM leads
   WHERE created_at > NOW() - INTERVAL '7 days';
   ```

5. **Test Manual Generation**
   ```bash
   # Trigger generate-lead-reply function:
   curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/generate-lead-reply' \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"limit": 5}'
   ```

**Expected Results:**
- ✅ `ai_suggested_reply` column exists on `leads` table
- ✅ At least 50% of new leads (< 7 days old) have AI replies
- ✅ Replies are unique and personalized (not generic templates)
- ✅ Replies are in English (or configured language)
- ✅ No replies are empty strings or placeholder text
- ✅ Replies mention the lead's name and context

**Quality Checks:**
```sql
-- Find potentially problematic replies:
SELECT id, name, ai_suggested_reply
FROM leads
WHERE ai_suggested_reply IS NOT NULL
  AND (
    LENGTH(ai_suggested_reply) < 50  -- Too short
    OR LENGTH(ai_suggested_reply) > 1000  -- Too long
    OR ai_suggested_reply LIKE '%[placeholder]%'  -- Contains placeholders
    OR ai_suggested_reply LIKE '%TODO%'  -- Contains TODOs
  )
LIMIT 10;
```

**Common Issues & Solutions:**

| Issue | Solution |
|-------|----------|
| Column doesn't exist | Run migration: `supabase/migrations/20251209_executive_intelligence.sql` |
| No AI replies generated | Check ANTHROPIC_API_KEY is set in Supabase Edge Function secrets |
| All replies are identical | Verify function is passing lead-specific context to Claude API |
| Replies are cut off | Check token limit in API call (should be 1000-2000) |
| Low coverage rate | Verify cron job is running every 2 hours (see Task 20.1) |
| 401 errors in logs | Verify Anthropic API key is valid and has credits |

---

### 20.4 - HubSpot Sync Completing Successfully

**Step-by-Step Instructions:**

1. **Check HubSpot Connection**
   ```sql
   -- Verify HubSpot credentials are configured:
   SELECT key, value
   FROM system_settings
   WHERE key LIKE 'hubspot%';
   ```

2. **Trigger Manual Sync**
   ```bash
   # Test sync function:
   curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/sync-hubspot-to-supabase' \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"dry_run": false}' \
     -v
   ```

3. **Check Sync Results**
   ```sql
   -- View latest sync log:
   SELECT *
   FROM sync_logs
   WHERE service_name = 'hubspot-sync'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

4. **Verify Data Synced**
   ```sql
   -- Check hubspot_contacts table:
   SELECT
     COUNT(*) as total_contacts,
     COUNT(DISTINCT vid) as unique_contacts,
     MAX(updated_at) as last_updated
   FROM hubspot_contacts;

   -- Check recent updates:
   SELECT
     vid,
     firstname,
     lastname,
     email,
     lifecyclestage,
     updated_at
   FROM hubspot_contacts
   ORDER BY updated_at DESC
   LIMIT 10;
   ```

5. **Compare with HubSpot**
   - Log in to HubSpot
   - Go to Contacts
   - Compare contact count with database
   - Verify recent contacts appear in both systems

**Expected Results:**
- ✅ Sync completes without errors (HTTP 200 response)
- ✅ `sync_logs` shows 'success' status for hubspot-sync
- ✅ `hubspot_contacts` table has data
- ✅ Contact count matches HubSpot (±5% variance acceptable)
- ✅ Recent contacts (< 1 day old) are present
- ✅ Contact fields are populated (not all NULL)
- ✅ Sync completes in < 60 seconds

**Performance Metrics:**
```sql
-- Analyze sync performance:
SELECT
  service_name,
  status,
  metadata->>'duration_ms' as duration,
  metadata->>'records_processed' as records,
  created_at
FROM sync_logs
WHERE service_name = 'hubspot-sync'
ORDER BY created_at DESC
LIMIT 10;
```

**Common Issues & Solutions:**

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Verify HUBSPOT_API_KEY is set and valid in Edge Function secrets |
| 429 Rate Limited | HubSpot API limits reached. Wait 10 minutes and retry |
| Timeout | Increase function timeout in `supabase/functions/sync-hubspot-to-supabase/index.ts` |
| No data synced | Check HubSpot API permissions include contacts.read |
| Duplicate contacts | Check upsert logic uses `vid` as unique identifier |
| Missing fields | Update field mappings in sync function |
| Sync takes > 2 minutes | Implement pagination/batching for large contact lists |

---

### 20.5 - No Errors in Supabase Function Logs

**Step-by-Step Instructions:**

1. **Access Function Logs**
   - Go to Supabase Dashboard
   - Navigate to "Edge Functions"
   - Click on each function to view logs
   - Check logs for last 24 hours

2. **Check Critical Functions**

   Functions to verify:
   - ✅ `business-intelligence`
   - ✅ `generate-lead-reply`
   - ✅ `sync-hubspot-to-supabase`
   - ✅ `health-calculator`
   - ✅ `intervention-recommender`
   - ✅ `daily-report`

3. **Review Log Levels**
   - **INFO**: Normal operation (✅ expected)
   - **WARN**: Potential issues (⚠️ investigate if frequent)
   - **ERROR**: Failed operations (❌ must fix)

4. **Query Logs Programmatically**
   ```bash
   # Using Supabase CLI:
   supabase functions logs business-intelligence --tail
   ```

5. **Check for Common Error Patterns**
   - Database connection errors
   - API authentication failures
   - Timeout errors
   - Type/null reference errors
   - Rate limiting errors

**Expected Results:**
- ✅ No ERROR-level logs in last 24 hours
- ✅ WARN logs < 5% of total logs
- ✅ All functions have recent logs (indicates they're running)
- ✅ Response times < 10 seconds for most requests
- ✅ No repeating error patterns
- ✅ Memory usage within limits (< 512MB)

**Log Analysis Queries:**
```sql
-- Check for error patterns in sync_logs:
SELECT
  service_name,
  error_message,
  COUNT(*) as error_count
FROM sync_logs
WHERE status = 'error'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY service_name, error_message
ORDER BY error_count DESC;
```

**Common Issues & Solutions:**

| Issue | Solution |
|-------|----------|
| "Cannot connect to database" | Check database connection string and credentials |
| "API key is missing" | Set environment variables in Supabase Edge Function secrets |
| "Timeout exceeded" | Optimize query or increase function timeout |
| "Out of memory" | Reduce batch size or optimize data processing |
| "CORS error" | Add allowed origins in Supabase project settings |
| "Too many requests" | Implement rate limiting or request queuing |

---

## Troubleshooting Guide

### General Debugging Steps

1. **Check Service Status**
   ```sql
   -- Overall system health:
   SELECT
     service_name,
     MAX(created_at) as last_run,
     COUNT(*) FILTER (WHERE status = 'error') as error_count,
     COUNT(*) FILTER (WHERE status = 'success') as success_count
   FROM sync_logs
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY service_name;
   ```

2. **Review Recent Errors**
   ```sql
   SELECT *
   FROM sync_logs
   WHERE status = 'error'
     AND created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC
   LIMIT 20;
   ```

3. **Check Database Connections**
   ```sql
   -- View active connections:
   SELECT
     datname,
     usename,
     application_name,
     state,
     COUNT(*)
   FROM pg_stat_activity
   WHERE datname = current_database()
   GROUP BY datname, usename, application_name, state;
   ```

---

### Issue: Dashboard Not Loading

**Symptoms:**
- Blank page
- Infinite loading spinner
- "Network error" message

**Diagnosis:**
1. Check browser console for errors
2. Verify network tab shows API requests
3. Check Supabase project status

**Solutions:**
```bash
# Clear cache and rebuild:
npm run clean
rm -rf node_modules/.vite
npm install
npm run dev

# Check if Supabase is running:
curl https://YOUR_PROJECT.supabase.co/rest/v1/
```

---

### Issue: Cron Jobs Not Running

**Symptoms:**
- No recent entries in sync_logs
- Stale data in dashboard
- Cron job_run_details shows failures

**Diagnosis:**
```sql
-- Check job status:
SELECT * FROM cron.job WHERE active = false;

-- Check recent failures:
SELECT * FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 10;
```

**Solutions:**
```sql
-- Re-enable jobs:
UPDATE cron.job SET active = true WHERE active = false;

-- Reschedule jobs:
-- Run: supabase/migrations/20251205000001_setup_cron_schedules.sql
```

---

### Issue: AI Not Generating Replies

**Symptoms:**
- `ai_suggested_reply` is NULL for all new leads
- Function logs show 401 or 500 errors
- Claude API errors in logs

**Diagnosis:**
```bash
# Check if API key is set:
supabase secrets list

# Test API key directly:
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: YOUR_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":100,"messages":[{"role":"user","content":"test"}]}'
```

**Solutions:**
1. Set/update Anthropic API key:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```

2. Redeploy function:
   ```bash
   supabase functions deploy generate-lead-reply
   ```

3. Check API credits:
   - Log in to https://console.anthropic.com
   - Verify account has available credits

---

### Issue: HubSpot Sync Failing

**Symptoms:**
- `hubspot_contacts` not updating
- 401/403 errors in logs
- Rate limit errors

**Diagnosis:**
```bash
# Test HubSpot API:
curl https://api.hubapi.com/crm/v3/objects/contacts?limit=1 \
  -H "Authorization: Bearer YOUR_HUBSPOT_TOKEN"
```

**Solutions:**

1. **401 Unauthorized:**
   ```bash
   # Update HubSpot token:
   supabase secrets set HUBSPOT_API_KEY=pat-na1-...
   ```

2. **403 Forbidden:**
   - Check HubSpot app permissions
   - Ensure "contacts" scope is enabled

3. **429 Rate Limited:**
   ```typescript
   // Add rate limiting in sync function:
   await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
   ```

4. **Timeout:**
   - Implement pagination
   - Process in smaller batches
   - Increase function timeout

---

### Issue: Frontend Build Errors

**Symptoms:**
- TypeScript compilation errors
- Vite build failures
- Missing type definitions

**Solutions:**
```bash
# Regenerate Supabase types:
supabase gen types typescript --local > src/integrations/supabase/types.ts

# Clear cache and rebuild:
rm -rf node_modules/.vite
npm run build

# Fix common TypeScript errors:
# Add "skipLibCheck": true to tsconfig.json if needed
```

---

## Rollback Procedures

### When to Rollback

Rollback if you encounter:
- Critical system failures
- Data corruption
- Irreversible errors
- Performance degradation > 50%
- Security vulnerabilities

### Rollback Checklist

- [ ] Document the issue (screenshots, logs, error messages)
- [ ] Notify team members
- [ ] Stop all cron jobs
- [ ] Execute rollback steps
- [ ] Verify system stability
- [ ] Create incident report

---

### Rollback Step 1: Disable Cron Jobs

**Prevent further automated operations:**

```sql
-- Disable all cron jobs:
UPDATE cron.job SET active = false;

-- Verify jobs are disabled:
SELECT jobname, active FROM cron.job;
```

**Expected Result:** All jobs show `active = false`

---

### Rollback Step 2: Revert Database Changes

**Option A: Revert Recent Migrations**

```bash
# Using Supabase CLI:
supabase db reset

# Or manually:
supabase migration list
supabase migration revert
```

**Option B: Manual Cleanup**

```sql
-- Remove new tables (if needed):
DROP TABLE IF EXISTS sync_logs CASCADE;
DROP TABLE IF EXISTS sync_queue CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;

-- Remove new columns (if needed):
ALTER TABLE daily_summary
  DROP COLUMN IF EXISTS executive_briefing,
  DROP COLUMN IF EXISTS system_health_status,
  DROP COLUMN IF EXISTS max_utilization_rate,
  DROP COLUMN IF EXISTS action_plan;

ALTER TABLE leads
  DROP COLUMN IF EXISTS ai_suggested_reply;

-- Remove cron schedules:
SELECT cron.unschedule('business-intelligence-daily');
SELECT cron.unschedule('lead-reply-every-2h');
SELECT cron.unschedule('hubspot-sync-hourly');
```

**Expected Result:** Database schema returns to pre-upgrade state

---

### Rollback Step 3: Revert Code Changes

```bash
# View recent commits:
git log --oneline -10

# Revert to specific commit:
git revert <commit-hash>

# Or reset to previous version:
git reset --hard <commit-hash>
git push --force-with-lease origin main

# Redeploy previous version:
npm run build
supabase functions deploy --all
```

**Expected Result:** Application returns to previous working version

---

### Rollback Step 4: Remove Edge Functions

```bash
# Delete new Edge Functions:
supabase functions delete business-intelligence
supabase functions delete generate-lead-reply
supabase functions delete sync-hubspot-to-supabase

# Or redeploy previous versions:
git checkout <previous-commit> supabase/functions/
supabase functions deploy --all
```

**Expected Result:** Only original functions remain deployed

---

### Rollback Step 5: Restore from Backup (if needed)

```bash
# If you have a backup:
supabase db dump > backup.sql

# Restore from backup:
psql -h YOUR_DB_HOST -U postgres -d postgres < backup.sql

# Or use Supabase dashboard:
# Database > Backups > Restore
```

**Expected Result:** Database restored to backup state

---

### Rollback Step 6: Verify System Stability

```sql
-- Run health checks:
SELECT COUNT(*) FROM hubspot_contacts;
SELECT COUNT(*) FROM leads;
SELECT COUNT(*) FROM daily_summary;

-- Verify data integrity:
SELECT
  table_name,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY table_name;
```

**Expected Result:** All core tables have data, no anomalies

---

### Post-Rollback Actions

1. **Create Incident Report**
   - Document what went wrong
   - Include error logs and screenshots
   - Identify root cause
   - Propose preventive measures

2. **Notify Stakeholders**
   - Inform team of rollback
   - Explain impact and resolution
   - Provide timeline for fix

3. **Test in Staging**
   - Before re-deploying, test thoroughly in staging
   - Create test cases for failure scenarios
   - Document testing results

4. **Plan Re-deployment**
   - Address root cause
   - Update deployment procedure
   - Schedule maintenance window
   - Prepare rollback plan v2

---

## Success Criteria

### Task 19: Frontend Verification - Success Criteria

All items must be checked ✅:

- [ ] Dashboard loads in < 3 seconds without console errors
- [ ] ErrorMonitor component visible and functional
- [ ] SyncStatusBadge displays correct status with real-time updates
- [ ] Executive Briefing card shows AI-generated content
- [ ] TypeScript compilation completes without errors
- [ ] Production build succeeds (npm run build)
- [ ] All components render on different screen sizes (responsive)
- [ ] No memory leaks detected in browser DevTools
- [ ] Authentication works correctly
- [ ] All links and navigation function properly

**Sign-off:** ___________________ Date: ___________

---

### Task 20: System Health - Success Criteria

All items must be checked ✅:

- [ ] 3 cron jobs scheduled and active in Supabase
- [ ] sync_logs table receiving entries regularly (< 1 hour gaps)
- [ ] At least 50% of new leads have `ai_suggested_reply`
- [ ] HubSpot sync completing successfully (HTTP 200)
- [ ] hubspot_contacts table updated in last hour
- [ ] No ERROR-level logs in Edge Functions (last 24h)
- [ ] All database migrations applied successfully
- [ ] API response times < 5 seconds (P95)
- [ ] System handles 100+ concurrent users
- [ ] Data accuracy ≥ 95% (compared to HubSpot source)

**Sign-off:** ___________________ Date: ___________

---

## Final Approval

### System Health Status: [ ] PASS / [ ] FAIL

**If PASS:**
- [ ] All verification steps completed
- [ ] Both Task 19 and Task 20 success criteria met
- [ ] Documentation updated
- [ ] Team trained on new features
- [ ] Monitoring alerts configured
- [ ] Backup and rollback procedures tested

**Approved by:** ___________________ Date: ___________

**If FAIL:**
- Refer to Troubleshooting Guide
- Execute Rollback Procedures if necessary
- Document issues and create action plan
- Reschedule verification after fixes

---

## Additional Resources

### Useful SQL Queries

```sql
-- System health overview:
CREATE OR REPLACE VIEW system_health_overview AS
SELECT
  (SELECT COUNT(*) FROM sync_logs WHERE created_at > NOW() - INTERVAL '24 hours') as logs_24h,
  (SELECT COUNT(*) FROM sync_logs WHERE status = 'error' AND created_at > NOW() - INTERVAL '24 hours') as errors_24h,
  (SELECT COUNT(*) FROM leads WHERE ai_suggested_reply IS NOT NULL) as leads_with_ai,
  (SELECT MAX(created_at) FROM hubspot_contacts) as last_hubspot_sync,
  (SELECT COUNT(*) FROM cron.job WHERE active = true) as active_cron_jobs;

-- View the dashboard:
SELECT * FROM system_health_overview;
```

### Monitoring Dashboard

Create a monitoring view in Supabase:

```sql
CREATE OR REPLACE FUNCTION get_system_metrics()
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_leads', (SELECT COUNT(*) FROM leads),
    'ai_coverage', (SELECT ROUND(100.0 * COUNT(ai_suggested_reply) / COUNT(*), 2) FROM leads),
    'sync_health', (SELECT COUNT(*) FROM sync_logs WHERE status = 'success' AND created_at > NOW() - INTERVAL '1 hour'),
    'error_rate', (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'error') / COUNT(*), 2) FROM sync_logs WHERE created_at > NOW() - INTERVAL '24 hours'),
    'last_briefing', (SELECT MAX(created_at) FROM daily_summary WHERE executive_briefing IS NOT NULL)
  ) INTO result;

  RETURN result;
END;
$$;

-- Usage:
SELECT get_system_metrics();
```

---

## Document Change Log

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-12-09 | Initial creation - Tasks 19 & 20 | PTD System Agent |

---

**End of System Health Check Document**
