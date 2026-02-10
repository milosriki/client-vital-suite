# Loki Continuity - PTD Vital Suite

## Current Goal
Execute wide discovery and implement Ground Truth Comparison.

## Mistakes & Learnings
- **Dual-Phase Coaching**: Verified that `assigned_coach` in HubSpot is for assessments, while AWS `vw_schedulers` is for ongoing training.
- **Setter Mapping**: Confirmed `hubspot_owner_id` is strictly for Setters.
- **Data Hierarchy**: AWS is the definitive source for training sessions and package balances for "Customer" status clients.

## Context
- Project: PTD Vital Suite
- Data Ecosystem: HubSpot (Sales/Assessments), AWS RDS (Training/Backoffice), Stripe (Payments), Meta (Ads).
- Stack: Supabase, Deno, AWS RDS UAE Replica.

## Progress
- [x] Phase 1: Truth Alignment (Data Integrity)
- [x] Phase 2: Time-Series Intelligence (Verified)
- [x] Phase 3: Marketing Reality (Verified)
- [x] Phase 4: Advanced Formulas & Visualization
  - [x] Wide discovery of AWS and HubSpot field logic.
  - [x] Mapped dual identity transition (Assessment -> Training).
  - [x] Identified AWS ground truth for session frequency.

## Next Phase: Ground Truth Comparison Engine
- [ ] Create `aws-truth-alignment` Edge Function.
- [ ] Generate `discrepancy_report` artifacts.
- [ ] Link `coach_uuid` in Supabase directly to AWS `trainer_name`.
- [ ] Update HubSpot `outstanding_sessions` from AWS when 100% sure.