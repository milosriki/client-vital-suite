# Marketing Intelligence — Completion Sprint
## Date: 2026-02-25 | Loki Mode Autonomous

## Objective
Complete MarketingIntelligence page to 100%. Kill ALL fake data. Build 3 missing components. Real Supabase data only.

## Tracks (4 sequential waves, tasks within each wave are parallel)

### TRACK A — Fix Hooks (Foundation)
| ID | Task | File | What's Wrong | Fix |
|----|------|------|-------------|-----|
| A1 | useMarketingAnalytics | src/hooks/useMarketingAnalytics.ts | Math.random() trends, ROAS=leads*100/spend, hardcoded deltas, hardcoded payback "3.2 mo", status always "Active" | Real period-over-period deltas from FB data, true ROAS from ad_creative_funnel view, real payback from CAC/LTV |
| A2 | useTruthTriangle | src/hooks/useTruthTriangle.ts | Null crash when view empty | Add null guard before destructuring |
| A3 | useDeepIntelligence | src/hooks/useDeepIntelligence.ts | Promise.all crashes on missing table | Promise.allSettled with per-source error isolation |

### TRACK B — Fix Existing Tabs (after A completes)
| ID | Task | File | Fix |
|----|------|------|-----|
| B1 | TruthTriangle render | MarketingIntelligence.tsx | Verify line 1068 renders with real view_truth_triangle data |
| B2 | Creative thumbnails | MarketingIntelligence.tsx:1205 | thumbnail: '' → pipeboard.com/api/meta/creative/${ad_id}/thumbnail |
| B3 | Unhide Deep Intel | MarketingIntelligence.tsx:1482,424,426 | Uncomment tab, wire baselines+lossReasons from useDeepIntelligence |
| B4 | Wire StressTest | MarketingIntelligence.tsx | Import + add StressTestDashboard to Deep Intel section |

### TRACK C — Build New Components (after A completes, parallel with B)
| ID | Task | New Files | Data Source |
|----|------|-----------|-------------|
| C1 | SourceTruthMatrix | src/components/analytics/SourceTruthMatrix.tsx | source_discrepancy_matrix view via useDeepIntelligence |
| C2 | DailyOptimization | src/hooks/useDailyOptimization.ts + src/components/analytics/DailyOptimization.tsx | daily_business_metrics table |
| C3 | CohortWaterfall | src/hooks/useCohortProgression.ts + src/components/analytics/CohortWaterfall.tsx | funnel_metrics table + deals |

### TRACK D — Final Wiring (after B+C complete)
| ID | Task |
|----|------|
| D1 | Import all new components/hooks into MarketingIntelligence.tsx, add tabs |
| D2 | npm run build + npx tsc --noEmit — must pass |
| D3 | git commit |

## Verification
- npm run build — 0 errors
- npx tsc --noEmit — 0 errors
- Zero Math.random() in production hooks
- Zero hardcoded delta values
- All ROAS from real revenue data
- Empty tables show clean empty state
