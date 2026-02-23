# UI Audit — Prompt Engineering Report

**Date:** 2026-02-22  
**Purpose:** Single reference answering: most advanced, what needs wiring, best UX (no duplication), what's lost, what to add, what needs new design, and GPS data pipeline.

---

## 1. What's Most Advanced (Production-Ready)

| Area | Component / Page | Why It's Advanced |
|------|------------------|-------------------|
| **Executive Overview** | `/` | Real MRR, health distribution, full-chain funnel, AI insights, live activity feed |
| **Revenue Intelligence** | `/revenue` | Stripe + pipeline + HubSpot health + live data tabs, real subscriptions |
| **Marketing Intelligence** | `/marketing` | Zone A/B/C/D structure, Source Truth, Meta Ads, Money Map, 1,155 lines |
| **Command Center** | `/command-center` | 16 queries, leads/deals/calls, real-time CRM view |
| **Coach Locations (GPS)** | `/coach-locations` | Leaflet map, heatmap, dwell detection, coach visits, pattern detection — **wired to real tables** |
| **Client Detail** | `/clients/:email` | Full health breakdown, interventions, sessions, engagement |
| **Sales Coach Tracker** | `/sales-tracker` | Setter funnel, closed-won, no-shows, coach performance |
| **Call Tracking** | `/calls` | Call records, lead enrichment, lost leads |
| **Interventions** | `/interventions` | Real intervention_log, AI recommendations |
| **Alert Center** | `/alert-center` | Health-based alerts, churn risk |
| **Enterprise Strategy** | `/enterprise/strategy` | ReconciliationService, mv_enterprise_truth_genome (real data) |

**Edge functions with real data:** health-calculator, business-intelligence, coach-analyzer, gps-dwell-engine, tinymdm-pull-locations, ptd-agent-gemini.

---

## 2. What Needs Wiring (Built but Not Connected)

| Item | Location | Fix |
|------|----------|-----|
| **PTD Control** | `PTDControlChat.tsx` | Nav links to `/ptd-control` but no route → 404. Add route + lazy import in main.tsx. |
| **Admin Edge Functions** | `EdgeFunctions.tsx` | No route. Add `/admin/edge-functions` or `/master-control/edge-functions`. |
| **Marketing Stress Test** | `StressTestDashboard.tsx` | Not imported anywhere. Add route or tab in Marketing. |
| **get_campaign_money_map RPC** | Marketing Money Map tab | Tab uses `useMoneyMap` (aggregate). Add call to `get_campaign_money_map` for per-campaign table. |
| **aws-truth-alignment** | — | Edge function exists, no UI. Add tab in Attribution or Reconciliation. |
| **data-reconciler** | — | Edge function exists, no UI. Same as above. |
| **hubspot-command-center** | — | Component exists, no route. Restore Operations page. |

---

## 3. Best UX — Avoid Duplication (Consolidation Map)

| Duplicate Concept | Current State | Recommendation |
|-------------------|---------------|----------------|
| **AI Advisor** | `/ai-advisor` → EnterpriseAIAdvisor, `/enterprise/ai-advisor` → same | Keep one route. Enterprise version has better UI; wire real data from AIBusinessAdvisor. |
| **Observability** | `/observability` redirects to `/enterprise/observability` | Main Observability (454 lines, real ai_execution_metrics) was replaced by enterprise mock. **Restore main** or wire enterprise to real data. |
| **Call Analytics** | `/calls` (CallTracking) + `/enterprise/call-analytics` (mock) | CallTracking is real. Enterprise CallAnalytics is shell. Merge: use enterprise UI, wire CallTracking data. |
| **Coach Performance** | `/coaches` (real) + `/enterprise/coach-performance` (mock) | Same pattern. Use enterprise UI, wire Coaches data. |
| **Client Health** | `/clients` + `/enterprise/client-health` | Clients is full. Enterprise is shell. Merge or drop enterprise. |
| **Knowledge Base** | `/global-brain` (AIKnowledge merged) + `/enterprise/knowledge-base` | One source of truth. Wire enterprise to agent_knowledge if UI is better. |
| **Money Map** | Marketing tab (aggregate) vs CampaignMoneyMap (per-campaign RPC) | Add `get_campaign_money_map` call to Marketing Money Map tab. Don't create new page. |
| **Setter Activity / Yesterday Bookings** | Redirect to `/sales-tracker` | Add "Today" and "Yesterday" tabs to SalesCoachTracker. No new pages. |

**Rule:** One page per domain. Use tabs for sub-views. Don't create `/enterprise/X` and `/X` for same thing.

---

## 4. What's Lost (No Replacement)

| Page / Feature | Data | Impact |
|----------------|------|--------|
| **Lead Follow-Up** | view_lead_follow_up (6,617 rows) | Lead-level status, overdue, going cold — **unique**. No replacement. |
| **Operations** | HubSpotCommandCenter, WorkflowStrategy, HubSpotAnalyzer, SettingsTab | 4 tabs of ops tools. Redirect to /calls loses all. |
| **HubSpot Live** | useHubSpotRealtime, HubSpotKPIs, HubSpotTabs | Real-time CRM. No replacement. |
| **Analytics** | weekly_health_summary, zone pie | 12-week trend, segment distribution. No replacement. |
| **WorkflowStrategy** | ai_execution_metrics, agent_decisions | 796 lines. Was in Operations. |
| **Per-campaign Money Map table** | get_campaign_money_map RPC | Per-campaign CPL, CPO, ROAS. Marketing has aggregate only. |

**Restore priority:** Lead Follow-Up, Operations, HubSpot Live, Analytics (add routes only — files exist in _archived).

---

## 5. What We Can Add (New Value)

| Addition | Where | Effort |
|----------|-------|--------|
| **Delegation tracking tab** | Setter Command Center | Wire view_delegation_analytics, view_hot_potato_leads |
| **Revenue by Channel** | New tab in Revenue or Marketing | AED 5.77M FB, 1.17M Google, 1.97M Offline + ROAS |
| **Morning brief** | Edge function + Executive Overview | Daily 6am Dubai: yesterday's leads, calls, deals, attention needed |
| **Pipeline stage names** | SalesPipeline | Map numeric IDs → real names from HubSpot |
| **Leak detector tab** | Attribution | aws-truth-alignment + data-reconciler UI |
| **Today / Yesterday tabs** | SalesCoachTracker | Embed SetterActivityToday + YesterdayBookings logic |
| **Admin Edge Functions** | New route | EdgeFunctions.tsx — deploy status, logs |

---

## 6. What Needs New Design

| Item | Current | Needed |
|------|---------|--------|
| **Contrast** | 1,134+ low-contrast (text-slate-400 on black) | Phase 1 of design-performance-overhaul: bump --muted-foreground, text-slate-300 |
| **Navigation** | 37 items | Consolidate to ~15 with grouping (Phase 3) |
| **Loading states** | Spinners | Skeleton loaders (DashboardSkeleton, TableSkeleton) |
| **Bundle size** | 1,309KB main | Code split Recharts, lazy load chart-heavy pages |
| **Marketing Intelligence** | 67 contrast issues | Worst offender. Fix first. |
| **ClientDetail** | 32 contrast issues | Second worst. |
| **Enterprise pages** | Mock data | Wire to real Supabase or drop. |

---

## 7. GPS Data — Build It Somewhere

### Current State

| Component | Data Source | Status |
|-----------|-------------|--------|
| **CoachLocations** | mdm_devices, mdm_location_events, coach_visits | **Real pipeline** — queries Supabase |
| **tinymdm-pull-locations** | TinyMDM API → mdm_location_events | Pulls device positions from TinyMDM |
| **tinymdm-sync-devices** | TinyMDM API → mdm_devices | Syncs devices, last_lat/lng |
| **gps-dwell-engine** | mdm_location_events → coach_visits | Clusters points into visits (PTD locations) |
| **coach-intelligence-engine** | mdm_location_events, coach_visits | Utilization, travel km, insights |
| **verify-sessions-gps** | Sessions + GPS | Cross-checks session location vs GPS |

### The "Faking" Problem

**If GPS is "faking" data, likely causes:**

1. **TinyMDM not configured** — `TINYMDM_API_KEY_PUBLIC`, `TINYMDM_API_KEY_SECRET`, `TINYMDM_ACCOUNT_ID` missing or invalid → tinymdm-pull-locations returns "No devices" or fails.
2. **No devices enrolled** — TinyMDM account has no coach phones enrolled → empty mdm_devices, empty mdm_location_events.
3. **Tables not created** — tinymdm-setup-tables must run to create mdm_devices, mdm_location_events, coach_visits.
4. **Test/seed data** — Someone may have inserted fake rows for demos. Check with: `SELECT COUNT(*), MIN(recorded_at), MAX(recorded_at) FROM mdm_location_events;`

### What to Build

| Task | Action |
|------|--------|
| **1. Verify TinyMDM** | Ensure API keys in Supabase secrets. Run tinymdm-sync-devices + tinymdm-pull-locations manually. Check mdm_devices and mdm_location_events row counts. |
| **2. Cron for GPS sync** | Add pg_cron job to run tinymdm-pull-locations every 15–30 min. |
| **3. Cron for dwell engine** | Run gps-dwell-engine daily (or after each pull) to populate coach_visits. |
| **4. Fallback when empty** | CoachLocations shows empty state. Add clear message: "No GPS data. Sync TinyMDM or enroll devices." |
| **5. No mock data** | Do NOT seed fake GPS. If no data, show "Connect TinyMDM" CTA with setup link. |

### Tables & Migrations

- `mdm_devices` — created by tinymdm-setup-tables (or migration)
- `mdm_location_events` — same
- `coach_visits` — created by gps-dwell-engine or tinymdm-setup-tables

**If tables don't exist:** Run `tinymdm-setup-tables` edge function or add migration that creates them.

---

## 8. One-Page Action Matrix

| Priority | Action | File(s) | Effort |
|----------|--------|---------|--------|
| P0 | Add PTD Control route | main.tsx | 5 min |
| P0 | Add Admin Edge Functions route | main.tsx | 5 min |
| P0 | Restore Lead Follow-Up, Operations, HubSpot Live, Analytics | main.tsx, Navigation.tsx | 15 min |
| P1 | Wire get_campaign_money_map to Marketing Money Map tab | MarketingIntelligence, useMarketingAnalytics | 1–2 h |
| P1 | Verify TinyMDM + GPS cron | Supabase secrets, pg_cron | 1 h |
| P1 | Contrast fix (Phase 1) | index.css, tailwind.config | 1 h |
| P2 | Add Today/Yesterday tabs to SalesCoachTracker | SalesCoachTracker | 2–3 h |
| P2 | Wire enterprise pages to real data or remove | enterprise/*.tsx | 2–4 h each |
| P2 | Add StressTestDashboard route or tab | main.tsx, Marketing | 30 min |
| P3 | Nav consolidation 37→15 | Navigation.tsx | 2 h |
| P3 | Skeleton loaders | PageSkeleton, new components | 2 h |

---

## 9. Verification Queries (Run in Supabase SQL Editor)

```sql
-- GPS pipeline health
SELECT 'mdm_devices' AS tbl, COUNT(*) AS n FROM mdm_devices
UNION ALL
SELECT 'mdm_location_events', COUNT(*) FROM mdm_location_events
UNION ALL
SELECT 'coach_visits', COUNT(*) FROM coach_visits;

-- Latest GPS data
SELECT MAX(recorded_at) AS latest_gps FROM mdm_location_events;

-- Lead follow-up view (should have rows)
SELECT COUNT(*) FROM view_lead_follow_up;
```

---

*Consolidated from UI-WORK-MASTER-PLAYBOOK, page-audit-deep-dive, pages-deep-explanation, dead-unused-code-inventory, ENTERPRISE_PAGE_COMPARISON, DASHBOARD_REDESIGN_STATUS, design-performance-overhaul, finish-the-app.*
