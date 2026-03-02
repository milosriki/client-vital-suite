# LIVE STATE EVALUATION — Deep Run Result

**Date:** 2026-03-01  
**Prompt:** LIVE-STATE-EVALUATION-MEGA-PROMPT-2026-03-01.md §2–115  
**Context7:** 2/6 calls succeeded (Supabase); 4 failed (React/Postgres timeouts)

---

## 1. Executive Summary

| Dimension | Score | Status |
|-----------|-------|--------|
| **Overall health** | **78/100** | ⚠️ Partial — strong foundation, metrics adoption gap |
| Build | ✅ | `npm run build` exit 0 |
| TypeScript | ✅ | `npx tsc --noEmit` exit 0 |
| Sync bridge | ✅ | PowerBI views, syncReviews, syncDemographics, cancel filter |
| CRAW TODOs | ✅ | **All 6 DONE** (sync-aws-full.cjs:143 already fixed) |
| metrics-calculator | ❌ | **0 imports** — inline formulas in 5+ files |
| toFixed null-safety | ⚠️ | ~15 components still at risk |

**Top 3 10x opportunities:**
1. **metrics-calculator adoption** — Replace inline `revenue/spend`, `spend/leads` with `computeROAS`, `computeCPL` in true-roas-calculator, marketing-stress-test, MarketingIntelligence.tsx, populate-analytics.
2. **toFixed null-safety** — Add `?? 0` or `?.` guard in SourceTruthMatrix, CreativeGallery, CohortWaterfall, DailyOptimization, ConversionFunnel, ClientRiskMatrix.
3. **Attribution chain** — Deal↔Stripe, call→ad (unchanged from 10X-REPORT).

---

## 2. Context7 Verification Log

| Step | Tool | Library | Result |
|------|------|---------|--------|
| 1 | resolve-library-id | supabase | ✅ `/supabase/supabase` |
| 2 | query-docs | /supabase/supabase | ✅ try-catch, `JSON.stringify({ error })`, status 500 |
| 3 | resolve-library-id | react | ✅ `/websites/react_dev` |
| 4 | query-docs | /websites/react_dev | ❌ fetch failed |
| 5 | resolve-library-id | postgres | ❌ connection closed |
| 6 | query-docs | — | ❌ Body Timeout Error |

**Per Context7 [Supabase]:** Edge functions should wrap logic in try-catch, return `new Response(JSON.stringify({ error: error.message }), { status: 500 })` on error. Use `console.error` for logging; Sentry for monitoring.

---

## 3. Live State Verification Table

| Check | Method | Result |
|-------|--------|--------|
| Build | `npm run build` | ✅ Exit 0 |
| TypeScript | `npx tsc --noEmit` | ✅ Exit 0 |
| PowerBI views | grep aws-sync-bridge.cjs | ✅ vw_powerbi_schedulers, vw_powerbi_clientpackages, vw_powerbi_clients |
| syncReviews | grep syncReviews | ✅ Line 375, 539 |
| syncDemographics | grep syncDemographics | ✅ Line 426, 548 |
| Cancel filter | grep sync-aws-full.cjs | ✅ Line 143–144: `status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked'` |

---

## 4. Plan vs Reality Alignment Matrix

| Source | What It Says | Live Reality | Gap |
|--------|--------------|--------------|-----|
| DEPLOY-CHECKLIST Phase 1 | Phase 1 done, build passes | Build passes | ✅ Aligned |
| 10X-EVALUATION-REPORT | snapshot.kpis RESOLVED, item.change P1 | MetricDrilldownModal:157 has `(item.change ?? 0)` | ✅ Aligned |
| EXECUTION-PLAN Phase 1 | 1.3–1.6 null guards done | Partial; some components still at risk | ⚠️ Partial |
| CRAW-FINDINGS TODO 1–6 | 5 done, 1 open (sync-aws-full cancel) | **All 6 DONE** — sync-aws-full:143 fixed | ✅ Aligned |
| PowerBI views | Switch to vw_powerbi_* | aws-sync-bridge uses vw_powerbi_* | ✅ Aligned |
| TAB-DATA-CONTRACTS | Source badges not implemented | Not implemented | ❌ Gap |
| KNOWLEDGE.md | Deal↔Stripe, call→ad missing | Same | ❌ Gap |

---

## 5. Metrics & Formula Alignment

### 5.1 metrics-calculator Import Usage

| Metric | Canonical | Import Usage | Status |
|--------|-----------|--------------|--------|
| ROAS | computeROAS | **0 imports** | ❌ Inline in true-roas-calculator, MarketingIntelligence, RevenueVsSpendChart |
| CPL | computeCPL | **0 imports** | ❌ Inline in marketing-stress-test, populate-analytics, CampaignMoneyMap |
| CPO | computeCPO | **0 imports** | ❌ Inline in true-roas-calculator |
| CAC | computeCAC | **0 imports** | ❌ Inline in useExecutiveData |
| CLV | computeCLV | **0 imports** | — |
| Churn | computeChurnRate | **0 imports** | — |
| LTV:CAC | computeLTVCACRatio | **0 imports** | — |

**Files with inline formulas (replace with metrics-calculator):**

| File | Inline Formula | Replace With |
|------|----------------|--------------|
| supabase/functions/true-roas-calculator/index.ts | revenue/spend.spend, spend.spend/deals | computeROAS, computeCPO |
| supabase/functions/marketing-stress-test/index.ts | spend/leads.qualified | computeCPL |
| src/pages/MarketingIntelligence.tsx | spend/leads, revenue/spend | computeCPL, computeROAS |
| src/components/dashboard/RevenueVsSpendChart.tsx | totalRevenue/totalSpend | computeROAS |
| supabase/functions/populate-analytics/index.ts | spend/leads | computeCPL |
| src/pages/_archived/CampaignMoneyMap.tsx | spend/leads, spend/deals | computeCPL, computeCPO |

---

## 6. What's Done (Do Not Redo)

| Item | Evidence | Status |
|------|----------|--------|
| snapshot.kpis null-safety | BusinessIntelligenceAI optional chaining | ✅ DONE |
| MetricDrilldownModal item.change | Line 157: `(item.change ?? 0)` | ✅ DONE |
| sync-aws-full.cjs cancel filter | Line 143–144: `LIKE 'Cancelled-%' AND != 'Cancelled-Rebooked'` | ✅ DONE |
| PowerBI views | aws-sync-bridge: vw_powerbi_schedulers, vw_powerbi_clientpackages, vw_powerbi_clients | ✅ DONE |
| syncReviews, syncDemographics | aws-sync-bridge:375, 426, 539, 548 | ✅ DONE |
| Agent iteration limits | ptd-ultimate-intelligence, ai-ceo-master, etc. MAX_LOOPS 3–10 | ✅ DONE |
| Coaches.tsx churn priority | Depletion + churn >= 60 → HIGH | ✅ DONE |

---

## 7. What's NOT Done (Ordered Execution Plan)

### P0 — Launch Blockers (None remaining)

All P0 items from mega prompt are resolved.

### P1 — High Impact

| # | Item | File:Line | Action | Effort |
|---|------|-----------|--------|--------|
| 1 | metrics-calculator adoption | true-roas-calculator, marketing-stress-test, MarketingIntelligence, RevenueVsSpendChart, populate-analytics | Import computeROAS, computeCPL, computeCPO; replace inline | M |
| 2 | toFixed null-safety | SourceTruthMatrix:111,205–207; CreativeGallery:115,157,164,172; CohortWaterfall:103,111,203,216; DailyOptimization:16,26,46; ConversionFunnel:279; ClientRiskMatrix:55,158 | Add `(x ?? 0).toFixed(n)` or `?.toFixed` | S |
| 3 | Attribution: Deal↔Stripe | — | Add deal_id→invoice_id FK; backfill from Stripe webhooks | L |
| 4 | Attribution: call→ad | — | Extend call_records; enrich from attribution_events | L |
| 5 | Standardized error shape | All edge functions | Create api-response.ts; `{ ok, data?, error?: { code, message } }` | M |
| 6 | Source badge | 5 tabs | `<SourceBadge source="HubSpot" freshness="2h ago" />` | M |

### P2 — Nice to Have

| # | Item | Action |
|---|------|--------|
| 7 | North Star target_arr from DB | Add target_arr to settings/config |
| 8 | MoM "from zero" badge | usePeriodComparison; flag when prev=0 |
| 9 | VisualDNA purchase_value | Add to Meta insights sync |

---

## 8. toFixed Null-Safety Audit (Remaining Risk)

**Components WITHOUT `?? 0` or `?.` guard before `.toFixed()`:**

| File | Lines | Risk |
|------|-------|------|
| SourceTruthMatrix.tsx | 111, 205–207 | gap, avgFb, avgAnytrack, avgHubspot |
| CreativeGallery.tsx | 115, 157, 164, 172 | creative.roas, cpa_aed, ctr_pct, frequency |
| CohortWaterfall.tsx | 103, 111, 203, 216 | conversionToNext, dropOff, overallConversion |
| DailyOptimization.tsx | 16, 26, 46 | value, delta |
| ConversionFunnel.tsx | 279 | conversionRate |
| ClientRiskMatrix.tsx | 55, 158 | score, health_score |
| OutcomeAnalysis.tsx | 54, 66 | d.percentage |
| MetaAdsAudience.tsx | 188, 194, 243, 246 | item.spend, item.cpa, pct |

**Already safe:** VisualDNA (?? 0), MetricDrilldownModal, NorthStarWidget, Coaches, CommandCenter, RevenueIntelligence, LeadTracking, etc.

---

## 9. ADR Drafts (Required per Mega Prompt)

### ADR-005: metrics-calculator as Single Source of Truth

**Status:** Proposed  
**Context:** Inline formulas (revenue/spend, spend/leads) scattered across 6+ files. Inconsistent null handling, rounding.  
**Decision:** All metric computation MUST use `supabase/functions/_shared/metrics-calculator.ts`. Frontend may re-export or duplicate logic only if backend does not provide the metric.  
**Consequences:** Requires refactor of true-roas-calculator, marketing-stress-test, MarketingIntelligence, RevenueVsSpendChart, populate-analytics.

### ADR-006: Cancel Filter Canonical Form

**Status:** Accepted  
**Context:** AWS has hyphenated cancel statuses; `Cancelled-Rebooked` is NOT a real cancel.  
**Decision:** Use `status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked'` everywhere.  
**Consequences:** sync-aws-full.cjs, truth-porter, rds-data-analyst, ops-snapshot, setup-coach-intelligence all aligned.

### ADR-007: Agent Iteration Limits

**Status:** Accepted  
**Context:** Unbounded loops risk runaway cost and latency.  
**Decision:** All agent loops have MAX_LOOPS 3–10.  
**Consequences:** ptd-ultimate-intelligence (3), ai-ceo-master (5), agent-orchestrator (10), etc.

---

## 10. Skill Audit Outputs

| Skill | Applied | Output |
|-------|---------|--------|
| ai-agents-architect | Agent flows, tool design | Iteration limits done; Context7 not in loop |
| data-scientist | Statistical caveats | MoM from zero, churn directional, ROAS blocked until attribution |
| supabase-postgres-best-practices | Views, indexes | PowerBI views used; partial indexes not audited |
| vercel-react-best-practices | toFixed, null guards | ~15 components need audit |
| agent-orchestration-multi-agent-optimize | Token, cost, latency | No flows exceeding 50K tokens noted |
| architecture-decision-records | ADR format | ADR-005, 006, 007 drafted |
| prompt-engineer | Comparison lens | Current vs Live vs Full table in §5.4 of mega prompt |

---

## 11. Next Actions (Ordered)

1. **Immediate:** Replace inline ROAS/CPL/CPO in true-roas-calculator, marketing-stress-test with metrics-calculator imports.
2. **This week:** toFixed null-safety pass on SourceTruthMatrix, CreativeGallery, CohortWaterfall, DailyOptimization, ConversionFunnel, ClientRiskMatrix.
3. **Phase 3:** Deal↔Stripe, call→ad attribution (unchanged scope).
4. **Ongoing:** Standardized error shape, source badge, Context7 in agent loop.
