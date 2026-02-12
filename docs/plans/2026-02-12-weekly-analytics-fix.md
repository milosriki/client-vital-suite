# Weekly Analytics & Dashboard Data Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the broken weekly trend charts and remaining dashboard column mismatches so Analytics.tsx, Overview.tsx, and useDashboardData.ts display real data from production.

**Architecture:** Create a `weekly_health_summary` VIEW that aggregates the existing `daily_summary` table by ISO week. Update 3 frontend files to query from this VIEW instead of the broken `weekly_patterns` table. Fix 1 additional column mismatch in `useDashboardData.ts`.

**Tech Stack:** PostgreSQL VIEW, Supabase RLS GRANT, React/TypeScript, useDedupedQuery hook

---

## Context — Why This Is Needed

The production `weekly_patterns` table has a **per-client** schema (`client_id`, `week_start`, `pattern_summary` JSON, `ai_insights`). But 3 frontend files expect an **aggregate weekly** schema with columns like `red_clients`, `green_clients`, `avg_health_score`, etc. These columns don't exist in production, so all weekly trend charts show 0.

The `daily_summary` table DOES have daily zone counts (`clients_red`, `clients_yellow`, `clients_green`, `clients_purple`, `avg_health_score`, `total_clients`). We aggregate this by ISO week to power the weekly charts.

Additionally, `useDashboardData.ts` orders `coach_performance` by `avg_health_score` but the production column is `avg_client_health`.

## Key File References

| File | Production Schema Source |
|------|------------------------|
| `src/integrations/supabase/types.ts:2400` | `daily_summary` — has `clients_red`, `clients_yellow`, `clients_green`, `clients_purple`, `avg_health_score`, `total_clients`, `summary_date` |
| `src/integrations/supabase/types.ts:5961` | `weekly_patterns` — per-client: `client_id`, `week_start`, `ai_insights`, `pattern_summary` |
| `src/integrations/supabase/types.ts:1614` | `coach_performance` — has `avg_client_health` (NOT `avg_health_score`) |

---

### Task 1: Create `weekly_health_summary` VIEW migration

**Files:**
- Create: `supabase/migrations/20260213000003_weekly_health_summary.sql`

**Step 1: Write the migration SQL**

```sql
-- Weekly Health Summary VIEW
-- Aggregates daily_summary by ISO week to power weekly trend charts
-- Source: daily_summary table (populated by nightly health-score-calculator)

CREATE OR REPLACE VIEW public.weekly_health_summary AS
SELECT
  DATE_TRUNC('week', summary_date)::date AS week_start,
  (DATE_TRUNC('week', summary_date)::date + 6) AS week_end,
  ROUND(AVG(avg_health_score), 1) AS avg_health_score,
  MAX(total_clients) AS total_clients,
  ROUND(AVG(clients_red)) AS red_clients,
  ROUND(AVG(clients_yellow)) AS yellow_clients,
  ROUND(AVG(clients_green)) AS green_clients,
  ROUND(AVG(clients_purple)) AS purple_clients,
  COUNT(*) AS days_in_week
FROM public.daily_summary
WHERE summary_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE_TRUNC('week', summary_date)
ORDER BY week_start DESC;

-- Grants
GRANT SELECT ON public.weekly_health_summary TO authenticated;

COMMENT ON VIEW public.weekly_health_summary IS 'Weekly aggregation of daily_summary for trend charts. AVGs zone counts and health score per ISO week.';
```

**Step 2: Verify the file was created correctly**

Run: `cat supabase/migrations/20260213000003_weekly_health_summary.sql | head -20`
Expected: Shows the CREATE OR REPLACE VIEW statement

**Step 3: Commit**

```bash
git add supabase/migrations/20260213000003_weekly_health_summary.sql
git commit -m "feat: add weekly_health_summary VIEW aggregating daily_summary by week"
```

---

### Task 2: Fix Analytics.tsx — query `weekly_health_summary` instead of `weekly_patterns`

**Files:**
- Modify: `src/pages/Analytics.tsx:12-24` (weekly query)
- Modify: `src/pages/Analytics.tsx:57-64` (trendData mapping)

**Step 1: Update the weekly query (lines 12-25)**

Replace the `weekly_patterns` query with:

```typescript
const { data: weeklyData, isLoading: weeklyLoading, refetch } = useDedupedQuery({
  queryKey: ['weekly-analytics'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('weekly_health_summary' as any)
      .select('*')
      .order('week_start', { ascending: true })
      .limit(12);

    if (error) throw error;
    return (data || []) as any[];
  },
  staleTime: Infinity,
});
```

**Step 2: Update the trendData mapping (lines 57-64)**

The column names from the VIEW are `red_clients`, `yellow_clients`, `green_clients`, `purple_clients`, `avg_health_score`, `week_start` — which already match the existing mapping code. Only change needed is removing the `week_start_date` fallback:

```typescript
const trendData = weeklyData?.map((week: any) => ({
  week: new Date(week.week_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  avgScore: week.avg_health_score || 0,
  red: week.red_clients || 0,
  yellow: week.yellow_clients || 0,
  green: week.green_clients || 0,
  purple: week.purple_clients || 0,
})) || [];
```

**Step 3: Run build to verify**

Run: `npm run build 2>&1 | tail -5`
Expected: `✓ built in` with 0 errors

**Step 4: Commit**

```bash
git add src/pages/Analytics.tsx
git commit -m "fix: Analytics.tsx queries weekly_health_summary VIEW instead of broken weekly_patterns"
```

---

### Task 3: Fix useDashboardData.ts — coach_performance order + weekly query

**Files:**
- Modify: `src/hooks/useDashboardData.ts:49` (coach order column)
- Modify: `src/hooks/useDashboardData.ts:68-71` (weekly patterns query)

**Step 1: Fix coach_performance order column (line 49)**

Change:
```typescript
.order("avg_health_score", { ascending: false }),
```
To:
```typescript
.order("avg_client_health", { ascending: false }),
```

**Step 2: Fix weekly patterns query (lines 68-71)**

Change:
```typescript
// Query 4: Weekly Patterns
supabase
  .from("weekly_patterns")
  .select("*")
  .order("week_start_date", { ascending: false })
  .limit(4),
```
To:
```typescript
// Query 4: Weekly Health Summary
supabase
  .from("weekly_health_summary" as any)
  .select("*")
  .order("week_start", { ascending: false })
  .limit(4),
```

**Step 3: Run build to verify**

Run: `npm run build 2>&1 | tail -5`
Expected: `✓ built in` with 0 errors

**Step 4: Commit**

```bash
git add src/hooks/useDashboardData.ts
git commit -m "fix: useDashboardData queries weekly_health_summary + correct coach order column"
```

---

### Task 4: Fix Overview.tsx weekly patterns data source

**Files:**
- Modify: `src/pages/Overview.tsx:171-187` (weekly patterns query)

**Step 1: Update the weekly query**

Find the existing query:
```typescript
const { data: weeklyPatterns = [], refetch: refetchWeekly } = useDedupedQuery({
  queryKey: QUERY_KEYS.patterns.weekly,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("weekly_patterns")
      .select("*")
      .order("week_start_date", { ascending: false })
      .limit(4);

    if (error) throw error;
    return data || [];
  },
  staleTime: Infinity,
});
```

Replace with:
```typescript
const { data: weeklyPatterns = [], refetch: refetchWeekly } = useDedupedQuery({
  queryKey: QUERY_KEYS.patterns.weekly,
  queryFn: async () => {
    const { data, error } = await (supabase as any)
      .from("weekly_health_summary")
      .select("*")
      .order("week_start", { ascending: false })
      .limit(4);

    if (error) throw error;
    return data || [];
  },
  staleTime: Infinity,
});
```

**Step 2: Run build to verify**

Run: `npm run build 2>&1 | tail -5`
Expected: `✓ built in` with 0 errors

**Step 3: Commit**

```bash
git add src/pages/Overview.tsx
git commit -m "fix: Overview.tsx queries weekly_health_summary instead of broken weekly_patterns"
```

---

### Task 5: Final build verification

**Step 1: Run full build**

Run: `npm run build 2>&1 | tail -10`
Expected: `✓ built in` with 0 errors, 4661+ modules

**Step 2: Verify all changes**

Run: `git diff --stat`
Expected: 4 files changed:
- `supabase/migrations/20260213000003_weekly_health_summary.sql` (new)
- `src/pages/Analytics.tsx` (modified)
- `src/hooks/useDashboardData.ts` (modified)
- `src/pages/Overview.tsx` (modified)

---

## Post-Deploy Verification

After deploying the migration to Supabase:

```sql
-- Verify the VIEW returns data
SELECT * FROM weekly_health_summary LIMIT 5;

-- Verify weekly aggregation makes sense
SELECT week_start, total_clients, red_clients, green_clients, avg_health_score
FROM weekly_health_summary
ORDER BY week_start DESC
LIMIT 4;

-- Verify row count (should be ~12 rows for 90 days / 7 days per week)
SELECT COUNT(*) FROM weekly_health_summary;
```

## Known Limitation

The `clients_improving` and `clients_declining` columns that `WeeklyAnalytics.tsx` expects are NOT available from `daily_summary`. These will display as 0 until a nightly job computes week-over-week health zone transitions. This is acceptable — the critical data (zone counts, avg health score, trends) will work.
