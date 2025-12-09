#!/bin/bash

# Create Task Files Directory
mkdir -p AGENT_TASKS

echo "Generating 20 Detailed Agent Tasks..."

# ==========================================
# PHASE 1: FOUNDATION (Database)
# ==========================================

# Task 1: Sync Logs Table
cat > AGENT_TASKS/TASK_01_sync_errors_table.md << 'EOF'
# Task 01: Create Sync Logs Table

## Context
We need a central place to track errors from HubSpot, Stripe, and internal systems.

## Action
1. Open Supabase SQL Editor.
2. Run this SQL:
```sql
CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL, -- 'hubspot', 'stripe', 'system'
    status TEXT NOT NULL, -- 'success', 'error', 'warning'
    message TEXT,
    error_details JSONB,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON public.sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON public.sync_logs(started_at DESC);
```
## Verification
- Check that the table `sync_logs` exists in the Table Editor.
EOF

# Task 2: Sync Queue
cat > AGENT_TASKS/TASK_02_sync_queue_table.md << 'EOF'
# Task 02: Create Sync Queue Table

## Context
To prevent HubSpot API rate limits (429 errors), we need a queue system.

## Action
1. Open Supabase SQL Editor.
2. Run this SQL:
```sql
CREATE TABLE IF NOT EXISTS public.sync_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type TEXT NOT NULL, -- 'sync_contacts', 'sync_deals'
    payload JSONB,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    attempts INTEGER DEFAULT 0,
    next_attempt_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status_next ON public.sync_queue(status, next_attempt_at);
```
EOF

# Task 3: System Settings
cat > AGENT_TASKS/TASK_03_system_settings.md << 'EOF'
# Task 03: Create System Settings Table

## Context
Store configuration like "Last Sync Time" or "Feature Flags" without redeploying code.

## Action
1. Open Supabase SQL Editor.
2. Run this SQL:
```sql
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by TEXT
);
```
EOF

# Task 4: Indexes (Included in 1 & 2, but explicit check)
cat > AGENT_TASKS/TASK_04_performance_indexes.md << 'EOF'
# Task 04: Verify Performance Indexes

## Context
Ensure queries for the dashboard are fast (<100ms).

## Action
1. Run this SQL to ensure all foreign keys and status fields are indexed:
```sql
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON public.daily_summary(summary_date DESC);
```
EOF

# Task 5: Cleanup Function
cat > AGENT_TASKS/TASK_05_cleanup_function.md << 'EOF'
# Task 05: Auto-Cleanup Function

## Context
Prevent the logs table from growing infinitely.

## Action
1. Run this SQL:
```sql
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.sync_logs WHERE started_at < now() - INTERVAL '30 days';
    DELETE FROM public.sync_queue WHERE status IN ('completed', 'failed') AND created_at < now() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
```
EOF

# ==========================================
# PHASE 2: CORE FEATURES (Backend Logic)
# ==========================================

# Task 6: HubSpot Manager
cat > AGENT_TASKS/TASK_06_hubspot_manager.md << 'EOF'
# Task 06: Create HubSpot Sync Manager

## Context
A reusable TypeScript class to handle HubSpot API calls with rate limiting.

## Action
1. Create file `supabase/functions/_shared/hubspot-manager.ts`.
2. Implement a class `HubSpotManager` that:
   - Accepts `HUBSPOT_API_KEY`.
   - Has methods `fetchContacts`, `fetchDeals`.
   - Implements "Backoff & Retry" logic (wait 1s, then 2s, then 4s if rate limited).
   - Logs every error to `sync_logs` table.
EOF

# Task 7: Error Monitor Component
cat > AGENT_TASKS/TASK_07_error_monitor_ui.md << 'EOF'
# Task 07: Create Error Monitor Component

## Context
A React component to show system health on the Dashboard.

## Action
1. Create file `src/components/dashboard/ErrorMonitor.tsx`.
2. Use `useQuery` to fetch from `sync_logs` where `status = 'error'`.
3. Display a red alert banner if there are errors in the last 24h.
4. Show a "Resolve" button that marks the log as 'resolved' (optional).
EOF

# Task 8: Sync Status Badge
cat > AGENT_TASKS/TASK_08_sync_status_badge.md << 'EOF'
# Task 08: Create Sync Status Badge

## Context
A visual indicator that tells the user "Data is Fresh".

## Action
1. Create file `src/components/dashboard/SyncStatusBadge.tsx`.
2. Fetch the latest `success` log from `sync_logs`.
3. If < 1 hour ago: Show Green Dot "Live".
4. If > 24 hours ago: Show Red Dot "Stale".
EOF

# Task 9: Update Business Intelligence
cat > AGENT_TASKS/TASK_09_update_bi_agent.md << 'EOF'
# Task 09: Upgrade Business Intelligence Agent

## Context
Add "Stale Data" detection to the daily briefing.

## Action
1. Edit `supabase/functions/business-intelligence/index.ts`.
2. Add a query to check `sync_logs` for the last successful sync.
3. If last sync > 24h, inject a "CRITICAL WARNING" into the prompt sent to Claude.
4. Ensure the AI mentions this in the `system_status` JSON field.
EOF

# Task 10: Lead Reply Agent
cat > AGENT_TASKS/TASK_10_lead_reply_agent.md << 'EOF'
# Task 10: Create Lead Reply Agent

## Context
Separate the lead reply logic into its own dedicated function for better scaling.

## Action
1. Create `supabase/functions/generate-lead-reply/index.ts`.
2. Move the "Phase 3" logic from `business-intelligence` to here.
3. Add logic to mark leads as `processing` so we don't double-reply.
4. Use `Deno.env.get('ANTHROPIC_API_KEY')` to generate personalized replies.
EOF

# ==========================================
# PHASE 3: AUTOMATION (Connecting it all)
# ==========================================

# Task 11: Schedule BI Agent
cat > AGENT_TASKS/TASK_11_schedule_bi.md << 'EOF'
# Task 11: Schedule Daily Briefing

## Context
Run the intelligence agent every morning.

## Action
1. Open Supabase Dashboard > Edge Functions.
2. Select `business-intelligence`.
3. Enable "Enforce JWT Verification" (Security).
4. Add Cron Schedule: `0 7 * * *` (Every day at 7:00 AM UTC).
EOF

# Task 12: Schedule Lead Replies
cat > AGENT_TASKS/TASK_12_schedule_leads.md << 'EOF'
# Task 12: Schedule Lead Replies

## Context
Process new leads frequently.

## Action
1. Open Supabase Dashboard > Edge Functions.
2. Select `generate-lead-reply`.
3. Add Cron Schedule: `0 */2 * * *` (Every 2 hours).
EOF

# Task 13: Schedule HubSpot Sync
cat > AGENT_TASKS/TASK_13_schedule_sync.md << 'EOF'
# Task 13: Schedule HubSpot Sync

## Context
Keep data fresh.

## Action
1. Open Supabase Dashboard > Edge Functions.
2. Select `sync-hubspot-to-supabase`.
3. Add Cron Schedule: `0 * * * *` (Every hour).
EOF

# Task 14: Dashboard Integration (Errors)
cat > AGENT_TASKS/TASK_14_dashboard_errors.md << 'EOF'
# Task 14: Add Error Monitor to Dashboard

## Context
Make errors visible to the user.

## Action
1. Edit `src/pages/Dashboard.tsx`.
2. Import `ErrorMonitor` from components.
3. Place `<ErrorMonitor />` at the very top of the page container.
EOF

# Task 15: Dashboard Integration (Badge)
cat > AGENT_TASKS/TASK_15_dashboard_badge.md << 'EOF'
# Task 15: Add Sync Badge to Header

## Context
Show sync status in the header.

## Action
1. Edit `src/pages/Dashboard.tsx`.
2. Import `SyncStatusBadge`.
3. Place `<SyncStatusBadge />` next to the "Refresh" button in the header.
EOF

# ==========================================
# PHASE 4: VERIFICATION
# ==========================================

# Task 16: Verify DB
cat > AGENT_TASKS/TASK_16_verify_db.md << 'EOF'
# Task 16: Verify Database

## Action
1. Check that `sync_logs` has entries (trigger a fake error if needed).
2. Check that `daily_summary` has the new columns.
EOF

# Task 17: Verify Sync
cat > AGENT_TASKS/TASK_17_verify_sync.md << 'EOF'
# Task 17: Verify HubSpot Sync

## Action
1. Trigger `sync-hubspot-to-supabase` manually via curl.
2. Check `sync_logs` for a "success" entry.
3. Check `hubspot_contacts` table for new data.
EOF

# Task 18: Verify AI
cat > AGENT_TASKS/TASK_18_verify_ai.md << 'EOF'
# Task 18: Verify AI Agents

## Action
1. Trigger `business-intelligence` manually.
2. Check Dashboard for the "Executive Briefing" card.
3. Ensure it contains real data, not "Zero Activity" (unless true).
EOF

# Task 19: Verify Frontend
cat > AGENT_TASKS/TASK_19_verify_frontend.md << 'EOF'
# Task 19: Verify Dashboard UI

## Action
1. Open the deployed Vercel URL.
2. Check that the Error Monitor appears (if errors exist).
3. Check that the Sync Badge is Green.
EOF

# Task 20: Rollback Guide
cat > AGENT_TASKS/TASK_20_rollback_guide.md << 'EOF'
# Task 20: Rollback / Emergency Procedures

## Context
If something breaks, how do we fix it?

## Actions
1. **Database**: Run `DROP TABLE sync_logs;` etc.
2. **Code**: `git revert <commit-hash>`.
3. **Functions**: Redeploy previous versions via Supabase CLI.
EOF

echo "✅ All 20 Task Files Generated in AGENT_TASKS/"
chmod +x AGENT_TASKS/*.md
