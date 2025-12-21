# PTD FITNESS - ROLLBACK PROCEDURES

## Emergency Full Rollback

If everything needs to be undone:

```bash
# 1. Git revert
git checkout main
git reset --hard HEAD~20

# 2. Database rollback
psql $DATABASE_URL << 'SQL'
DROP TABLE IF EXISTS sync_errors CASCADE;
DROP TABLE IF EXISTS hubspot_property_definitions CASCADE;
DROP TABLE IF EXISTS agent_context CASCADE;

DROP FUNCTION IF EXISTS update_sync_errors_updated_at CASCADE;

SELECT cron.unschedule('daily-business-intelligence');
SELECT cron.unschedule('midday-business-intelligence');
SELECT cron.unschedule('generate-lead-replies');
SELECT cron.unschedule('cleanup-old-errors');
SQL

# 3. Delete functions
supabase functions delete business-intelligence
supabase functions delete generate-lead-replies
```

## Individual Task Rollbacks

### Task 1: sync_errors table
```sql
DROP TABLE IF EXISTS sync_errors CASCADE;
DROP FUNCTION IF EXISTS update_sync_errors_updated_at CASCADE;
```

### Task 2: property cache
```sql
DROP TABLE IF EXISTS hubspot_property_definitions CASCADE;
```

### Task 3: agent context
```sql
DROP TABLE IF EXISTS agent_context CASCADE;
```

### Task 4: indexes
```sql
DROP INDEX IF EXISTS idx_health_zone_date;
DROP INDEX IF EXISTS idx_risk_category;
DROP INDEX IF EXISTS idx_coach_date;
DROP INDEX IF EXISTS idx_leads_status_created;
DROP INDEX IF EXISTS idx_leads_ai_reply;
DROP INDEX IF EXISTS idx_intervention_status;
```

### Task 5: daily_summary fixes
```sql
ALTER TABLE daily_summary DROP CONSTRAINT IF EXISTS valid_utilization;
-- Note: Cannot easily remove primary key if data exists
```

### Task 6: HubSpot Sync Manager
```bash
rm supabase/functions/_shared/hubspot-sync-manager.ts
```

### Task 7: Error Monitor Panel
```bash
rm src/components/dashboard/ErrorMonitorPanel.tsx
```

### Task 8: Sync Status Badge
```bash
rm src/components/dashboard/HubSpotSyncStatus.tsx
```

### Task 9: business-intelligence improvements
```bash
cd supabase/functions/business-intelligence
cp index.ts.backup index.ts
supabase functions deploy business-intelligence
```

### Task 10: Lead replies function
```bash
supabase functions delete generate-lead-replies
rm -rf supabase/functions/generate-lead-replies
```

### Task 11-13: Cron jobs
```sql
SELECT cron.unschedule('daily-business-intelligence');
SELECT cron.unschedule('midday-business-intelligence');
SELECT cron.unschedule('generate-lead-replies');
SELECT cron.unschedule('cleanup-old-errors');
```

### Task 14-15: Dashboard integrations
```bash
git checkout src/pages/Dashboard.tsx
# Or manually remove the import and component lines
```

## Verification After Rollback

```sql
-- Check tables removed
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('sync_errors', 'hubspot_property_definitions', 'agent_context');
-- Should return 0 rows

-- Check cron jobs removed
SELECT * FROM cron.job WHERE jobname LIKE '%intelligence%' OR jobname LIKE '%lead%';
-- Should return 0 rows
```

```bash
# Check dashboard compiles
npm run build
# Should succeed

# Check functions removed
supabase functions list
# Should not show generate-lead-replies
```
