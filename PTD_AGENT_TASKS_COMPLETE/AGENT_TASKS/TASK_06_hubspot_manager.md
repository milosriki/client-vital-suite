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
