# Task 04: Verify Performance Indexes

## Context
Ensure queries for the dashboard are fast (<100ms).

## Action
1. Run this SQL to ensure all foreign keys and status fields are indexed:
```sql
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON public.daily_summary(summary_date DESC);
```
