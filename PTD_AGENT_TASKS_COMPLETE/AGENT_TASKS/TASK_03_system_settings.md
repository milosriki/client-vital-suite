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
