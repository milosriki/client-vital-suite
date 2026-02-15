# Brainstorm: Dashboard Intelligence Upgrade (Multi-Agent Phase 1)

> [!IMPORTANT]
> **Understanding Lock Protocol**: This document captures the Primary Designer's initial synthesis of the vision, history, and current build. No code will be written until this entire document is peer-reviewed by the Skeptic, Constraint Guardian, and User Advocate.

## 1. The Core Vision: "Profit-First Intelligence"
The dashboard's primary purpose is not just to show data, but to drive **Money-Saving Decisions** and **Operational Control**.

### Key Pillars:
1.  **Creative-Level Truth**: Reconciling Facebook Ad ID + Creative Copy across AnyTrack, HubSpot, and CallGear.
2.  **Predictive Intent (The Lead DNA)**: Moving from "Rear-view" (Closed Deals) to "Forward-view" (Call duration/sentiment as a predictor of profit).
3.  **Capacity-Dynamic Budgeting**: Real-time feedback from AWS Back Office (Coach availability) to tell the Marketing side when to "Pause" or "Push" specific buckets (e.g., Dubai Male vs. Abu Dhabi Female).
4.  **Operational Mastery**: Strict roles for Lisa (Human-level Booking) and Atlas (Strategic Analyst), with shared but isolated data.

---

## 2. Historical Context vs. Current Build

### What was built before (`LISA_REFACTOR_PLAN.md` & `INTELLIGENCE_VISION.md`):
-   **Lisa/Atlas Separation**: Lisa books, Atlas analyzes. Isolation is key.
-   **3-Source Reconciliation**: FB CAPI, HubSpot, and AnyTrack linked via email hash.
-   **Edge Functions**: A library of 143 specialized functions.

### What is built now (`DASHBOARD_REDESIGN_STATUS.md`):
-   **Foundation**: 8 shared components (MetricCard, ChartCard, etc.) and design tokens.
-   **Pages (4/10)**: Executive Overview, Marketing, Revenue, Attribution Leaks.
-   **Gap**: The "Marketing Analytics" tab currently lacks the **Creative-level depth** and **CallGear intent bridge** requested today.

---

## 3. Skill-Based Enhancement Strategy
I have selected the following skills from the 859-skill library to drive this upgrade:

| Skill | Targeted Use Case |
| :--- | :--- |
| **`/analytics-tracking`** | Audit the signal quality of the 3-source reconciliation + CallGear duration. |
| **`/business-analyst`** | Build the **Capacity Heatmap** logic (joining AWS RDS with active spend). |
| **`/startup-metrics-framework`** | Refine the **Money Map** tab with true Payback and LTV:CAC ratios. |
| **`/ai-product`** | Ensure Atlas's "Insights" are based on grounded "Lead DNA" data. |
| **`/sql-pro`** | Write the complex JOINs for the `view_atlas_lead_dna`. |
| **`/senior-architect`** | Maintain the strict "Lisa vs Atlas" role isolation. |

---

## 4. The "Deep Logic" Roadmap (Step-by-Step)

### [STEP 1] DYNAMIC CAPACITY FORMULA
- **Skill Verified**: `/business-analyst`
- **Logic Verified**: Already mapped via `aws-backoffice-sync`.
- **Source Truth**: `enhancesch.vw_schedulers` (AWS RDS).
- **Calculation**: `Available_Capacity = (Historical_Peak_Sessions - Current_Rolling_7d_Count)`.
- **Status**: ✅ LOCKED (Use existing live activity data)

### [STEP 5] AWS RDS DATA MAPPING
- **Skill Verified**: `/sql-pro`
- **Source Truth**: `enhancesch.vw_client_packages` + `vw_schedulers`.
- **Mapping**: 
    - `outstanding_sessions` → Package truth.
    - `is_active_leaking` → Data integrity signal.
- **Goal**: Cross-reference coach load with Facebook spend buckets (Dubai/AD).
- **Status**: ✅ LOCKED (Confirmed already mapped in backend)

### [STEP 2] SIGNAL RECONCILIATION & LEAD INTENT IQ
- **Skill Verified**: `/analytics-tracking` + `/ai-engineer`
- **Logic Refinement**: **KILL 15-MINUTE RULE**.
- **New Formula (Lead Intent IQ)**: 
    - `Sentiment Score (40%)`: AI analysis of transcript positivity and commitment.
    - `Sales Marker Match (40%)`: Detection of NEPQ framework adherence (Pain/Goal/Commitment).
    - `Outcome Logic (20%)`: CallGear result code (e.g., 'Assessment Set').
- **Lead Journey UX**: 
    - **Identity**: Pull `first_name` and `last_name` from HubSpot `contacts`.
    - **Stages**: Display `lifecycle_stage` and `deal_stage` velocity (Lead -> MQL -> won).
    - **Data Required**: Name, Ad ID, Intent IQ, Stage Days, City/Gender.
- **Deep Comparison**: 
    - `Facebook`: Raw Spend + Creative DNA.
    - `AnyTrack`: Click Verification + CAPI Bridge.
    - `HubSpot`: `lifecycle_stage` + `deal_status` velocity.
    - `CallGear`: `Lead Intent IQ` (Replacing Duration).
- **Goal**: Identify creatives that drive "Short but High-Intent" conversions.
- **Status**: ✅ LOCKED

### [STEP 3] CREATIVE PSYCHOLOGY MAPPING
- **Skill Verified**: `/marketing-psychology`
- **Logic Added**: AI-powered "Angle Tagging" for all Facebook Ad Copy.
- **Frameworks**: 
    - **Pain vs. Status**: Automatic classification of the primary psychological hook.
    - **Lead DNA Bridge**: Join `Angle_Tag` → `Avg_Call_Duration` → `LTV`.
- **Skeptic Review**: 
    - ❌ Risk: Text-only analysis misses the visual impact (Video/Image).
    - ❌ Risk: Needs strict rubric to prevent subjective tagging errors.
- **Refinement**: Implement a "Performance Decay" tracker to see when a specific psychological angle stops resonating with the Dubai market.
- **Status**: ✅ LOCKED

### [STEP 4] SALES CYCLE PREDICTION (LEAD MATURITY)
- **Skill Target**: `/startup-metrics-framework`
- **Goal**: Forecast revenue based on 3-month cycle patterns and "Mature" lead signals.
- **Status**: ⏳ PENDING

## 5. Phase 1 Questions for User Confirmation
1.  **Creative Specificity**: Do you need the dashboard to show the actual image/video of the FB ad, or is the Name/ID enough for now?
2.  **Capacity Source**: Is the "Coach Capacity" stored in a specific AWS table we already have access to?
3.  **Predictive Window**: How many months back should we look to define "Long-term Sales Cycle" patterns?

---

## 6. Enterprise-Grade Audit (Final Review)

### [ARCHITECT COMMENT] (Skill: `/senior-architect`)
- **Strategy**: Move from "Polling" to "Webhook Push" for Revenue.
- **Risk**: 15-minute latency is too slow for high-spend Meta scaling.
- **Decision**: Trigger Atlas refresh immediately on Stripe/HubSpot webhooks.

### [BUSINESS ANALYST COMMENT] (Skill: `/business-analyst`)
- **Strategy**: Rank campaigns by "Contribution Margin," not just ROAS.
- **Risk**: High-revenue segments (Dubai) may have lower net profit due to higher CAC.
- **Decision**: Add Margin-per-Lead to the Segment Capacity View.

### [REVENUE INTEL COMMENT] (Skill: `/revenue-intelligence`)
- **Strategy**: Implement "7-Day Truth Audit."
- **Risk**: Facebook Pixel "Purchase" events often overestimate revenue.
- **Decision**: Reconcile FB Purchase IDs against Stripe Success IDs before awarding "Winner" status to a creative.

---

## 7. Deep Comparison: Current Build vs. Enterprise Vision

| Component | Status Now | Future "Gold Standard" |
| :--- | :--- | :--- |
| **Marketing** | Mocked UI / Summary Level | Creative DNA / Individual Call-to-Ad Link |
| **Revenue** | Stripe Disconnected | 7-Day Audit (FB Purchase vs Stripe Success) |
| **Operations** | Static Manual Slots | Dynamic Capacity (Hiring Velocity + Avg Load) |
| **AI Strategy** | Persona-Shared | Hard-Walled (Lisa: People / Atlas: CFO) |

## 8. Dashboard AI Best Practices (The Storytelling Layer)

### Principle 1: The "Why" Overlay
- **Rule**: No chart without a decision.
- **Implementation**: Every trend peak must have an AI-annotation explaining the **Discrepancy Source**.

### Principle 2: The "Profit DNA" Timeline
- **Rule**: Connect the click to the cash.
- **Implementation**: Drill-down from Creative → Adset → Lead Name → Call Recording → Stripe Transaction.

### Principle 3: "Cost of Inaction"
- **Rule**: Highlight missed opportunities.
- **Implementation**: Real-time alerts for "Budget Waste" (Spend on segments with 0 Capacity).

---

## 10. Multi-Skill Expert Audit (The Gold Standard)

### [KPI DESIGN AUDIT] (Skill: `/kpi-dashboard-design`)
- **Finding**: "Revenue Shadow" is too deep in the tabs.
- **Decision**: Elevate **Projected 30d Revenue** to the top-level HUD.
- **Action**: Add "Bottleneck Alerts" for high-intent leads that are stalled in HubSpot.

### [ANALYTICS AUDIT] (Skill: `/analytics-tracking`)
- **Finding**: `fb_ad_id` is the primary key, but needs a fallback.
- **Decision**: Implement **UTM-to-HubSpot** fallback matching for non-CAPI leads.
- **Action**: Ensure 100% of leads are mapped to a creative, even if the pixel fails.

### [STARTUP METRICS AUDIT] (Skill: `/startup-metrics-framework`)
- **Finding**: ROAS is a "vanity" metric for high-ticket sales.
- **Decision**: Focus on **Cash Payback Days** and **LTV:CAC ratio** at the creative level.
- **Action**: Update `view_atlas_lead_dna` to calculate "Time-to-Profit."

---

## 11. AI Model & Execution Strategy (Feb 2026 Update)

- **Primary Model**: **Gemini 3 Flash** (For all real-time intent analysis and UI generation).
- **Fallback Model**: Gemini 2.5 (For legacy edge functions).
- **Execution Priority**: **UI-First.** Build the "Decision Engine" interface to expose data gaps before finalizing deep NLP logic.

---

## 12. The "Brain" Logic: Constitutional Sales Rubric
- **Source**: `CONSTITUTIONAL_SALES_RUBRIC.md`
- **Logic**: Replaces duration with **Intent DNA** (Sentiment + NEPQ + Outcome).
- **Model**: Optimized for **Gemini 3 Flash**.

---

### **Decision Log**
- **Decision 1.1**: Initialize `BRAINSTORM_DASHBOARD_UPGRADE.md`.
- **Decision 1.2**: Adopt `view_atlas_lead_dna` integration pattern.
- **Decision 1.3**: Locked 10-step plan with Enterprise-Grade enhancements.
- **Decision 1.4**: Final Comparison & Storytelling Best Practices Approved.
- **Decision 1.5**: Implementation RESUMED - AWS & KPI Audits complete.
- **Decision 1.6**: Elevated "Revenue Shadow" to Global HUD.
- **Decision 1.7**: **Gemini 3 Flash** locked as primary brain.
- **Decision 1.8**: **UI-First Sprint** approved by PM.
- **Decision 1.9**: **Sales Rubric** finalized and locked for NLP analysis.
- **Decision 1.10**: **SPRINT 1 COMPLETE.** Staging Lab ready for review.
