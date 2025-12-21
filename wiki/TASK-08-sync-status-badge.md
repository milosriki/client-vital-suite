# Task 08: Create Sync Status Badge

## Context
A visual indicator that tells the user "Data is Fresh".

## Action
1. Create file `src/components/dashboard/SyncStatusBadge.tsx`.
2. Fetch the latest `success` log from `sync_logs`.
3. If < 1 hour ago: Show Green Dot "Live".
4. If > 24 hours ago: Show Red Dot "Stale".
