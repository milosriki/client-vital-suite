# Task 07: Create Error Monitor Component

## Context
A React component to show system health on the Dashboard.

## Action
1. Create file `src/components/dashboard/ErrorMonitor.tsx`.
2. Use `useQuery` to fetch from `sync_logs` where `status = 'error'`.
3. Display a red alert banner if there are errors in the last 24h.
4. Show a "Resolve" button that marks the log as 'resolved' (optional).
