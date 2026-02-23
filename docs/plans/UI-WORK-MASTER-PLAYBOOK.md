# UI Work Master Playbook — All Findings & Ideas

**Date:** 2026-02-21  
**Purpose:** Single reference for when UI work begins. Consolidates page audit, dead code, loss analysis, and actionable ideas.

---

## Quick Links to Detailed Docs

| Doc | Purpose |
|-----|---------|
| `2026-02-21-page-audit-deep-dive.md` | Planned vs live vs archived, redirects |
| `2026-02-21-pages-deep-explanation-functions-and-loss.md` | Idea, functions, what we lost, how much real |
| `2026-02-21-dead-unused-code-inventory.md` | Dead code, orphaned components, restore snippets |

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| Live routes | 28 primary + 7 enterprise |
| Archived pages | 26 |
| 100% real data (archived) | 22 of 26 |
| Fully lost (no replacement) | 4 |
| Partially lost | 6 |
| Orphaned components | 7 |
| Orphaned edge functions (no UI) | 3 |

---

## 2. Priority Restore List — When UI Work Starts

### Tier 1: Highest Value, Zero-Code Restore (Add Route Only)

| Page | Path | File | Why |
|------|------|------|-----|
| **Lead Follow-Up** | `/lead-follow-up` | `_archived/LeadFollowUp.tsx` | 6,617 rows in view_lead_follow_up. Unique lead-level tracking. No replacement. |
| **Operations** | `/operations` | `_archived/Operations.tsx` | Unlocks HubSpotCommandCenter, AutomationTab, SettingsTab, WorkflowStrategy, HubSpotAnalyzer. |
| **HubSpot Live** | `/hubspot-live` | `_archived/HubSpotLiveData.tsx` | Real-time CRM dashboard. useHubSpotRealtime + 4 components ready. |
| **Analytics** | `/analytics` | `_archived/Analytics.tsx` | Weekly health trend, zone pie. weekly_health_summary exists. |

### Tier 2: High Value, Add Tab or Section

| Page | Idea | Where to Add |
|------|------|--------------|
| **Setter Activity Today** | Today's calls + bookings | Tab in SalesCoachTracker or DailyOps |
| **Yesterday Bookings** | Yesterday's assessments | Section in DailyOps or SalesCoachTracker |
| **Team Leaderboard** | Monthly rankings | Tab in SalesCoachTracker |
| **Campaign Money Map** | Per-campaign ROI (get_campaign_money_map RPC) | Tab in MarketingIntelligence Money Map |
| **Reconciliation / Leak Detector** | aws-truth-alignment, data-reconciler | Tab in Marketing Attribution |

### Tier 3: Consider Later

| Page | Note |
|------|------|
| WorkflowStrategy | 796 lines. Embed in Operations if restored. |
| AIDevConsole | Dev tool. Add `/ai-dev` if needed. |

---

## 3. Exact Code to Add — main.tsx

```tsx
// Add these lazy imports (with other lazy imports)
const LeadFollowUp = lazyWithRetry(() => import("./pages/_archived/LeadFollowUp"));
const Operations = lazyWithRetry(() => import("./pages/_archived/Operations"));
const HubSpotLiveData = lazyWithRetry(() => import("./pages/_archived/HubSpotLiveData"));
const Analytics = lazyWithRetry(() => import("./pages/_archived/Analytics"));

// Add these routes (inside the Layout children, with other routes)
{ path: "/lead-follow-up", element: <SuspensePage><LeadFollowUp /></SuspensePage> },
{ path: "/operations", element: <SuspensePage><Operations /></SuspensePage> },
{ path: "/hubspot-live", element: <SuspensePage><HubSpotLiveData /></SuspensePage> },
{ path: "/analytics", element: <SuspensePage><Analytics /></SuspensePage> },

// REMOVE or COMMENT these redirects (they currently send to /calls or /sales-tracker):
// { path: "/operations", element: <Navigate to="/calls" replace /> },
```

---

## 4. Navigation — Add to NAV_GROUPS

In `src/components/Navigation.tsx`, add to `NAV_GROUPS.MORE` or `MAIN`:

```tsx
{ path: "/lead-follow-up", label: "Lead Follow-Up", icon: Users },      // or Phone, Target
{ path: "/operations", label: "Operations", icon: Settings },
{ path: "/hubspot-live", label: "HubSpot Live", icon: Activity },
{ path: "/analytics", label: "Analytics", icon: BarChart3 },
```

---

## 5. What Each Restored Page Gives You

| Page | Key Features | Data |
|------|--------------|------|
| **Lead Follow-Up** | Lead table, priority, setter filter, going cold flags, days since contact | view_lead_follow_up |
| **Operations** | HubSpot security, Calls, WorkflowStrategy, HubSpotAnalyzer, Settings | hubspot-command-center, CallTracking, ai_execution_metrics |
| **HubSpot Live** | KPIs, leads, deals, calls, staff tabs, Clear Fake Data | useHubSpotRealtime (leads, deals, call_records) |
| **Analytics** | 12-week health trend, zone pie, segment distribution | weekly_health_summary, client_health_scores |

---

## 6. Orphaned Components — Unlocked by Restore

| Restore | Unlocks |
|---------|---------|
| Operations | HubSpotCommandCenter, AutomationTab, SettingsTab, WorkflowStrategy, HubSpotAnalyzer |
| HubSpot Live | useHubSpotRealtime, HubSpotKPIs, HubSpotFilters, HubSpotTabs |

---

## 7. Edge Functions — No Live UI (Restore to Use)

| Function | Restore Via |
|----------|-------------|
| hubspot-command-center | Operations → HubSpotCommandCenter |
| aws-truth-alignment | ReconciliationDashboard (or add tab to Attribution) |
| data-reconciler | AttributionLeaks or AttributionWarRoom (or add tab) |

---

## 8. Database Objects — No Live UI

| Object | Restore Via |
|--------|-------------|
| view_lead_follow_up | LeadFollowUp |
| get_campaign_money_map | CampaignMoneyMap or add to Marketing Money Map tab |
| weekly_health_summary | Analytics |

---

## 9. Ideas for Enhancement (Beyond Restore)

1. **Add "Today" tab to SalesCoachTracker** — Embed SetterActivityToday or similar logic.
2. **Add "Yesterday" section to DailyOps** — Embed YesterdayBookings logic.
3. **Marketing Money Map tab** — Call `get_campaign_money_map` RPC for per-campaign table; keep useMoneyMap for aggregate.
4. **Attribution tab** — Add sub-tabs for data-reconciler and aws-truth-alignment.
5. **Move from _archived to pages/** — After restore, move LeadFollowUp, Operations, etc. to `pages/` for cleanliness.
6. **Admin route** — Add `/admin` or `/master-control` for MasterControlPanel if needed.

---

## 10. Verification Checklist — After Restore

- [ ] `npm run build` passes
- [ ] No new lint errors
- [ ] Each restored route loads without error
- [ ] Navigation shows new items
- [ ] Data loads (check network tab or UI)
- [ ] Redirects still work for old paths (if kept)

---

## 11. File Locations Quick Reference

| What | Where |
|------|-------|
| Routes | `src/main.tsx` (lines ~139–214) |
| Navigation | `src/components/Navigation.tsx` (NAV_GROUPS ~102–137) |
| Archived pages | `src/pages/_archived/*.tsx` |
| HubSpot Live components | `src/components/hubspot-live/` |
| PTD components | `src/components/ptd/` |
| Marketing hooks | `src/hooks/useMarketingAnalytics.ts` |

---

## 12. One-Line Summary

**Restore 4 routes (Lead Follow-Up, Operations, HubSpot Live, Analytics) to unlock 11 archived pages, 7 orphaned components, 3 edge functions, and 3 database views — all with real data, zero new code.**

---

*Consolidated from page-audit-deep-dive, pages-deep-explanation-functions-and-loss, and dead-unused-code-inventory.*
