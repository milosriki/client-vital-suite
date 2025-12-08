# Database Migrations Summary

**Deployment Date**: 2025-12-08
**Branch**: claude/audit-dashboard-services-019cYmrNzrFjTAnFURTn7yBM

---

## NEW MIGRATIONS IN THIS DEPLOYMENT

### Migration: `20251208000001_call_pattern_analysis.sql`
**File**: `/home/user/client-vital-suite/supabase/migrations/20251208000001_call_pattern_analysis.sql`
**Purpose**: Call Pattern Analysis System

#### 1. Columns Added to `client_health_scores`
```sql
ALTER TABLE client_health_scores
ADD COLUMN IF NOT EXISTS avg_calls_per_week NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS calls_this_week INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_pattern_check TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pattern_status TEXT DEFAULT 'NORMAL';
```

**Purpose**: Track client engagement patterns
- `avg_calls_per_week`: 30-day rolling average
- `calls_this_week`: Current week count (Monday-Sunday)
- `last_pattern_check`: Last time pattern was analyzed
- `pattern_status`: NORMAL | BELOW_PATTERN | ABOVE_PATTERN | PATTERN_BREAK

#### 2. New Table: `call_pattern_analysis`
```sql
CREATE TABLE IF NOT EXISTS call_pattern_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  analysis_date DATE NOT NULL,
  calls_this_week INTEGER DEFAULT 0,
  avg_calls_per_week NUMERIC DEFAULT 0,
  pattern_status TEXT DEFAULT 'NORMAL',
  deviation_pct NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Purpose**: Historical tracking of call frequency patterns
**Indexes**:
- `idx_pattern_client` on `client_email`
- `idx_pattern_date` on `analysis_date DESC`
- `idx_pattern_status` on `pattern_status`
- `idx_client_pattern_status` on `client_health_scores(pattern_status)`

**RLS Policies**: Public read, insert, update (using `true`)

#### 3. New Functions

**Function**: `get_week_start(target_date TIMESTAMPTZ)`
```sql
CREATE OR REPLACE FUNCTION get_week_start(target_date TIMESTAMPTZ DEFAULT NOW())
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN DATE_TRUNC('week', target_date);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```
**Purpose**: Helper function for week calculations

**Function**: `get_pattern_breaks(days_back INTEGER)`
```sql
CREATE OR REPLACE FUNCTION get_pattern_breaks(days_back INTEGER DEFAULT 7)
RETURNS TABLE(
  client_email TEXT,
  client_name TEXT,
  avg_calls_per_week NUMERIC,
  calls_this_week INTEGER,
  deviation_pct NUMERIC,
  pattern_status TEXT,
  health_zone TEXT,
  assigned_coach TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    chs.email,
    COALESCE(chs.firstname || ' ' || chs.lastname, chs.email) as client_name,
    chs.avg_calls_per_week,
    chs.calls_this_week,
    CASE
      WHEN chs.avg_calls_per_week > 0
      THEN ((chs.calls_this_week - chs.avg_calls_per_week) / chs.avg_calls_per_week) * 100
      ELSE 0
    END as deviation_pct,
    chs.pattern_status,
    chs.health_zone,
    chs.assigned_coach
  FROM client_health_scores chs
  WHERE chs.pattern_status IN ('PATTERN_BREAK', 'BELOW_PATTERN')
    AND chs.last_pattern_check >= NOW() - (days_back || ' days')::INTERVAL
  ORDER BY
    CASE chs.pattern_status
      WHEN 'PATTERN_BREAK' THEN 1
      WHEN 'BELOW_PATTERN' THEN 2
      ELSE 3
    END,
    (CASE WHEN chs.avg_calls_per_week > 0
      THEN ((chs.calls_this_week - chs.avg_calls_per_week) / chs.avg_calls_per_week) * 100
      ELSE 0
    END) ASC;
END;
$$ LANGUAGE plpgsql;
```

**Purpose**: Retrieve clients with broken engagement patterns
**Returns**: Prioritized list ordered by severity

#### 4. Triggers
```sql
CREATE TRIGGER update_call_pattern_analysis_updated_at
  BEFORE UPDATE ON call_pattern_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## EXISTING MIGRATIONS (Reference)

### Core System Tables (20251204000001_smart_agent_tables.sql)
- `agent_knowledge` - RAG knowledge base with vector embeddings
- `agent_conversations` - Chat history
- `agent_decisions` - Decision tracking and learning
- `proactive_insights` - Alert queue
- `agent_metrics` - Performance tracking

### Cron Schedules (20251205000001_setup_cron_schedules.sql)
- Daily 9:00 AM: Health scoring
- Daily 10:30 AM: Intervention generation
- Daily 11:00 AM: CAPI sync
- Every 6 hours: Proactive monitoring
- Daily 6:00 PM: Daily report
- Weekly Monday 8:00 AM: Coach analysis

### Other Tables (Previous Migrations)
- `client_health_scores` - Main health tracking
- `coach_performance` - Coach metrics
- `intervention_log` - Intervention tracking
- `daily_summary` - Daily aggregates
- `weekly_patterns` - Pattern detection
- `capi_events`, `capi_events_enriched` - Meta CAPI
- `leads`, `deals`, `appointments`, `staff` - Sales pipeline
- `contacts`, `companies` - CRM data
- 40+ more tables for attribution, analytics, etc.

---

## MIGRATION DEPLOYMENT COMMANDS

### Apply New Migration
```bash
# Using Supabase CLI
cd /home/user/client-vital-suite
supabase db push

# Or apply manually in Supabase Dashboard
# Dashboard → Database → SQL Editor
# Paste contents of 20251208000001_call_pattern_analysis.sql
```

### Verify Migration
```sql
-- Check new columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'client_health_scores'
  AND column_name IN ('avg_calls_per_week', 'calls_this_week', 'pattern_status', 'last_pattern_check');

-- Check new table exists
SELECT table_name FROM information_schema.tables
WHERE table_name = 'call_pattern_analysis';

-- Check new functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_name IN ('get_pattern_breaks', 'get_week_start');

-- Test function
SELECT * FROM get_pattern_breaks(7);
```

---

## DATA MIGRATION REQUIREMENTS

### No Data Migration Needed ✅
- New columns have default values
- New table starts empty
- Existing data preserved

### Population Strategy
Pattern data will be populated by:
1. **Manual**: Call analysis Edge Function
2. **Scheduled**: Cron job (to be created)
3. **On-Demand**: API endpoint trigger

**Recommended Cron Schedule**:
```sql
-- Daily at 8:00 AM: Analyze call patterns
SELECT cron.schedule(
  'daily-pattern-analysis',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/analyze-call-patterns',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## ROLLBACK PROCEDURE

If migration needs to be reverted:

```sql
-- 1. Drop triggers
DROP TRIGGER IF EXISTS update_call_pattern_analysis_updated_at ON call_pattern_analysis;

-- 2. Drop functions
DROP FUNCTION IF EXISTS get_pattern_breaks(INTEGER);
DROP FUNCTION IF EXISTS get_week_start(TIMESTAMPTZ);

-- 3. Drop table
DROP TABLE IF EXISTS call_pattern_analysis;

-- 4. Remove columns (WARNING: Data loss)
ALTER TABLE client_health_scores
  DROP COLUMN IF EXISTS avg_calls_per_week,
  DROP COLUMN IF EXISTS calls_this_week,
  DROP COLUMN IF EXISTS last_pattern_check,
  DROP COLUMN IF EXISTS pattern_status;
```

**⚠️ WARNING**: Rollback will delete all pattern analysis data.

---

## TESTING CHECKLIST

After applying migration:

- [ ] All columns exist on `client_health_scores`
- [ ] `call_pattern_analysis` table created
- [ ] Indexes created successfully
- [ ] RLS policies active
- [ ] `get_pattern_breaks()` function works
- [ ] `get_week_start()` function works
- [ ] No errors in database logs
- [ ] Existing queries still work

**Test Queries**:
```sql
-- Test 1: Check columns
SELECT avg_calls_per_week, calls_this_week, pattern_status
FROM client_health_scores LIMIT 5;

-- Test 2: Insert test record
INSERT INTO call_pattern_analysis (client_email, calls_this_week, avg_calls_per_week, pattern_status)
VALUES ('test@example.com', 1, 3, 'BELOW_PATTERN');

-- Test 3: Query function
SELECT * FROM get_pattern_breaks(30);

-- Test 4: Week calculation
SELECT get_week_start(NOW());
```

---

## PERFORMANCE IMPACT

### Database Size Increase
- `client_health_scores`: +4 columns (~20 bytes per row)
- `call_pattern_analysis`: New table (~100 bytes per row per analysis)
- Estimated: +1-5 MB for 1000 clients over 30 days

### Query Performance
- New indexes improve pattern queries
- Existing queries unaffected
- `get_pattern_breaks()` optimized with indexes

### Recommended Monitoring
```sql
-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('client_health_scores', 'call_pattern_analysis')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_pattern%'
ORDER BY idx_scan DESC;
```

---

## SUMMARY

**Migration Status**: ✅ Ready to Deploy
**Risk Level**: LOW
**Breaking Changes**: None
**Data Migration**: Not required
**Rollback Available**: Yes

**New Capabilities**:
- Call frequency tracking per client
- Pattern deviation detection
- Historical analysis
- Automated alerts for broken patterns

**Next Steps**:
1. Apply migration with `supabase db push`
2. Verify with test queries
3. Populate initial data (optional)
4. Schedule cron job for ongoing analysis
5. Monitor performance and adjust as needed
