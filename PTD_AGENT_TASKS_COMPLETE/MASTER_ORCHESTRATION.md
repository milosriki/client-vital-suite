# Master Orchestration Plan

This document outlines the strategy for executing the 20 tasks to upgrade the PTD Fitness system.

## Phase 1: Foundation (Tasks 1-5)
**Goal**: Prepare the database infrastructure.
**Risk**: Low (SQL only, `IF NOT EXISTS`).
**Time**: ~15 mins.

*   **Task 01**: Create `sync_logs` table for error tracking.
*   **Task 02**: Create `sync_queue` table for managing HubSpot jobs.
*   **Task 03**: Create `system_settings` table for configuration.
*   **Task 04**: Add performance indexes to all new tables.
*   **Task 05**: Create database function `cleanup_old_logs`.

## Phase 2: Core Features (Tasks 6-10)
**Goal**: Build the logic and backend functions.
**Risk**: Low (Mostly new files).
**Time**: ~30 mins.

*   **Task 06**: Create `HubSpotSyncManager` class (TypeScript).
*   **Task 07**: Create `ErrorMonitor` React component.
*   **Task 08**: Create `SyncStatusBadge` React component.
*   **Task 09**: Update `business-intelligence` function (Add Sync Check).
*   **Task 10**: Create `generate-lead-reply` Edge Function.

## Phase 3: Automation (Tasks 11-15)
**Goal**: Connect everything and turn on the "Brain".
**Risk**: Medium (Modifies Dashboard).
**Time**: ~80 mins.

*   **Task 11**: Schedule `business-intelligence` cron job (Daily 7 AM).
*   **Task 12**: Schedule `generate-lead-reply` cron job (Every 2 hours).
*   **Task 13**: Schedule `hubspot-sync` cron job (Hourly).
*   **Task 14**: Integrate `ErrorMonitor` into Dashboard.
*   **Task 15**: Integrate `SyncStatusBadge` into Dashboard.

## Phase 4: Testing & Verification (Tasks 16-20)
**Goal**: Ensure stability and correctness.
**Risk**: None (Read-only).
**Time**: ~25 mins.

*   **Task 16**: Verify Database Tables & Indexes.
*   **Task 17**: Test HubSpot Sync Manager (Dry Run).
*   **Task 18**: Test AI Lead Reply Generation.
*   **Task 19**: Verify Dashboard Integration.
*   **Task 20**: Final System Health Check.

## Execution Rules

1.  **Sequential Phases**: Finish Phase 1 before starting Phase 2.
2.  **Parallel Tasks**: Tasks within the same phase can be run in parallel by different agents.
3.  **Stop on Error**: If a task fails, report immediately and do not proceed to dependent tasks.
