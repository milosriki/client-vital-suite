# Intelligence Reconciliation Ledger (Master Persistence)

> [!IMPORTANT]
> **AI INSTRUCTION**: Read this file first to understand the deep logic and missing links between the Vision and the current Build.

## 1. The Unified Vision (2026 Strategy)
The goal is a **Profit & Decision Dashboard**, not a software-specific display. 
- **Core Principle**: "If it's not on the dashboard, it doesn't matter what's on the backend."
- **Key Requirement**: Creative-level attribution that reconciles FB Ads, AnyTrack, HubSpot, and CallGear.
- **Predictive Intent**: Using call quality (duration/sentiment) to predict sales 3 months before they close.
- **Capacity Control**: Using AWS Back Office data to halt campaigns based on specific buckets (e.g., Dubai Male full).

## 2. Historical Comparison: Vision vs. Reality

| Vision Component | Source Plan | Current Build Status | Missing Logic / "The Gap" |
| :--- | :--- | :--- | :--- |
| **Lisa (Big Sister)** | `INTELLIGENCE_VISION.md` | ✅ Built (WhatsApp AI) | Correctly isolated. Needs "Capacity Awareness" from AWS. |
| **Atlas (CEO Brain)** | `INTELLIGENCE_VISION.md` | 🏗️ Partial | Dashboard exists. Needs the "Lead DNA" unified view. |
| **3-Source Recon** | `LISA_REFACTOR_PLAN.md` | ✅ Built (Edge Function) | Missing **CallGear** integration in the reconciliation join. |
| **Creative Detail** | Latest User Instruction | ❌ Missing in UI | Data exists in DB but not mapped to revenue in the new 19-page structure. |
| **Capacity Buckets** | Latest User Instruction | ❌ Missing | No logic to join AWS Coach data with active Facebook spend. |

## 3. The "Big Picture" Role Architecture

### LISA (The Execution Brain)
- **Role**: High-Ticket Appointment Setter.
- **Constraints**: NO access to Revenue, ROI, or PII from other leads.
- **New Capability**: Must read `capacity_alerts` to route bookings correctly.

### ATLAS (The Strategic Brain)
- **Role**: Multi-Source CFO/Analyst.
- **Constraints**: Full access to all DBs (AWS, Supabase, Stripe).
- **New Capability**: Must join `call_records` with `fb_ad_id` to calculate "Intent ROI".

## 4. The "Deep Logic" Roadmap (Next Actions)

### Phase 1: The "Lead DNA" Unified View
- **SQL Name**: `view_atlas_lead_dna`
- **Logic**: Join `fb_ads` + `contacts` + `call_records` (duration) + `deals` (status) + `stripe` (rev).
- **Goal**: Identify "Good Campaign but Bad Calls" scenarios.
- **Skill**: `/analytics-tracking`

### Phase 2: Capacity-Based Campaign Control
- **Logic**: Create a Postgres View `capacity_vs_spend` that joins `aws_coach_data` (Zone/Gender) with `facebook_ads_insights`.
- **Goal**: UI alert to "Pause Dubai Male Ads" when capacity > 90%.
- **Skill**: `/business-analyst`

### Phase 3: Long-Cycle Revenue Forecast
- **Logic**: Calculate `avg_days_to_close` per ad creative.
- **Goal**: Forecast next month's revenue based on today's "Lead DNA" quality.
- **Skill**: `/startup-business-analyst-financial-projections`

## 5. Event Reconciliation & "The Triple Truth"

### The Audit Hierarchy
To resolve discrepancies between FB, AnyTrack, and HubSpot, Atlas must follow this tier-based checking logic:

1.  **Tier 1: Signal Integrity (The Speed)**
    - **Check**: Did AnyTrack fire a conversion that FB did NOT receive?
    - **Goal**: Identify technical "Leaks" in the CAPI bridge.
2.  **Tier 2: Stage Validity (The Quality)**
    - **Check**: Compare FB "Purchase" events against HubSpot `deal_stage`.
    - **Goal**: Detect "Inflation." (e.g., FB claims a win for a lead that is still in "Negotiation").
3.  **Tier 3: Physical Settlement (The Absolute Truth)**
    - **Check**: Cross-reference Stripe Revenue with AWS `vw_schedulers` sessions.
    - **Goal**: Verify if the money matches the work. If money exists but sessions = 0, flag as "Refund Risk."

### Dynamic Capacity vs. Static Slots
- **Rule**: Do not rely on "Future Calendar Slots" which are often unpopulated.
- **Logic**: Use a **Rolling 14-Day Velocity**.
- **Formula**: `Capacity = (Coach_Historical_Peak - Last_14d_Actual_Sessions)`.
- **Action**: Atlas alerts when a segment (e.g., Dubai Male) has < 10% capacity based on *Actual Activity*, not scheduled slots.

---
*Verified via: /analytics-tracking & /data-quality-frameworks | Feb 13, 2026*
