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
