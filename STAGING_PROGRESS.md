# Staging Lab: Enterprise Upgrade Progress

> [!IMPORTANT]
> **PM DIRECTIVE**: Every task below follows the BDD (Behavior-Driven Development) protocol. Do not mark as complete without a passing verification report.

## 🟢 SPRINT 1: THE REVENUE GENOME (100% COMPLETE)
- [x] **Task 1.1**: Materialized View `mv_enterprise_truth_genome` (Performance).
- [x] **Task 1.2**: `ReconciliationService` Logic (Predictive Shadow).
- [x] **Task 1.3**: Constitutional Sales Rubric (Gemini 3 Flash).

## 🟡 SPRINT 2: OPERATIONAL COMMAND (60% COMPLETE)
- [x] **Task 2.1**: Capacity SQL Views (Rolling 14-day load).
- [ ] **Task 2.2**: Update `aws-backoffice-sync` to fetch Coach Zone/Gender (MISSING DATA).
    - **BDD Test**: `SyncRun -> DB(coaches.home_zone != null)`.
- [ ] **Task 2.3**: Implement **Control Drawer** in `EnterpriseStrategy.tsx`.
    - **BDD Test**: `Click(Card) -> Drawer(Action_Buttons == visible)`.

## 🔴 SPRINT 3: SECURITY & ORCHESTRATION (20% COMPLETE)
- [ ] **Task 3.1**: Secure LISA Firewall (Tool Proxy).
    - **BDD Test**: `LisaAgent -> Call(revenue_intelligence) -> Error(Access Denied)`.
- [ ] **Task 3.2**: Materialized View Refresh Cycle (15-min cron).
    - **BDD Test**: `Update(Stripe) -> wait(15m) -> DB(mv_genome.verified_cash == updated)`.
- [ ] **Task 3.3**: Final Playwright Visual Audit.

---

## 🧠 GEMINI 3 FLASH: CONTROL PROMPT (DRAFT)
"You are the Atlas Control Engine. Based on the `view_enterprise_truth_genome` and the `view_segment_capacity_hud`, generate a decision for each active ad creative. 
- If ROI < 1.5 AND Intent IQ < 60 -> Action: KILL.
- If Capacity < 5% -> Action: PAUSE & REALLOCATE.
- If ROI > 4.0 AND Capacity > 50% -> Action: SCALE."

---
*Project Manager: Atlas PM Swarm | Date: Feb 14, 2026*
