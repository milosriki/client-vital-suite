# Loki Continuity - PTD Vital Suite

## Current Goal
Cross-check roles and integrate AWS coach data.

## Mistakes & Learnings
- **Role Correction**: Matthew Twigg identified as an **Appointment Setter**, not a coach. Updated `staff` table seeding and sync logic to reflect this.
- **Data Model Refinement**: Added `setter_uuid` and `coach_uuid` to `contacts` and `leads` tables to link directly to the `staff` table.
- **Bug Fixed**: `health-calculator` was using HubSpot property names instead of Supabase column names.
- **AWS Integration**: Verified `aws-backoffice-sync` function and RDS replica configuration for ground-truth session data.

## Context
- Project: PTD Vital Suite
- Root: `/Users/milosvukovic/client-vital-suite`
- PRD: `.loki/specs/prd.md`
- Stack: Supabase, AWS RDS (UAE Replica), HubSpot.

## Progress
- [x] Phase 1: Truth Alignment (Data Integrity)
  - [x] Seed `staff` table with valid users (including Matthew Twigg as Setter).
  - [x] Update `sync-hubspot-to-supabase` mapping with UUID resolution.
  - [x] Implement "Unassigned / Admin" logic.
  - [x] Create `cleanup_test_data` RPC.
- [x] Phase 2: Time-Series Intelligence (Verified Existing)
- [x] Phase 3: Marketing Reality (Verified Existing)
- [x] Phase 4: Advanced Formulas & Visualization
  - [x] Health Score v3 optimized and fixed.
  - [x] `smart-coach-analytics` using correct linked data.

## Next Phase: AWS Data Deep-Sync
- [ ] Implement `aws_coach_id` population from AWS RDS during sync.
- [ ] Verify coach performance metrics against AWS ground-truth sessions.
- [ ] Monitor for discrepancies between HubSpot session counts and AWS session counts.