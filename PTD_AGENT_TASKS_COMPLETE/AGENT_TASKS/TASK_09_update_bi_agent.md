# Task 09: Upgrade Business Intelligence Agent

## Context
Add "Stale Data" detection to the daily briefing.

## Action
1. Edit `supabase/functions/business-intelligence/index.ts`.
2. Add a query to check `sync_logs` for the last successful sync.
3. If last sync > 24h, inject a "CRITICAL WARNING" into the prompt sent to Claude.
4. Ensure the AI mentions this in the `system_status` JSON field.
