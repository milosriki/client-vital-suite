# Page Audit Deep Dive — Planned vs Live vs Archived

**Date:** 2026-02-21  
**Purpose:** Clarify which pages were planned, which are live, which were archived on purpose, and which may have been removed by mistake.

---

## Summary

| Category | Count |
|----------|-------|
| **Live routes** (main.tsx) | 28 primary + 7 enterprise |
| **Redirects** (old path → new path) | 22 |
| **Archived pages** (_archived/) | 26 files |
| **Planned but no route** | 2+ |
| **Uncertain (possibly accidental)** | 2 |

---

## 1. Live Routes (What's on Production)

These are the **primary routes** in `main.tsx`:

| Path | Component | In Nav |
|------|-----------|--------|
| `/` | (redirects to dashboard) | — |
| `/dashboard` | ExecutiveOverview | implicit |
| `/command-center` | CommandCenter | ✅ MAIN |
| `/marketing` | MarketingIntelligence | ✅ MAIN |
| `/sales-pipeline` | SalesPipeline | ✅ MAIN |
| `/revenue` | RevenueIntelligence | ✅ MAIN |
| `/attribution` | MarketingIntelligence | ✅ MAIN |
| `/clients` | Clients | ✅ MAIN |
| `/clients/:email` | ClientDetail | — |
| `/coaches` | Coaches | ✅ MAIN |
| `/interventions` | Interventions | ✅ MAIN |
| `/global-brain` | GlobalBrain | ✅ MAIN |
| `/ai-advisor` | EnterpriseAIAdvisor | ✅ MAIN |
| `/sales-tracker` | SalesCoachTracker | ✅ MORE |
| `/calls` | CallTracking | ✅ MORE |
| `/setter-command-center` | SetterCommandCenter | ✅ MORE |
| `/skills` | SkillCommandCenter | ✅ MORE |
| `/war-room` | WarRoom | ✅ MORE |
| `/intelligence` | BusinessIntelligenceAI | ✅ MAIN |
| `/daily-ops` | DailyOps | ✅ MAIN |
| `/client-activity` | ClientActivity | ✅ MAIN |
| `/predictions` | PredictiveIntelligence | ✅ MAIN |
| `/conversion-funnel` | ConversionFunnel | — |
| `/alert-center` | AlertCenter | ✅ MAIN |
| `/audit` | AuditTrail | ✅ MORE |
| `/coach-locations` | CoachLocations | ✅ MAIN |
| `/meta-ads` | MetaAds | ✅ MAIN |
| `/lead-tracking` | LeadTracking | ✅ MAIN |
| `/enterprise/strategy` | EnterpriseStrategy | ✅ MORE |
| `/enterprise/call-analytics` | EnterpriseCallAnalytics | ✅ MORE |
| `/enterprise/observability` | EnterpriseSystemObservability | ✅ MORE |
| `/enterprise/ai-advisor` | EnterpriseAIAdvisor | — |
| `/enterprise/client-health` | EnterpriseClientHealth | ✅ MORE |
| `/enterprise/coach-performance` | EnterpriseCoachPerformance | ✅ MORE |
| `/enterprise/knowledge-base` | EnterpriseKnowledgeBase | ✅ MORE |

---

## 2. Redirects (Old Path → New Path)

These old paths **redirect** to consolidated pages. The archived components are **intentionally replaced** by the target:

| Old Path | Redirects To | Archived Component | Intent |
|----------|--------------|--------------------|--------|
| `/overview` | `/` | Overview.tsx | ✅ Intentional — merged into dashboard |
| `/executive-dashboard` | `/command-center` | ExecutiveDashboard.tsx | ✅ Intentional — consolidated |
| `/marketing-intelligence` | `/marketing` | MarketingDeepIntelligence.tsx, MarketingAnalytics.tsx | ✅ Intentional |
| `/deep-intel` | `/marketing` | — | ✅ Intentional |
| `/meta-dashboard` | `/marketing` | MetaDashboard.tsx | ✅ Intentional |
| `/money-map` | `/marketing` | CampaignMoneyMap.tsx | ✅ Intentional |
| `/attribution-leaks` | `/attribution` | AttributionLeaks.tsx | ✅ Intentional |
| `/reconciliation` | `/attribution` | ReconciliationDashboard.tsx | ✅ Intentional |
| `/hubspot-analyzer` | `/sales-pipeline` | HubSpotAnalyzer.tsx | ✅ Intentional |
| `/setter-activity-today` | `/sales-tracker` | SetterActivityToday.tsx | ✅ Intentional |
| `/yesterday-bookings` | `/sales-tracker` | YesterdayBookings.tsx | ✅ Intentional |
| `/stripe` | `/revenue` | StripeIntelligence.tsx | ✅ Intentional |
| `/leaderboard` | `/sales-tracker` | TeamLeaderboard.tsx | ✅ Intentional |
| `/ai-knowledge` | `/global-brain` | AIKnowledge.tsx | ✅ Intentional |
| `/ai-learning` | `/global-brain` | AILearning.tsx | ✅ Intentional |
| `/operations` | `/calls` | Operations.tsx | ✅ Intentional |
| `/observability` | `/enterprise/observability` | Observability.tsx | ✅ Intentional |
| `/sales-coach-tracker` | `/sales-tracker` | — | ✅ Intentional (alias) |
| `/call-tracking` | `/calls` | — | ✅ Intentional (alias) |
| `/audit-trail` | `/audit` | — | ✅ Intentional (alias) |
| `/skills-matrix` | `/skills` | — | ✅ Intentional (alias) |

---

## 3. Archived Pages With NO Route and NO Redirect

These are in `_archived/` but have **no route** and **no redirect**. Hitting their old paths would 404.

| Archived File | Old Path (from plans) | Status | Recommendation |
|---------------|------------------------|--------|----------------|
| **LeadFollowUp.tsx** | `/lead-follow-up` | ⚠️ **UNCERTAIN** | Planned in `lead-follow-up-command-center.md`, marked WORKING in page-audit. Distinct feature (lead status, overdue, reassignment). **Consider restoring** or add redirect to `/sales-tracker` if consolidated. |
| **AIBusinessAdvisor.tsx** | `/ai-advisor` (old) | ✅ Replaced | Live `/ai-advisor` uses EnterpriseAIAdvisor. Old component archived. |
| **AIDevConsole.tsx** | `/ai-dev` | ⚠️ **UNCERTAIN** | No route in main.tsx. COMPLETE-DASHBOARDS lists it. May have been removed on purpose (dev-only). |
| **MasterControlPanel.tsx** | (admin) | ✅ Intentional | Admin/edge function manager — no public route. |
| **WorkflowStrategy.tsx** | (embedded in Operations) | ✅ Intentional | Operations archived → redirects to `/calls`. WorkflowStrategy was embedded there. |
| **HubSpotLiveData.tsx** | `/hubspot-live` | ⚠️ **NO REDIRECT** | No redirect for `/hubspot-live`. Would 404. May have been folded into another page. |

---

## 4. Planned Pages (from docs) vs Current State

### From `page-audit.md` (TIER 1–7)

| Page | Planned Path | Current State |
|------|--------------|---------------|
| Executive Overview | `/executive-overview` | Live at `/dashboard` (ExecutiveOverview) |
| Executive Dashboard | `/executive-dashboard` | Redirect → `/command-center` |
| Command Center | `/command-center` | ✅ Live |
| Setter Command Center | `/setter-command-center` | ✅ Live (active page, not archived) |
| Lead Follow-Up | `/lead-follow-up` | ❌ **Archived, no route** |
| Setter Activity Today | `/setter-activity-today` | Redirect → `/sales-tracker` |
| Sales Pipeline | `/sales-pipeline` | ✅ Live |
| Sales Coach Tracker | `/sales-coach-tracker` | Redirect → `/sales-tracker` |
| Team Leaderboard | `/leaderboard` | Redirect → `/sales-tracker` |
| Marketing Intelligence | `/marketing-intelligence` | Redirect → `/marketing` |
| Campaign Money Map | `/money-map` | Redirect → `/marketing` |
| Revenue Intelligence | `/stripe` | Redirect → `/revenue` |
| Clients | `/clients` | ✅ Live |
| Coaches | `/coaches` | ✅ Live |
| Interventions | `/interventions` | ✅ Live |
| War Room | `/war-room` | ✅ Live |
| Global Brain | `/global-brain` | ✅ Live |
| AI Business Advisor | `/ai-advisor` | ✅ Live (EnterpriseAIAdvisor) |
| Skill Command Center | `/skills-matrix` | Redirect → `/skills` |
| Reconciliation | `/reconciliation` | Redirect → `/attribution` |
| Call Tracking | `/call-tracking` | Redirect → `/calls` |
| HubSpot Live | `/hubspot-live` | ❌ **No route, no redirect** |
| Analytics | `/analytics` | ❌ **No route** (archived) |
| Audit Trail | `/audit-trail` | Redirect → `/audit` |
| Stripe Intelligence | `/stripe` | Redirect → `/revenue` |
| Yesterday Bookings | `/yesterday-bookings` | Redirect → `/sales-tracker` |
| Master Control Panel | (admin) | No route (intentional) |
| AI Dev Console | `/ai-dev` | ❌ **No route** |
| AI Knowledge | `/ai-knowledge` | Redirect → `/global-brain` |
| AI Learning | `/ai-learning` | Redirect → `/global-brain` |
| Observability | `/observability` | Redirect → `/enterprise/observability` |
| Operations | `/operations` | Redirect → `/calls` |
| HubSpot Analyzer | `/hubspot-analyzer` | Redirect → `/sales-pipeline` |
| Workflow Strategy | (embedded) | Was in Operations |

### From `COMPLETE-DASHBOARDS-AND-PAGES.md` (wiki)

| Page | Planned Path | Current State |
|------|--------------|---------------|
| Dashboard | `/` or `/dashboard` | ✅ Live |
| Sales Pipeline | `/sales-pipeline` | ✅ Live |
| Stripe | `/stripe` | Redirect → `/revenue` |
| Call Tracking | `/call-tracking` | Redirect → `/calls` |
| HubSpot Live | `/hubspot-live` | ❌ No route |
| Audit Trail | `/audit-trail` | Redirect → `/audit` |
| Clients | `/clients` | ✅ Live |
| Coaches | `/coaches` | ✅ Live |
| Interventions | `/interventions` | ✅ Live |
| AI Knowledge | `/ai-knowledge` | Redirect → `/global-brain` |
| AI Learning | `/ai-learning` | Redirect → `/global-brain` |
| AI Dev Console | `/ai-dev` | ❌ No route |
| CEO War Room | `/war-room` | ✅ Live |
| Analytics | `/analytics` | ❌ No route |
| Marketing Stress Test | `/marketing-stress-test` | ❌ No route (not in main.tsx) |
| PTD Control | `/ptd-control` | ❌ No route (not in main.tsx) |
| AI CEO | `/ultimate-ceo` | ❌ No route (not in main.tsx) |
| HubSpot Analyzer | `/hubspot-analyzer` | Redirect → `/sales-pipeline` |
| Coach Tracker | `/sales-coach-tracker` | Redirect → `/sales-tracker` |
| Yesterday Bookings | `/yesterday-bookings` | Redirect → `/sales-tracker` |
| Workflow Strategy | `/workflow-strategy` | Was in Operations |
| Operations | `/operations` | Redirect → `/calls` |
| Overview | `/overview` | Redirect → `/` |
| Meta Dashboard | `/meta-dashboard` | Redirect → `/marketing` |
| Setter Activity Today | `/setter-activity-today` | Redirect → `/sales-tracker` |

---

## 5. Pages You May Have Removed (Uncertain)

| Page | Evidence | Recommendation |
|------|----------|----------------|
| **Lead Follow-Up** | Planned in PRD, marked WORKING in page-audit, distinct feature (view_lead_follow_up). No route, no redirect. | **Restore** if lead-level tracking is still needed. Add route `/lead-follow-up` → LeadFollowUp (un-archive) OR add redirect to `/sales-tracker` and document that it was consolidated. |
| **HubSpot Live** | In COMPLETE-DASHBOARDS, page-audit. No route, no redirect. | Add redirect to `/marketing` or `/sales-pipeline` if consolidated, or restore if real-time HubSpot feed is needed. |
| **Analytics** | In page-audit, COMPLETE-DASHBOARDS. Archived. No route. | Likely consolidated into Marketing or other pages. Add redirect if old links exist. |
| **AI Dev Console** | In COMPLETE-DASHBOARDS. Dev tool. No route. | If dev-only, may be intentional. Add route `/ai-dev` if needed for debugging. |
| **Marketing Stress Test** | In COMPLETE-DASHBOARDS. No route. | May never have been implemented or was experimental. |
| **PTD Control** | In COMPLETE-DASHBOARDS. No route. | May be at different path (e.g. `/intelligence` or `/daily-ops`). |
| **AI CEO / Ultimate CEO** | In COMPLETE-DASHBOARDS. No route. | May be consolidated into War Room or Intelligence. |

---

## 6. Archived Files → Consolidation Map

| Archived File | Replaced By / Redirect Target |
|---------------|-------------------------------|
| SetterActivityToday.tsx | SalesCoachTracker (`/sales-tracker`) |
| SetterCommandCenter.tsx | SetterCommandCenter.tsx (active — duplicate in archive, newer in pages/) |
| LeadFollowUp.tsx | **None** — no replacement |
| AILearning.tsx | GlobalBrain |
| Analytics.tsx | **None** (or Marketing?) |
| ReconciliationDashboard.tsx | MarketingIntelligence (`/attribution`) |
| MasterControlPanel.tsx | (admin, no route) |
| TeamLeaderboard.tsx | SalesCoachTracker |
| StripeIntelligence.tsx | RevenueIntelligence |
| YesterdayBookings.tsx | SalesCoachTracker |
| HubSpotAnalyzer.tsx | SalesPipeline |
| ExecutiveDashboard.tsx | CommandCenter |
| CampaignMoneyMap.tsx | MarketingIntelligence |
| Operations.tsx | CallTracking (`/calls`) |
| Overview.tsx | ExecutiveOverview (`/`) |
| HubSpotLiveData.tsx | **None** — no redirect |
| Observability.tsx | EnterpriseSystemObservability |
| WorkflowStrategy.tsx | (was in Operations) |
| AIBusinessAdvisor.tsx | EnterpriseAIAdvisor |
| AIDevConsole.tsx | **None** — no route |
| AIKnowledge.tsx | GlobalBrain |
| AttributionLeaks.tsx | MarketingIntelligence |
| MarketingAnalytics.tsx | MarketingIntelligence |
| AttributionWarRoom.tsx | MarketingIntelligence |
| MarketingDeepIntelligence.tsx | MarketingIntelligence |
| MetaDashboard.tsx | MarketingIntelligence |

---

## 7. Action Items

### High confidence — intentional removals
- All pages with redirects: archived on purpose, functionality consolidated.

### Uncertain — verify intent
1. **Lead Follow-Up** — Restore route + un-archive, or add redirect + document.
2. **HubSpot Live** — Add redirect or restore if real-time feed is needed.
3. **Analytics** — Add redirect to `/marketing` if old links exist.
4. **AI Dev Console** — Add route if dev tool is needed.

### Optional cleanup
- Remove duplicate `SetterCommandCenter.tsx` from `_archived` (active version lives in `pages/`).
- Update `page-audit.md` to mark Lead Follow-Up as archived/redirected.
- Update `COMPLETE-DASHBOARDS-AND-PAGES.md` to reflect current routes.

---

## 8. Quick Reference: Path → Component

```
/dashboard          → ExecutiveOverview
/command-center     → CommandCenter
/marketing          → MarketingIntelligence
/sales-pipeline     → SalesPipeline
/revenue            → RevenueIntelligence
/attribution        → MarketingIntelligence
/clients            → Clients
/coaches            → Coaches
/interventions      → Interventions
/global-brain       → GlobalBrain
/ai-advisor         → EnterpriseAIAdvisor
/sales-tracker      → SalesCoachTracker  (replaces: setter-activity-today, yesterday-bookings, leaderboard)
/calls              → CallTracking       (replaces: operations, call-tracking)
/setter-command-center → SetterCommandCenter
/skills             → SkillCommandCenter
/war-room           → WarRoom
/intelligence       → BusinessIntelligenceAI
/daily-ops          → DailyOps
/lead-tracking      → LeadTracking
/audit              → AuditTrail
```

---

*Generated from main.tsx, Navigation.tsx, page-audit.md, COMPLETE-DASHBOARDS-AND-PAGES.md, and _archived/ contents.*
