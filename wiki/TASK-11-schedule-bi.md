# Task 11: Schedule Daily Briefing

## Context
Run the intelligence agent every morning.

## Action
1. Open Supabase Dashboard > Edge Functions.
2. Select `business-intelligence`.
3. Enable "Enforce JWT Verification" (Security).
4. Add Cron Schedule: `0 7 * * *` (Every day at 7:00 AM UTC).
