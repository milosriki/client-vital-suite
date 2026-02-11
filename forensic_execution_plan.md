# 🕵️‍♂️ Smart Debug: Forensic Execution Plan

**Objective**: Trace the "Golden Thread" of data from ad click to ROI dashboard.

## Phase 1: The "AnyTrack" Nexus (Ad -> CRM)

- **Hypothesis**: The link between AnyTrack and HubSpot is broken, or HubSpot and Supabase are out of sync.
- **Action**:
  1.  Inspect `anytrack-webhook` code to see what it _does_ (does it write to DB or push to HubSpot?).
  2.  Inspect `hubspot-webhook-receiver` to see how it handles "new contact" events.

## Phase 2: The "Facebook" Silo (Spend vs Leads)

- **Hypothesis**: We are pulling `spend` correctly but `leads` is 0 because of an API version mismatch or incorrect field mapping.
- **Action**:
  1.  Inspect `fetch-facebook-insights` code.
  2.  Verify the Graph API version and fields requested (`leads` or `actions`).

## Phase 3: The "AWS" Truth (Backoffice)

- **Hypothesis**: The "Truth" matrix is empty because `aws-backoffice-sync` hasn't run.
- **Action**:
  1.  Check `aws-backoffice-sync` logic.
  2.  Check `assessment_truth_matrix` for any recent rows.

## Phase 4: The "Zombie" Factor

- **Hypothesis**: We deleted something critical during the "Zombie Purge".
- **Action**: Cross-reference the "Deleted List" (from `cleanup_ghosts.sh`) with the dependencies of these functions.
