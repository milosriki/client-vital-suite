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
