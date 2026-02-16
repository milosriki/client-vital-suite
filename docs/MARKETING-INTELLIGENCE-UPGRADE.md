# Marketing Intelligence Upgrade Plan

> PTD Fitness · client-vital-suite · February 2026
> Currency: **AED** throughout. No USD.

---

## 1. INVENTORY

### Pages

| # | Page | Lines | Status | Notes |
|---|------|-------|--------|-------|
| 1 | `MarketingIntelligence.tsx` | 526 | ✅ Built | Main overview. VisualDNA, PulseIndicator, XRayTooltip, ghost loading, period deltas. Calls `business-intelligence-dashboard` edge fn |
| 2 | `MarketingAnalytics.tsx` | 573 | ✅ Built | 4 tabs: Overview, Deep Analysis, Meta Ads, Money Map. Has mock fallback |
| 3 | `MarketingDeepIntelligence.tsx` | 1284 | ✅ Built | Baselines, 2-stage funnel, loss analysis, CEO brief, projections, source discrepancies, assessment truth |
| 4 | `MetaDashboard.tsx` | 211 | ⚠️ Partial | Raw table dump of `facebook_ads_insights`. No analysis, just sync + table |
| 5 | `AttributionLeaks.tsx` | 498 | ✅ Built | Attribution gap analysis |
| 6 | `AttributionWarRoom.tsx` | — | ✅ Built | War room view |
| 7 | `RevenueIntelligence.tsx` | 711 | ✅ Built | Revenue analysis |

### UI Components

| Component | Status | Notes |
|-----------|--------|-------|
| `VisualDNA.tsx` | ✅ Built | Creative cards, Pipeboard thumbnails, True ROAS, integrity score |
| `PulseIndicator.tsx` | ✅ Built | Pulse dots (success/warning/destructive/default) |
| `x-ray-tooltip.tsx` | ✅ Built | Hover "why" tooltips |
| `Skeleton` / Ghost loading | ✅ Built | Generic + `MarketingIntelligenceGhost.tsx` |
| Source Truth Matrix UI | ❌ Missing | Data exists in `useDeepIntelligence` → `SourceDiscrepancy` type. No dedicated visual |
| Daily Optimization Cards | ❌ Missing | `daily_business_metrics` has the data. No recommendation UI |
| Truth Triangle Visual | ❌ Missing | `view_truth_triangle` exists in DB. No chart/visual component |
| Cohort Progression Tracker | ⚠️ Partial | Monthly cohorts in `useDeepAnalysis`. No lifecycle stage waterfall |
| AED Currency Formatter | ⚠️ Partial | Some pages still render `$` instead of `AED` |

### Hooks

| Hook | Status | Data Source | Returns |
|------|--------|-------------|---------|
| `usePeriodComparison` | ✅ Built | `daily_business_metrics` + `contacts` + Stripe | Period deltas: revenue, leads, members, ROAS, ad spend |
| `useDeepAnalysis` | ✅ Built | `facebook_ads_insights` | Baseline comparison (current vs 12mo), monthly cohorts |
| `useMetaAds` | ✅ Built | `facebook_ads_insights` | Campaign-level metrics |
| `useMoneyMap` | ✅ Built | `facebook_ads_insights` + `deals` + `stripe_transactions` | ROI calculation |
| `useDeepIntelligence` | ✅ Built | Multiple | Baselines, funnel, loss analysis, source discrepancies, CEO brief, projections |
| `useDailyOptimization` | ❌ Missing | `daily_business_metrics` | Daily trends + AI recommendations |
| `useTruthTriangle` | ❌ Missing | `view_truth_triangle` | Monthly cross-source reconciliation |
| `useCohortProgression` | ❌ Missing | `deals` + `dealStages.ts` | Lifecycle stage waterfall per cohort |

### Database Tables & Views

| Table/View | Status | Records | Key Fields |
|------------|--------|---------|------------|
| `facebook_ads_insights` | ✅ | — | spend, leads, clicks, impressions, ctr, cpc, frequency, campaign/adset/ad names, roas, conversions |
| `daily_business_metrics` | ✅ | — | ad_spend_facebook, total_leads_new, roas_daily, total_revenue_booked, cost_per_lead, anytrack_leads |
| `funnel_metrics` | ✅ | — | Full funnel stages, health status per department |
| `historical_baselines` | ✅ | — | By dimension/period, avg_roas, avg_cpl, trend_direction, best/worst weeks |
| `attribution_chain` | ✅ | 286 (57 w/ ad_id) | FormSubmit→Lead→Contact |
| `attribution_events` | ✅ | 1,954 | Event-level attribution |
| `view_truth_triangle` | ✅ | — | Monthly: meta spend, meta revenue, HS deals, Stripe gross, gaps, pipeline ROAS, true ROAS |
| `view_contact_360` | ✅ | — | 7-source contact view |
| `view_atlas_lead_dna` | ✅ | — | Lead DNA |
| `contacts` | ✅ | 10,552 | lifecycle_stage, attributed_ad_id (50 have it) |
| `deals` | ✅ | 19,474 | Stage mapping via `dealStages.ts` |

---

## 2. GAP ANALYSIS

### Gap 1: Source Truth Matrix — Dedicated UI
- **What exists**: `useDeepIntelligence` returns `SourceDiscrepancy` type with `fb_reported_leads`, `anytrack_leads`, `supabase_contacts`, `max_discrepancy_pct`, `trust_verdict`
- **What's missing**: A standalone, scannable component showing the 3-source comparison as a visual matrix (not buried inside DeepIntelligence page)
- **Impact**: This is the single most important trust signal for Milos. He needs to see at a glance whether tracking is reliable.

### Gap 2: Daily Optimization View
- **What exists**: `daily_business_metrics` has daily spend, leads, ROAS, CPL, conversion rate
- **What's missing**: A time-series chart (last 7/14/30 days) with trend lines + threshold-based recommendations (e.g., "CPL spiked 40% yesterday — check ad creative rotation")
- **Impact**: No daily actionable view exists. All current views are period-summary or campaign-level.

### Gap 3: Cohort Lifecycle Progression
- **What exists**: `useDeepAnalysis` has monthly cohorts (by signup month). `deals` table has full stage data. `dealStages.ts` maps all HubSpot stages.
- **What's missing**: A waterfall/sankey showing how a cohort (e.g., "Jan 2026 leads") progresses through Booked → Held → Assessment Done → Payment Pending → Closed Won. Drop-off rates per stage.
- **Impact**: Can't see where in the funnel leads die, by acquisition month.

### Gap 4: Truth Triangle Visual
- **What exists**: `view_truth_triangle` in Supabase with monthly cross-source reconciliation data
- **What's missing**: A visual (3-point chart or table with conditional formatting) showing Meta vs HubSpot vs Stripe alignment per month. The `gap_stripe_hubspot` and dual ROAS columns (`pipeline_roas_booked` vs `true_roas_cash`) need visual treatment.
- **Impact**: The "truth" is in the DB but invisible in the UI.

### Gap 5: AED Currency Consistency
- **What exists**: Some components properly show AED, others still use `$` or no currency symbol
- **What's missing**: A shared `formatAED(amount)` utility used everywhere. Audit all marketing pages for `$` literals.
- **Impact**: Confuses the team; AED values displayed as USD are misleading (1 USD ≈ 3.67 AED).

### Gap 6: MetaDashboard is Redundant
- **What exists**: `MetaDashboard.tsx` is a raw table of `facebook_ads_insights` with a sync button
- **What's missing**: Nothing — this is just a worse version of what `MarketingAnalytics.tsx` Meta Ads tab already shows
- **Impact**: Navigation clutter. Should be absorbed or demoted to a debug/admin view.

---

## 3. DESIGN SPEC — Missing/Partial Features

### 3.1 Source Truth Matrix Component

```
Data source:  useDeepIntelligence().sourceDiscrepancies (already returns it)
Hook:         No new hook needed — extend useDeepIntelligence if needed, or consume directly
Component:    <SourceTruthMatrix discrepancies={SourceDiscrepancy[]} />
              - 3-column comparison: FB Reported | AnyTrack | Supabase Contacts
              - Per-row: metric name, 3 values, discrepancy %, trust badge (PulseIndicator)
              - XRayTooltip on trust_verdict explaining why trust is low/medium/high
              - Conditional row highlighting: green <10%, yellow 10-25%, red >25%
Where:        MarketingIntelligence.tsx — new section below period comparison cards
              Also linkable from MarketingDeepIntelligence.tsx Source Discrepancies section
```

### 3.2 Daily Optimization View

```
Data source:  daily_business_metrics (last 30 days)
Hook:         NEW: useDailyOptimization(days: number)
              - Query daily_business_metrics ORDER BY metric_date DESC LIMIT {days}
              - Compute: 7-day moving averages for spend, CPL, ROAS
              - Compute: day-over-day deltas
              - Generate recommendations array:
                if cpl_delta > 0.2 → "CPL up {x}% — review ad fatigue"
                if roas_daily < historical_baselines.avg_roas * 0.8 → "ROAS below baseline"
                if total_leads_new === 0 → "Zero leads — check tracking"
Component:    <DailyOptimization data={DailyOptData} />
              - Line chart: spend + leads + ROAS (dual axis) over time
              - Recommendation cards below chart with PulseIndicator severity
              - Use Skeleton loading while fetching
Where:        NEW TAB in MarketingIntelligence.tsx or MarketingAnalytics.tsx
```

### 3.3 Cohort Lifecycle Progression

```
Data source:  deals table + dealStages.ts mapping
Hook:         NEW: useCohortProgression(cohortMonth: string)
              - Query deals grouped by createdate month
              - For each deal, map dealstage to the canonical funnel:
                Booked → Held → Assessment Done → Qualified → Payment Pending → Closed Won/Lost
              - Return: { stage: string, count: number, dropoff_pct: number }[]
Component:    <CohortWaterfall cohort={string} stages={StageData[]} />
              - Horizontal funnel bar chart showing progressive narrowing
              - Hover: XRayTooltip with count + % retained from previous stage
              - Month selector dropdown
Where:        MarketingDeepIntelligence.tsx — enhance existing 2-Stage Funnel section
              to show full lifecycle, not just 2 stages
```

### 3.4 Truth Triangle Visual

```
Data source:  view_truth_triangle
Hook:         NEW: useTruthTriangle()
              - SELECT * FROM view_truth_triangle ORDER BY month DESC LIMIT 12
Component:    <TruthTriangle data={TruthTriangleRow[]} />
              - Table with months as rows
              - Columns: Month | Meta Spend | Meta Revenue | HS Deal Value | Stripe Gross | Gap | Pipeline ROAS | True ROAS
              - PulseIndicator on Gap column (green if <10%, red if >25%)
              - XRayTooltip on "True ROAS" explaining: "Cash actually collected ÷ ad spend"
              - Sparkline for True ROAS trend
Where:        MarketingIntelligence.tsx — "Revenue Truth" section
              OR new tab in MarketingAnalytics.tsx
```

### 3.5 AED Currency Utility

```
Hook/Util:    NEW: src/lib/formatAED.ts
              export const formatAED = (amount: number) =>
                `AED ${amount.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              For decimals: formatAEDPrecise with 2 decimal places
Where:        Import everywhere that currently uses $ or toLocaleString with USD
Pages to audit: MarketingIntelligence, MarketingAnalytics, MarketingDeepIntelligence,
                RevenueIntelligence, MetaDashboard, AttributionLeaks, AttributionWarRoom
```

---

## 4. UNIFIED PAGE ARCHITECTURE

### Current State: 7 Disconnected Pages
```
/marketing-intelligence      → MarketingIntelligence.tsx (overview)
/marketing-analytics          → MarketingAnalytics.tsx (4 tabs)
/marketing-deep-intelligence  → MarketingDeepIntelligence.tsx (mega page)
/meta-dashboard               → MetaDashboard.tsx (raw table)
/attribution-leaks            → AttributionLeaks.tsx
/attribution-war-room         → AttributionWarRoom.tsx
/revenue-intelligence         → RevenueIntelligence.tsx
```

### Proposed: 3 Pages, Tab-Based

#### Page 1: `/marketing` — Marketing Command Center
The single entry point. Replaces `MarketingIntelligence.tsx`.

| Tab | Content | Source |
|-----|---------|--------|
| **Overview** | Period comparison cards (deltas), Source Truth Matrix, Truth Triangle summary, VisualDNA top 3 | Merge from `MarketingIntelligence.tsx` + new components |
| **Daily Pulse** | Daily optimization chart + recommendations | NEW (`useDailyOptimization`) |
| **Meta Ads** | Campaign table + creative cards (VisualDNA full) | From `MarketingAnalytics.tsx` Meta Ads tab |
| **Money Map** | ROI flow: spend → leads → deals → revenue | From `MarketingAnalytics.tsx` Money Map tab |

#### Page 2: `/marketing/deep-dive` — Deep Intelligence
For analytical deep dives. Replaces `MarketingDeepIntelligence.tsx` + `MarketingAnalytics.tsx` Deep Analysis tab.

| Tab | Content | Source |
|-----|---------|--------|
| **Baselines** | Historical baselines, trend direction, best/worst weeks | From `MarketingDeepIntelligence.tsx` |
| **Funnel** | Full lifecycle waterfall (cohort progression) | Extend existing 2-stage → full funnel |
| **Cohorts** | Monthly cohort analysis + lifecycle progression | From `useDeepAnalysis` + new `useCohortProgression` |
| **CEO Brief** | Loss analysis, projections, assessment truth | From `MarketingDeepIntelligence.tsx` |
| **Source Truth** | Full source discrepancy matrix + Truth Triangle detail | From `useDeepIntelligence` + `useTruthTriangle` |

#### Page 3: `/marketing/attribution` — Attribution & Leaks
Combines attribution pages. Replaces `AttributionLeaks.tsx` + `AttributionWarRoom.tsx`.

| Tab | Content | Source |
|-----|---------|--------|
| **Leaks** | Attribution gap analysis | From `AttributionLeaks.tsx` |
| **War Room** | Active attribution issues | From `AttributionWarRoom.tsx` |
| **Chain** | Attribution chain explorer (286 records) | New lightweight table on `attribution_chain` |

#### Retired
- **`MetaDashboard.tsx`** → Absorb into Marketing Command Center "Meta Ads" tab. Keep sync button there.
- **`RevenueIntelligence.tsx`** → Content moves to Deep Dive "CEO Brief" tab or stays standalone if sufficiently different. Evaluate overlap.
- **`MarketingAnalytics.tsx`** → Dissolved. Overview → Command Center. Deep Analysis → Deep Dive. Meta Ads → Command Center. Money Map → Command Center.

### Navigation
```
Marketing (sidebar)
├── Command Center        /marketing
├── Deep Dive             /marketing/deep-dive
└── Attribution           /marketing/attribution
```

---

## 5. IMPLEMENTATION PLAN

### Phase 1: Foundation (No new features, just cleanup)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 1.1 | Create `formatAED.ts` utility | 30 min | None |
| 1.2 | Audit all 7 pages for `$` literals → replace with `formatAED()` | 1 hr | 1.1 |
| 1.3 | Extract shared tab layout component (if not using shadcn Tabs already) | 30 min | None |

### Phase 2: New Components (Build the missing pieces)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 2.1 | Build `<SourceTruthMatrix />` component | 2 hr | Consumes `useDeepIntelligence().sourceDiscrepancies` |
| 2.2 | Build `useTruthTriangle` hook | 1 hr | `view_truth_triangle` in Supabase |
| 2.3 | Build `<TruthTriangle />` component | 2 hr | 2.2 |
| 2.4 | Build `useDailyOptimization` hook | 2 hr | `daily_business_metrics` table |
| 2.5 | Build `<DailyOptimization />` component (chart + recs) | 3 hr | 2.4 |
| 2.6 | Build `useCohortProgression` hook | 2 hr | `deals` + `dealStages.ts` |
| 2.7 | Build `<CohortWaterfall />` component | 3 hr | 2.6 |

### Phase 3: Page Consolidation (Wire it together)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 3.1 | Restructure `MarketingIntelligence.tsx` → Command Center with 4 tabs | 3 hr | 2.1, 2.3, 2.5 |
| 3.2 | Merge `MarketingAnalytics.tsx` content into Command Center tabs | 2 hr | 3.1 |
| 3.3 | Restructure `MarketingDeepIntelligence.tsx` → Deep Dive with 5 tabs | 3 hr | 2.7 |
| 3.4 | Merge `AttributionLeaks.tsx` + `AttributionWarRoom.tsx` → Attribution page | 2 hr | None |
| 3.5 | Absorb `MetaDashboard.tsx` sync button into Command Center Meta tab | 30 min | 3.1 |
| 3.6 | Evaluate `RevenueIntelligence.tsx` overlap → merge or keep | 1 hr | 3.3 |
| 3.7 | Update sidebar navigation to 3-page structure | 30 min | 3.1–3.4 |
| 3.8 | Update route definitions | 30 min | 3.7 |

### Phase 4: Polish

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 4.1 | Add PulseIndicator to all threshold-sensitive values | 1 hr | 3.1–3.3 |
| 4.2 | Add XRayTooltips to all new components | 1 hr | 3.1–3.3 |
| 4.3 | Add Skeleton/Ghost states to all new components | 1 hr | 3.1–3.3 |
| 4.4 | Remove mock data fallbacks where real data is now wired | 1 hr | 3.1–3.3 |
| 4.5 | Final AED audit pass | 30 min | All |

### Total Estimated Effort
- **Phase 1**: ~2 hours
- **Phase 2**: ~15 hours
- **Phase 3**: ~13 hours
- **Phase 4**: ~4.5 hours
- **Total**: ~34.5 hours (~4-5 dev days)

### Critical Path
```
formatAED (1.1) → AED audit (1.2)
useTruthTriangle (2.2) → TruthTriangle component (2.3) → Command Center (3.1)
useDailyOptimization (2.4) → DailyOptimization component (2.5) → Command Center (3.1)
useCohortProgression (2.6) → CohortWaterfall (2.7) → Deep Dive (3.3)
useDeepIntelligence (exists) → SourceTruthMatrix (2.1) → Command Center (3.1)
```

---

## Summary

**What's already done**: ~75% of the marketing intelligence system is built. The hooks, data tables, UI primitives (Pulse, XRay, Ghost, VisualDNA), and core pages all exist.

**What's actually needed**:
1. **5 new things**: `formatAED`, `SourceTruthMatrix`, `TruthTriangle`, `DailyOptimization`, `CohortWaterfall`
2. **3 new hooks**: `useTruthTriangle`, `useDailyOptimization`, `useCohortProgression`
3. **Page consolidation**: 7 pages → 3 pages with tabs
4. **Polish pass**: PulseIndicator + XRayTooltip + Skeleton on new components

No new database tables needed. No new edge functions needed. It's a wiring job.
