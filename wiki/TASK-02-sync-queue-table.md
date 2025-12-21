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
