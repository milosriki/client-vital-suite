# Vercel Live Verification + Ideal Work Order — 2026-03-01

> **Purpose:** Verify Vercel live state, UI/columns/flow gaps vs user research (TAB-DATA-CONTRACTS, KNOWLEDGE), ordered execution plan. Context7 MCP not available in session — use when enabled.

---

## 1. Live State Verification

### 1.1 Build & TypeScript ✅

| Check | Result | Evidence |
|-------|--------|----------|
| `npm run build` | ✅ PASS | Exit 0, built in 25.90s |
| `npx tsc --noEmit` | ✅ PASS | Exit 0 |

### 1.2 Vercel Deployment ⚠️

| Check | Result | Evidence |
|-------|--------|----------|
| `vercel ls` | ⚠️ Not authorized | Run `vercel login` or link project |
| Deploy URL | — | Verify manually in Vercel dashboard |

**Action:** Run `vercel login` in terminal, then `vercel ls` to confirm production URL and last deployment status.

### 1.3 Context7 MCP

| Check | Result |
|-------|--------|
| Context7 plugin | Not available in this session (server not in list) |
| When enabled | Run 6 queries per LIVE-STATE-EVALUATION-MEGA-PROMPT §2 before recommendations |

---

## 2. Columns & Flow Data Missing (vs User Research)

### 2.1 From TAB-DATA-CONTRACTS

| Tab | Required Fields (Contract) | Current Gaps |
|-----|----------------------------|--------------|
| Command Center | ad_spend, leads, bookings, closed_won, campaign rows | Prior null snapshot handling |
| Marketing | ROAS, CPL, top performers, leakage | toFixed null family; Source Badge not implemented |
| Pipeline | stage, owner, source, status | stage/status completeness, owner drift |
| Revenue | paid_amount, deal/client linkage | **Deal↔Stripe missing** — backfill completeness |
| Attribution | source, medium, campaign, conversion | **call→ad missing**; route shared with marketing |
| Clients | health score, sessions_30d, cancel_rate | schema-contract drift |
| Daily Ops | snapshot_date, summary KPIs | Historical null snapshot_date failures |
| Lead Tracking | lead status, owner, source, follow-up due | status coverage, deal association gaps |
| Meta Ads | spend, impressions, leads, CPL, ROAS | Token/connection health; **purchase_value = 0** |

### 2.2 From KNOWLEDGE.md (Forensic Audit)

| Gap | Impact | Severity |
|-----|--------|----------|
| **Deal↔Stripe** | Cannot verify revenue per deal | CRITICAL |
| **call→ad** | Cannot say "this call came from this ad" | CRITICAL |
| **CPL** | Not computed | HIGH |
| **CPO** | Not computed | HIGH |
| **VisualDNA purchase_value** | ROAS = 0 for all creatives | HIGH |
| **Campaign ID** | Only campaign_name stored; join by name fragile | HIGH |
| **Adset ID** | Not captured | HIGH |

### 2.3 Source Badge (TAB-DATA-CONTRACTS)

- **Status:** Not implemented
- **Required:** `<SourceBadge source="HubSpot" freshness="2h ago" />` on 5 tabs
- **Tabs:** Command Center, Marketing, Pipeline, Revenue, Clients

---

## 3. toFixed Null-Safety Audit (Risky)

Components **without** `?? 0` or `?.` guard before `.toFixed()`:

| File | Line | Risk |
|------|------|------|
| MillionDollarPanel.tsx | 202, 302, 333 | roas, cpl, cpa, roas |
| VisualDNA.tsx | 68, 99, 110 | trueRoas, ad.ctr, platformRoas |
| MetaAdsCreatives.tsx | 196, 417, 421, 478–480, 588–591 | c.ctr, c.cpa, c.roas |
| HealthChart.tsx | 40, 54 | zone.percentage |
| CreativeGallery.tsx | 115, 157, 164, 172 | creative.roas, cpa_aed, ctr_pct, frequency |
| ClientRiskMatrix.tsx | 55, 158 | score, health_score (has ?. but toFixed on result) |
| CohortWaterfall.tsx | 103, 111, 203, 216 | conversionToNext, dropOff |
| DailyOptimization.tsx | 16, 26, 46 | value, delta |
| SourceTruthMatrix.tsx | 111, 205 | gap, avgFb |
| ConversionFunnel.tsx | 279 | conversionRate |

**Already safe:** DailyTrends, ZoneDistributionBar, CoachLeaderboard, BusinessIntelligenceAI (kpis guards), CommandCenter (Number(r?.roas ?? 0)), ExecutiveOverview, MarketingIntelligence (Number(...)), MetricDrilldownModal (item.change ?? 0).

---

## 4. Ideal Work Order (Execution Plan)

Execute in this order. Each step verifies before next.

### Phase 1 — P0 Launch Blockers (1–2 hrs)

| Order | Task | File(s) | Verification |
|-------|------|---------|---------------|
| 1 | MetricDrilldownModal item.change | MetricDrilldownModal.tsx:155 | `(item.change ?? 0)` in className check |
| 2 | toFixed null guards (P0 components) | MillionDollarPanel, VisualDNA, MetaAdsCreatives, HealthChart | `(x ?? 0).toFixed(n)` |
| 3 | sync-aws-full.cjs cancel filter | sync-aws-full.cjs:143 | `status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked'` |
| 4 | Error boundaries | DailyOps, CommandCenter, ExecutiveOverview | Wrap in ErrorBoundary |
| 5 | `npm run build` + `npx tsc --noEmit` | — | Both pass |

### Phase 2 — P1 High Impact (Order by Dependency)

| Order | Task | Depends On | Effort |
|-------|------|------------|--------|
| 6 | Source badge (5 tabs) | Phase 1 | M |
| 7 | toFixed audit (remaining) | Phase 1 | S |
| 8 | Standardized error shape | — | M |
| 9 | Context7 pre-bake in KNOWLEDGE | Context7 MCP | S |
| 10 | VisualDNA purchase_value | Meta sync | S |

### Phase 3 — Attribution (L — Requires Schema + Backfill)

| Order | Task | Depends On | Effort |
|-------|------|------------|--------|
| 11 | Deal↔Stripe: add deal_id→invoice_id FK | Migration | L |
| 12 | Deal↔Stripe: backfill from Stripe webhooks | Step 11 | L |
| 13 | call→ad: extend call_records schema | Migration | L |
| 14 | call→ad: enrich from attribution_events | Step 13 | L |

### Phase 4 — Deploy & Verify

| Order | Task | Verification |
|-------|------|---------------|
| 15 | `supabase db push` | Migrations applied |
| 16 | `supabase functions deploy --all` | 143+ functions |
| 17 | `git push` (Vercel auto-deploy) | Deployment succeeds |
| 18 | Manual: BusinessIntelligenceAI, CommandCenter, DailyOps, ExecutiveOverview | No console errors |
| 19 | Manual: Core tabs load | No crash |

---

## 5. Context7 Gate (When Available)

Before any recommendation, run:

1. `resolve-library-id` supabase → Edge function error handling
2. `query-docs` → try-catch, JSON error response
3. `resolve-library-id` react → React 19 null safety
4. `query-docs` → optional chaining, toFixed guards
5. `resolve-library-id` postgres → view best practices
6. `query-docs` → partial indexes

Cite in output: `Per Context7 [library]: [pattern]`

---

## 6. Summary

| Item | Status |
|------|--------|
| Build | ✅ Pass |
| TypeScript | ✅ Pass |
| Vercel deploy | ⚠️ Auth needed |
| Context7 MCP | Not in session (installed but not active) |
| Columns missing | Deal↔Stripe, call→ad, CPL, CPO, purchase_value |
| Flow data missing | Source badge, attribution chain |
| Ideal order | Phase 1 (P0) → Phase 2 (P1) → Phase 3 (Attribution) → Phase 4 (Deploy) |

---

## 7. Execution Log — 2026-03-01 (Autonomous)

| Order | Task | Status | Evidence |
|-------|------|--------|----------|
| 1 | MetricDrilldownModal item.change | ✅ DONE | `(item.change ?? 0)` in className + icon check |
| 2 | toFixed null guards (P0) | ✅ DONE | MillionDollarPanel, VisualDNA, MetaAdsCreatives, HealthChart |
| 3 | sync-aws-full.cjs cancel filter | ✅ Already done | Line 144 has correct filter |
| 4 | Error boundaries | ✅ Already done | DailyOps, CommandCenter, ExecutiveOverview wrapped |
| 5 | Build + tsc | ✅ PASS | Exit 0 both |

---

## Related Docs

- LIVE-STATE-EVALUATION-MEGA-PROMPT-2026-03-01.md
- 10X-EVALUATION-REPORT-2026-03-01.md
- TAB-DATA-CONTRACTS.md
- KNOWLEDGE.md
- DEPLOY-CHECKLIST-2026-03-01.md
