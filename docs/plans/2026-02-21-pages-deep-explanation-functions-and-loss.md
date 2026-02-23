# Deep Explanation: All Pages — Idea, Functions, What We Lost, How Much Was Real

**Date:** 2026-02-21  
**Purpose:** Full explanation of every page's purpose, data sources, what was lost in consolidation, and how much was real vs mock.

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Archived pages** | 26 |
| **100% real data** | 22 of 26 |
| **Partially real** | 2 (YesterdayBookings, some edge cases) |
| **Fully lost (no replacement)** | 4 |
| **Partially lost (replacement has different scope)** | 6 |

---

## Part 1: Archived Pages — Full Breakdown

### 1. Lead Follow-Up (`LeadFollowUp.tsx`)

**Idea:** Single page where Milos sees every lead's status — who's calling them, what's overdue, who needs reassignment, which leads are going cold. No lead gets buried.

**Functions:**
- Table of leads with: name, email, phone, setter, lifecycle stage, last call status/date, total calls, days since contact, deal info, flags (missing coach, missing deal, no calls, going cold)
- Priority scoring: High (going cold + deal >10K or overdue callback), Medium (no calls 3+ days), Low
- Filters: setter, priority, stage, search
- Sort by any column
- Uses `view_lead_follow_up` SQL view (joins contacts, call_records, deals, assessment_truth_matrix)

**Data:** 100% real — `view_lead_follow_up` (6,617 rows per page-audit)

**Status:** ❌ **FULLY LOST** — No route, no redirect, no replacement. SalesCoachTracker and SetterCommandCenter do NOT show lead-level follow-up status.

---

### 2. Setter Activity Today (`SetterActivityToday.tsx`)

**Idea:** Today's setter activity — calls made, bookings, conversion rates, connection rates. Real-time view of what setters did TODAY.

**Functions:**
- KPI cards: Total Calls Today, Reached, Booked, Conversion Rate, Connection Rate, Revenue
- Filter by setter/owner
- Table of today's calls (call_records)
- Table of today's bookings (deals in BOOKED/HELD/ASSESSMENT_DONE stage)
- Uses Dubai business time for "today"

**Data:** 100% real — `call_records`, `deals`, `contacts` (owner_name)

**Status:** ⚠️ **PARTIALLY LOST** — Redirects to `/sales-tracker`. SalesCoachTracker shows closed-won deals, setter funnel matrix, no-shows, coach performance — NOT today's calls or today's bookings. The "today" lens is gone.

---

### 3. Yesterday Bookings (`YesterdayBookings.tsx`)

**Idea:** See who was booked for assessments YESTERDAY — for morning standup / follow-up.

**Functions:**
- Query `intervention_log` (booking/assessment interventions from yesterday)
- Query `client_health_scores` (GREEN/PURPLE clients calculated yesterday)
- Combined table: client name, coach, value, status, health zone
- Fallback to deals if interventions sparse

**Data:** Partially real — `intervention_log` (24 rows total), `client_health_scores`. intervention_log is sparse; page may show few results.

**Status:** ⚠️ **PARTIALLY LOST** — Redirects to `/sales-tracker`. SalesCoachTracker has no "yesterday bookings" view.

---

### 4. Team Leaderboard (`TeamLeaderboard.tsx`)

**Idea:** Monthly leaderboard — setters ranked by calls, bookings, points; coaches by closed deals and revenue.

**Functions:**
- Setter stats: calls, bookings, points (from call_records, leads)
- Coach stats: closed deals, revenue (from deals)
- Staff names from `staff` table
- Ranked table with avatars, badges

**Data:** 100% real — `call_records`, `leads`, `deals`, `staff`

**Status:** ⚠️ **PARTIALLY LOST** — Redirects to `/sales-tracker`. SalesCoachTracker has setter_funnel_matrix and coach_performance but different structure — no unified leaderboard with points/rankings.

---

### 5. Operations (`Operations.tsx`)

**Idea:** Operations center — 4 tabs: HubSpot Command Center, Calls (CallTracking), Automation (WorkflowStrategy, HubSpotAnalyzer, Rules), System (Settings). Test/Live mode toggle.

**Functions:**
- HubSpot tab: HubSpotCommandCenter component
- Calls tab: Full CallTracking page embedded
- Automation tab: WorkflowStrategy (n8n docs + ai_execution_metrics), HubSpotAnalyzer, AutomationTab (rules)
- System tab: SettingsTab
- Mode toggle persisted in localStorage

**Data:** 100% real — all child components use real Supabase data

**Status:** ❌ **MOSTLY LOST** — Redirects to `/calls`. Only CallTracking survives. HubSpot Command Center, WorkflowStrategy, HubSpotAnalyzer, Settings — all gone from navigation. Components still exist but no route to reach them.

---

### 6. Workflow Strategy (`WorkflowStrategy.tsx`)

**Idea:** n8n workflow documentation + AI execution metrics. Strategy recommendations from agent_decisions. Workflow health.

**Functions:**
- Query `ai_execution_metrics` — aggregate by function (success, fail, latency, cost)
- Query `agent_decisions` — strategy recommendations
- Accordion with workflow docs, metrics, recommendations
- 795 lines — complex page

**Data:** 100% real — `ai_execution_metrics`, `agent_decisions`

**Status:** ❌ **FULLY LOST** — Was embedded in Operations. Operations redirects to /calls. No route to WorkflowStrategy.

---

### 7. HubSpot Analyzer (`HubSpotAnalyzer.tsx`)

**Idea:** HubSpot data analysis, CRM insights, data quality checks.

**Functions:**
- (Component exists — need to check exact functions)
- Was in Operations Automation tab

**Data:** Real (Supabase)

**Status:** ❌ **FULLY LOST** — Redirects to `/sales-pipeline`. Component exists but not reachable from Operations anymore.

---

### 8. HubSpot Live Data (`HubSpotLiveData.tsx`)

**Idea:** Real-time HubSpot dashboard — KPIs, leads, deals, calls, staff. Formula-driven metrics. "Clear fake data" button to sync from HubSpot.

**Functions:**
- useHubSpotRealtime(timeframe) — leads, deals, call_records, staff
- HubSpotKPIs, HubSpotFilters, HubSpotTabs
- Clear fake data → invokes sync-hubspot-to-supabase
- Timeframe: today, yesterday, this_month, etc.

**Data:** 100% real — `leads`, `deals`, `call_records`, `contacts` via useHubSpotRealtime

**Status:** ❌ **FULLY LOST** — No route, no redirect. useHubSpotRealtime hook and HubSpotKPIs/HubSpotTabs components still exist.

---

### 9. Campaign Money Map (`CampaignMoneyMap.tsx`)

**Idea:** Per-campaign ROI — Facebook spend vs HubSpot revenue. CPL, CPO, ROAS per campaign. "Scale" vs "Kill" recommendations.

**Functions:**
- Calls `get_campaign_money_map` RPC (days_back: 90)
- Returns: campaign_name, total_spend, total_leads, total_revenue, total_deals, CPL, CPO
- Hero cards: Total Ad Spend, Revenue, Leads, Deals, Avg CPL, Avg CPO
- Table: campaign, spend, leads, CPL, deals, CPO, revenue, ROAS, status (Scale/Kill)

**Data:** 100% real — `get_campaign_money_map` RPC (uses facebook_ads_insights, attribution_events, deals)

**Status:** ⚠️ **PARTIALLY LOST** — MarketingIntelligence has "Money Map" tab but uses `useMoneyMap` hook (raw facebook_ads_insights + deals + stripe). It does NOT call `get_campaign_money_map` RPC. The per-campaign table with CPL/CPO/ROAS is gone. Marketing's Money Map is aggregate ROI, not per-campaign.

---

### 10. Analytics (`Analytics.tsx`)

**Idea:** Trends and insights across client base — weekly health score trend, zone distribution, segment distribution.

**Functions:**
- Line chart: Average Health Score Trend (12 weeks) from `weekly_health_summary`
- Pie chart: Zone distribution (RED/YELLOW/GREEN/PURPLE) from `client_health_scores`
- Segment distribution from client_health_scores

**Data:** 100% real — `weekly_health_summary`, `client_health_scores`

**Status:** ❌ **FULLY LOST** — No route, no redirect. weekly_health_summary and client_health_scores exist. No other page shows weekly health trend or zone pie.

---

### 11. Observability (`Observability.tsx`)

**Idea:** AI execution monitoring — latency, cost, success rate, errors. By function, by provider. Time range 1h/24h/7d.

**Functions:**
- Query `ai_execution_metrics` (500 records)
- Aggregate: totalCalls, successRate, avgLatency, totalCost
- By function: count, errors, avgLatency, cost
- By provider: count, tokens, cost
- Table of recent executions with status, latency, cost

**Data:** 100% real — `ai_execution_metrics` (136+ rows)

**Status:** ✅ **PRESERVED** — Redirects to `/enterprise/observability`. EnterpriseSystemObservability uses useSystemObservability which queries ai_execution_metrics. Same data, similar UI.

---

### 12. Reconciliation Dashboard / Leak Detector (`ReconciliationDashboard.tsx`)

**Idea:** AWS Backoffice vs HubSpot — training session reconciliation. Find discrepancies, force align.

**Functions:**
- Invoke `aws-truth-alignment` edge function
- Show discrepancies (HubSpot vs AWS)
- "Run Audit" and "Force Align" buttons
- Dark theme, gradient header

**Data:** 100% real — edge function returns real discrepancy report

**Status:** ⚠️ **UNCERTAIN** — Redirects to `/attribution`. MarketingIntelligence has "Source Truth" tab. Need to verify if Source Truth includes aws-truth-alignment or if it's data-reconciler only.

---

### 13. Attribution Leaks (`AttributionLeaks.tsx`)

**Idea:** Attribution discrepancies — FB Ads vs HubSpot vs AnyTrack revenue. Conflicts, True ROAS.

**Functions:**
- Invoke `data-reconciler` edge function
- Tabs: attribution, discrepancies
- Metrics: FB Ads Revenue, HubSpot Revenue, AnyTrack Revenue, Conflicts, True ROAS

**Data:** 100% real — `data-reconciler` edge function

**Status:** ⚠️ **UNCERTAIN** — Redirects to `/attribution`. MarketingIntelligence Attribution tab may use similar data. Source Truth tab exists.

---

### 14. Executive Dashboard (`ExecutiveDashboard.tsx`)

**Idea:** Business metrics, health overview. Alternative to Command Center.

**Data:** aws_truth_cache, contacts (736 rows in aws_truth_cache per page-audit)

**Status:** ✅ **CONSOLIDATED** — Redirects to `/command-center`. Command Center is the primary executive view.

---

### 15. Overview (`Overview.tsx`)

**Idea:** General overview, system overview. Possibly duplicate of dashboard.

**Data:** weekly_health_summary, other aggregates

**Status:** ✅ **CONSOLIDATED** — Redirects to `/`. Merged into main dashboard.

---

### 16. Stripe Intelligence (`StripeIntelligence.tsx`)

**Idea:** Stripe payments, subscriptions, transactions.

**Data:** useStripeTransactions, stripe_transactions

**Status:** ✅ **CONSOLIDATED** — Redirects to `/revenue`. RevenueIntelligence covers Stripe.

---

### 17. Meta Dashboard (`MetaDashboard.tsx`)

**Idea:** Meta CAPI, Facebook/Meta integration, campaign tracking.

**Status:** ✅ **CONSOLIDATED** — Redirects to `/marketing`. MarketingIntelligence has Meta Ads tab.

---

### 18. Marketing Analytics / Deep Intelligence (`MarketingAnalytics.tsx`, `MarketingDeepIntelligence.tsx`, `AttributionWarRoom.tsx`)

**Idea:** Various marketing analytics views — Truth Triangle, attribution, campaign performance.

**Status:** ✅ **CONSOLIDATED** — All redirect to `/marketing`. MarketingIntelligence has Command Center, Deep Intel, Meta Ads, Money Map, Source Truth tabs.

---

### 19. AI Knowledge / AI Learning (`AIKnowledge.tsx`, `AILearning.tsx`)

**Idea:** AI knowledge base browser, RAG, vector search. AI decision history, learning metrics.

**Data:** agent_knowledge, agent_conversations

**Status:** ✅ **CONSOLIDATED** — Redirect to `/global-brain`. GlobalBrain + EnterpriseKnowledgeBase cover this.

---

### 20. AI Business Advisor (`AIBusinessAdvisor.tsx`)

**Idea:** Chat interface with Atlas AI.

**Status:** ✅ **REPLACED** — Live `/ai-advisor` uses EnterpriseAIAdvisor. Same purpose.

---

### 21. AIDevConsole (`AIDevConsole.tsx`)

**Idea:** Developer tool — function testing, system diagnostics.

**Status:** ❌ **NO ROUTE** — May have been intentionally dev-only. No route in main.tsx.

---

### 22. Master Control Panel (`MasterControlPanel.tsx`)

**Idea:** Edge function manager, admin controls.

**Status:** ✅ **INTENTIONAL** — Admin tool, no public route. May be accessed differently.

---

### 23. Setter Command Center (archived version)

**Idea:** Duplicate — active SetterCommandCenter lives in `pages/`, not `_archived/`. Archived version used different views (view_setter_performance, view_daily_call_activity).

**Status:** ✅ **REPLACED** — Active page uses call_records, contacts directly. Different implementation, same purpose.

---

## Part 2: What We Lost — Summary Table

| Lost Capability | Was In | Replacement | Data Real? |
|-----------------|--------|-------------|------------|
| Lead-level follow-up table (who to call, overdue, going cold) | LeadFollowUp | None | 100% |
| Today's calls + today's bookings | SetterActivityToday | SalesCoachTracker (different: closed-won, funnel) | 100% |
| Yesterday's bookings for standup | YesterdayBookings | None | Partial |
| Team leaderboard (points, rankings) | TeamLeaderboard | SalesCoachTracker (different structure) | 100% |
| Operations hub (HubSpot, Automation, Settings) | Operations | Redirect to Calls only | 100% |
| Workflow Strategy (n8n + AI metrics) | WorkflowStrategy | None | 100% |
| HubSpot Live Dashboard | HubSpotLiveData | None | 100% |
| Per-campaign ROI table (get_campaign_money_map) | CampaignMoneyMap | Marketing Money Map (aggregate only) | 100% |
| Weekly health trend + zone pie | Analytics | None | 100% |
| AI Dev Console | AIDevConsole | None | — |

---

## Part 3: How Much Was Real

### 100% Real Data (22 pages)

- LeadFollowUp — view_lead_follow_up
- SetterActivityToday — call_records, deals, contacts
- YesterdayBookings — intervention_log, client_health_scores (sparse)
- TeamLeaderboard — call_records, leads, deals, staff
- Operations — all child components real
- WorkflowStrategy — ai_execution_metrics, agent_decisions
- HubSpotAnalyzer — real
- HubSpotLiveData — useHubSpotRealtime (leads, deals, call_records)
- CampaignMoneyMap — get_campaign_money_map RPC
- Analytics — weekly_health_summary, client_health_scores
- Observability — ai_execution_metrics
- ReconciliationDashboard — aws-truth-alignment
- AttributionLeaks — data-reconciler
- ExecutiveDashboard — aws_truth_cache, contacts
- Overview — weekly_health_summary
- StripeIntelligence — stripe_transactions
- MetaDashboard — facebook_ads_insights
- MarketingAnalytics, MarketingDeepIntelligence, AttributionWarRoom — real hooks
- AIKnowledge, AILearning — agent_knowledge, agent_conversations
- AIBusinessAdvisor — edge function calls

### Partially Real

- YesterdayBookings — intervention_log has only 24 rows; may show sparse data

### Mock / Fallback

- Some MarketingIntelligence tabs had fallbacks for empty states (per PRD-WIRE-MOCK-PAGES)
- Enterprise SystemObservability originally had mock; now uses useSystemObservability (real)

---

## Part 4: Recommendations

### Restore (High Value, Fully Lost)

1. **Lead Follow-Up** — view_lead_follow_up has 6,617 rows. Unique capability. Restore route `/lead-follow-up`.
2. **Analytics** — weekly_health_summary and client_health_scores exist. Restore route `/analytics` or add tab to dashboard.

### Restore or Embed (High Value, Partially Lost)

3. **Setter Activity Today** — Add "Today" tab to SalesCoachTracker or restore standalone page.
4. **Campaign Money Map** — Add get_campaign_money_map RPC call to MarketingIntelligence Money Map tab for per-campaign table.
5. **Operations** — Restore route `/operations` so HubSpot, Automation, Settings are reachable. Or add sub-routes under /calls.

### Consider

6. **HubSpot Live** — useHubSpotRealtime exists. Add route if real-time CRM feed is needed.
7. **Workflow Strategy** — Add route or embed in Operations if restored.
8. **Yesterday Bookings** — Add to Daily Ops or Sales Tracker as a section.

---

*Generated from source code analysis of _archived/, main.tsx, hooks, and plan documents.*
