# PTD Vital Suite - Comprehensive Intelligence Plan

## Phase 1: Truth Alignment (Data Integrity)
**Objective:** Eliminate "fake" coaches and ensure every contact has a valid, accountable owner.

1.  **Staff Source of Truth:**
    *   Utilize the `staff` table as the master list of active coaches/setters.
    *   **Action:** Seed `staff` table with valid users (e.g., "Matthew Twigg" and others from HubSpot).
    *   **Action:** Update `sync-hubspot-to-supabase` to map `hubspot_owner_id` to `staff.hubspot_owner_id`.
    *   **Logic:** If a contact comes from HubSpot with an unknown owner, assign to "Unassigned / Admin" queue instead of creating a fake/null entry.

2.  **Purge Invalid Data:**
    *   Identify "Stress Test" data (e.g., specific email domains, known fake IDs).
    *   **Action:** Create a `cleanup_test_data` RPC function to safely archive or delete these records.

## Phase 2: Time-Series Intelligence (Daily Snapshots)
**Objective:** Move from "Current State" to "Trend Analysis" (e.g., "Are we doing better than yesterday?").

1.  **Create `daily_business_metrics` Table:**
    *   **Columns:**
        *   `date` (Primary Key)
        *   `total_leads_new` (Count)
        *   `total_calls_made` (Count)
        *   `total_revenue_booked` (Currency)
        *   `ad_spend_facebook` (Currency)
        *   `roas_daily` (Calculated: Revenue / Spend)
        *   `conversion_rate_daily` (Calculated: Closed / New Leads)
        
2.  **Automated Snapshot Function:**
    *   **Action:** Create an Edge Function (`generate-daily-snapshot`) scheduled at 23:59 UTC.
    *   **Logic:** It aggregates data from `leads`, `deals`, and `facebook_ads_insights` and inserts a row into `daily_business_metrics`.

## Phase 3: Marketing Reality (Facebook Integration)
**Objective:** Replace "Stress Test" data with live Meta Marketing API data.

1.  **Verify & Activate Credentials:**
    *   Ensure `FB_ACCESS_TOKEN` and `FB_AD_ACCOUNT_ID` are valid for the live environment.
    
2.  **Update `fetch-facebook-insights` Function:**
    *   **Current State:** Likely mocking data or pulling from a sandbox.
    *   **Target State:** Connect to `https://graph.facebook.com/v19.0/act_<ID>/insights`.
    *   **Mapping:** Pull `spend`, `impressions`, `clicks`, `cpc`, `ctr` at the **Campaign** level.
    *   **Storage:** Store in `facebook_campaign_performance` (or `facebook_ads_insights`).

3.  **Attribution Bridge:**
    *   **Action:** Ensure HubSpot `utm_campaign` matches Facebook `campaign_name`.
    *   **Metric:** Calculate "True CPA" (Cost Per Acquisition) by joining Facebook Spend with HubSpot Leads.

## Phase 4: Advanced Formulas & Visualization
**Objective:** Display meaningful, actionable metrics on the dashboard.

1.  **Refined Formulas:**
    *   **Lead Velocity:** `(Leads Today - Leads Yesterday) / Leads Yesterday`
    *   **Health Score v2:** Adjust the formula to stop flagging 90% of clients as "Red". Incorporate "Last Contacted" more heavily.
    
2.  **Dashboard Update:**
    *   Replace static number cards with "Trend Cards" (showing the % change calculated from Phase 2).

---

**Immediate Next Step:** Populate the `staff` table to fix the "Fake Coach" issue.
