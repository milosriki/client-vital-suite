# PTD Vital Suite Optimization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine health scoring and automate executive reporting using the integrated truth engine.

**Architecture:** Use scheduled Edge Functions to process ground-truth data from AWS and HubSpot into actionable KPIs. Implement a "Truth Dashboard" for discrepancy visibility.

**Tech Stack:** Supabase (PostgreSQL, Edge Functions), AWS RDS UAE, HubSpot CRM, TanStack Query.

---

### Task 1: Health Score v4 Calibration

**Files:**
- Modify: `supabase/functions/health-calculator/index.ts`
- Test: `tests/functions/health-calculator.test.ts`

**Step 1: Update scoring coefficients**
Refine the penalty/bonus weights based on AWS session truth. Increase the weight of `sessions_last_7d`.

**Step 2: Run verification**
Trigger the function manually and verify the output distribution.

### Task 2: "True CPA" Bridge

**Files:**
- Modify: `supabase/functions/generate-daily-snapshot/index.ts`
- Test: `tests/functions/daily-snapshot.test.ts`

**Step 1: Join Facebook Spend with AWS Assessments**
Update the snapshot logic to fetch "Completed" assessments from `vw_schedulers` and divide by total spend.

**Step 2: Update daily_business_metrics table**
Add `true_cpa` column to the schema if missing.

### Task 3: Weekly CEO Report Automation

**Files:**
- Create: `supabase/functions/weekly-ceo-report/index.ts`
- Modify: `supabase/migrations/20260210000006_schedule_weekly_report.sql`

**Step 1: Aggregate weekly performance**
Summarize revenue booked, sessions conducted, and coach health leaderboard.

**Step 2: Schedule cron**
Schedule for every Monday at 06:00 UTC.

### Task 4: Discrepancy Ledger Cleanup

**Files:**
- Modify: `src/pages/ReconciliationDashboard.tsx`

**Step 1: Add "Resolve All" button**
Implement a UI action to force-sync all 100% sure cases from AWS to HubSpot.
