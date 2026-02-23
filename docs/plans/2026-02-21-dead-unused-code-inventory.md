# Dead / Unused Code — Built But Lost

**Date:** 2026-02-21  
**Purpose:** Inventory of all code that exists, works, and was built — but is unreachable because the routes/pages were archived.

---

## Summary

| Category | Count |
|-----------|-------|
| **Archived pages** (complete, runnable) | 26 |
| **Orphaned components** (only used by archived) | 7 |
| **Orphaned hooks** | 1 |
| **Orphaned edge function calls** | 2 |
| **Database views/RPCs** (no live UI) | 3 |

---

## 1. Archived Pages — Ready to Restore

All in `src/pages/_archived/`. Add route in `main.tsx` to restore.

| File | Lines | Data Source | Restore Effort |
|------|-------|-------------|----------------|
| **LeadFollowUp.tsx** | 364 | view_lead_follow_up | Add route `/lead-follow-up` |
| **SetterActivityToday.tsx** | 378 | call_records, deals, contacts | Add route or tab |
| **YesterdayBookings.tsx** | 369 | intervention_log, client_health_scores | Add route or tab |
| **TeamLeaderboard.tsx** | 265 | call_records, leads, deals, staff | Add route or tab |
| **Operations.tsx** | 127 | HubSpot, Calls, Automation, Settings | Add route `/operations` |
| **WorkflowStrategy.tsx** | 796 | ai_execution_metrics, agent_decisions | Add route or embed in Operations |
| **HubSpotAnalyzer.tsx** | 150 | Supabase | Add route or embed |
| **HubSpotLiveData.tsx** | 113 | useHubSpotRealtime | Add route `/hubspot-live` |
| **CampaignMoneyMap.tsx** | 177 | get_campaign_money_map RPC | Add route or tab in Marketing |
| **Analytics.tsx** | 243 | weekly_health_summary, client_health_scores | Add route `/analytics` |
| **Observability.tsx** | 458 | ai_execution_metrics | Already replaced by Enterprise — keep archived |
| **ReconciliationDashboard.tsx** | 269 | aws-truth-alignment | Add route or tab |
| **AttributionLeaks.tsx** | 499 | data-reconciler | Add route or tab |
| **AttributionWarRoom.tsx** | — | data-reconciler | Add route or tab |
| **ExecutiveDashboard.tsx** | — | aws_truth_cache | Replaced by Command Center |
| **Overview.tsx** | — | weekly_health_summary | Replaced by dashboard |
| **StripeIntelligence.tsx** | — | stripe | Replaced by Revenue |
| **MetaDashboard.tsx** | — | — | Replaced by Marketing |
| **MarketingAnalytics.tsx** | — | — | Replaced by Marketing |
| **MarketingDeepIntelligence.tsx** | — | — | Replaced by Marketing |
| **AIKnowledge.tsx** | — | agent_knowledge | Replaced by Global Brain |
| **AILearning.tsx** | — | agent_decisions | Replaced by Global Brain |
| **AIBusinessAdvisor.tsx** | — | edge function | Replaced by Enterprise AI Advisor |
| **AIDevConsole.tsx** | 122 | — | Add route `/ai-dev` if needed |
| **MasterControlPanel.tsx** | — | — | Admin, no route |
| **SetterCommandCenter.tsx** (archived) | 566 | Different impl | Active version in pages/ |

---

## 2. Orphaned Components — Only Used by Archived Pages

These components exist and work but are **only imported by archived pages**. No live route reaches them.

### `src/components/hubspot-live/` (entire folder — 4 files)

| File | Purpose | Used By |
|------|---------|---------|
| **useHubSpotRealtime.ts** | Hook: leads, deals, calls, staff with timeframe | HubSpotLiveData (archived) |
| **HubSpotKPIs.tsx** | KPI cards (Total Leads, Conversion Rate, etc.) | HubSpotLiveData (archived) |
| **HubSpotFilters.tsx** | Timeframe selector, Refresh, Clear Fake Data | HubSpotLiveData (archived) |
| **HubSpotTabs.tsx** | Tab content for leads, deals, calls, staff | HubSpotLiveData (archived) |

**To use:** Restore route `/hubspot-live` → HubSpotLiveData, or create new page that imports these.

---

### `src/components/ptd/` (3 components — only used by archived Operations)

| File | Purpose | Used By |
|------|---------|---------|
| **HubSpotCommandCenter.tsx** | ~565 lines. HubSpot security/activity: overview, user detail, risky contacts. Calls `hubspot-command-center` edge function. | Operations (archived) |
| **AutomationTab.tsx** | CSV validation, automation rules, pipeline monitor | Operations (archived) |
| **SettingsTab.tsx** | System settings, n8n config, health checks | Operations (archived) |

**To use:** Restore route `/operations` → Operations. Operations imports all three.

---

## 3. Orphaned Edge Function Calls

These edge functions are **deployed and active** but **no live page invokes them**:

| Edge Function | Purpose | Last Used By |
|---------------|---------|--------------|
| **hubspot-command-center** | HubSpot user activity, security events, risky contacts | HubSpotCommandCenter (in archived Operations) |
| **aws-truth-alignment** | AWS Backoffice vs HubSpot reconciliation, force align | ReconciliationDashboard (archived) |
| **data-reconciler** | Attribution discrepancies, FB vs HubSpot vs AnyTrack | AttributionLeaks, AttributionWarRoom (archived) |

**Note:** MarketingIntelligence Source Truth tab uses `useDeepIntelligence` and `view_truth_triangle` — NOT data-reconciler or aws-truth-alignment. Those two functions have no live UI.

---

## 4. Database Views / RPCs — No Live UI

| Object | Purpose | Last Used By |
|--------|---------|--------------|
| **view_lead_follow_up** | 6,617 rows. Lead status, setter, last call, flags, priority | LeadFollowUp (archived) |
| **get_campaign_money_map** RPC | Per-campaign ROI: spend, leads, revenue, CPL, CPO, ROAS | CampaignMoneyMap (archived) |
| **weekly_health_summary** | Weekly health trend (12 weeks) | Analytics, Overview (archived) |

**Note:** MarketingIntelligence Money Map tab uses `useMoneyMap` (raw facebook_ads_insights + deals) — does NOT call `get_campaign_money_map` RPC. The RPC gives per-campaign breakdown; useMoneyMap gives aggregate.

---

## 5. Quick Restore Guide

### Restore Lead Follow-Up (highest value)
```tsx
// main.tsx - add import
const LeadFollowUp = lazyWithRetry(() => import("./pages/_archived/LeadFollowUp"));

// Add route
{ path: "/lead-follow-up", element: <SuspensePage><LeadFollowUp /></SuspensePage> },
```

### Restore Operations (unlocks HubSpot, Automation, Settings)
```tsx
// main.tsx - add import (Operations imports from same folder)
const Operations = lazyWithRetry(() => import("./pages/_archived/Operations"));

// Add route
{ path: "/operations", element: <SuspensePage><Operations /></SuspensePage> },
// Remove redirect: { path: "/operations", element: <Navigate to="/calls" replace /> },
```

### Restore HubSpot Live
```tsx
const HubSpotLiveData = lazyWithRetry(() => import("./pages/_archived/HubSpotLiveData"));
{ path: "/hubspot-live", element: <SuspensePage><HubSpotLiveData /></SuspensePage> },
```

### Restore Analytics
```tsx
const Analytics = lazyWithRetry(() => import("./pages/_archived/Analytics"));
{ path: "/analytics", element: <SuspensePage><Analytics /></SuspensePage> },
```

### Add get_campaign_money_map to Marketing Money Map tab
In `useMarketingAnalytics.ts` or MarketingIntelligence MoneyMapTab — add optional call to `supabase.rpc('get_campaign_money_map', { days_back: 90 })` and render per-campaign table when available.

---

## 6. Files to Un-Archive (Move Back to pages/)

If you restore routes, you can either:
- **Option A:** Keep in `_archived/` and import from there (works, but messy)
- **Option B:** Move back to `pages/` for cleanliness

Recommended moves for high-value pages:
- `_archived/LeadFollowUp.tsx` → `pages/LeadFollowUp.tsx`
- `_archived/Operations.tsx` → `pages/Operations.tsx`
- `_archived/HubSpotLiveData.tsx` → `pages/HubSpotLiveData.tsx`
- `_archived/Analytics.tsx` → `pages/Analytics.tsx`

---

*Generated from grep analysis of imports, routes, and component usage.*
