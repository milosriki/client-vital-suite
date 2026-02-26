# Test Audit — 2026-02-26

## Run Metadata
- Command: `CI=1 npm test -- --runInBand`
- Repo: `/Users/milosvukovic/client-vital-suite`
- Result: **FAILED**
- Summary: **21 failed**, **9 passed**, **30 total suites**; **25 failed**, **131 passed**, **156 total tests**
- Primary log: `/tmp/cvs-test-audit.log`

---

## Failing Suites (exact paths)
1. `tests/Observability.test.tsx`
2. `tests/AttributionLeaks.test.tsx`
3. `tests/pages/GlobalBrain.test.tsx`
4. `tests/pages/SetterCommandCenter.test.tsx`
5. `tests/smart-prompt.test.ts`
6. `tests/smart-pause.test.ts`
7. `tests/useTruthTriangle.test.ts`
8. `tests/pages/AlertCenter.test.tsx`
9. `tests/pages/AuditTrail.test.tsx`
10. `supabase/functions/update-currency-rates/index.test.ts`
11. `supabase/functions/proactive-insights-generator/index.test.ts`
12. `supabase/functions/marketing-scout/index.test.ts`
13. `supabase/functions/marketing-analyst/index.test.ts`
14. `supabase/functions/health-calculator/index.test.ts`
15. `supabase/functions/daily-report/index.test.ts`
16. `supabase/functions/business-intelligence/index.test.ts`
17. `supabase/functions/ad-creative-analyst/index.test.ts`
18. `tests/useMarketingAnalytics.test.tsx`
19. `tests/response-parser.test.ts`
20. `tests/content-filter.test.ts`
21. `tests/MarketingAnalytics.test.tsx`

---

## Root-cause clusters

## Cluster A — Jest running Deno-native tests in Node/ts-jest pipeline
**Blast radius:** Very High (8 suites hard-fail before test logic runs)

### Evidence
- Deno suites under `supabase/functions/**/index.test.ts` fail with:
  - `Cannot find name 'Deno'`
  - `Cannot find module 'https://deno.land/.../asserts.ts'`
  - `TS5097` for `.ts` import extensions
  - `Top-level await` / `import.meta` TS config mismatch
- Affected paths:
  - `supabase/functions/update-currency-rates/index.test.ts`
  - `supabase/functions/proactive-insights-generator/index.test.ts`
  - `supabase/functions/marketing-scout/index.test.ts`
  - `supabase/functions/marketing-analyst/index.test.ts`
  - `supabase/functions/health-calculator/index.test.ts`
  - `supabase/functions/daily-report/index.test.ts`
  - `supabase/functions/business-intelligence/index.test.ts`
  - `supabase/functions/ad-creative-analyst/index.test.ts`
- Config trigger:
  - `jest.config.ts` includes `roots: ["<rootDir>/tests", "<rootDir>/supabase/functions"]`

### Likely root cause
Cross-runtime test strategy drift: Deno edge-function tests are being executed by Jest (Node + jsdom) without Deno runtime/toolchain segregation.

---

## Cluster B — UI/tests contract drift (rendered content changed, tests still assert old text/card layout)
**Blast radius:** High (core dashboard UI suites fail)

### Evidence
- `tests/AttributionLeaks.test.tsx`: cannot find expected strings (`Discrepancies`, `Alignment Trend (7d)`, `Auto-Alignment Log`, `$0`)
  - Component path implicated: `src/pages/_archived/AttributionLeaks.tsx`
- `tests/pages/GlobalBrain.test.tsx`: cannot find expected stats/memories (`42 memories`, `What is the company revenue`, fetch refresh call count mismatch)
  - Component path implicated: `src/pages/GlobalBrain.tsx`
- `tests/pages/SetterCommandCenter.test.tsx`: missing expected KPI value (`1.5`)
  - Component path: `src/pages/SetterCommandCenter.tsx`
- `tests/Observability.test.tsx`: duplicate text match collisions (`Found multiple elements with the text: test-function-1`)
  - Component path: `src/pages/_archived/Observability.tsx`

### Likely root cause
Feature/UI evolution changed labels, grouping, and duplicated visible text nodes; tests still assume previous literal text and one-to-one selector semantics.

---

## Cluster C — Prompt/state-machine spec drift in shared LISA prompt logic
**Blast radius:** Medium-High (behavioral guardrail tests failing)

### Evidence
- `tests/smart-prompt.test.ts` expects markers in old phase buckets (CONNECT/PROBLEM/SOLUTION/CONSEQUENCE/COMMITMENT), but implementation uses current phase taxonomy (`connection/situation/problem_awareness/solution_awareness/consequence/close`)
  - Source path: `supabase/functions/_shared/smart-prompt.ts`
- Emoji restriction assertion mismatch also indicates snapshot/expected-string drift vs current prompt text.

### Likely root cause
Tests assert an older prompt template/spec while runtime template evolved.

---

## Cluster D — Timing model edge case (floor clamps out long-message delta)
**Blast radius:** Medium

### Evidence
- `tests/smart-pause.test.ts` fails long-message bonus assertion (`Expected >= 200`, `Received: 0`)
- Source path: `supabase/functions/_shared/smart-pause.ts`
- Current model has hard floor `1200ms`; under/over-30-word scenarios can both clamp to floor, erasing measured delta.

### Likely root cause
Test assumes observable additive long-message effect even when floor clamp dominates.

---

## Cluster E — Query API/mock drift (`single()` vs `maybeSingle()`)
**Blast radius:** Medium

### Evidence
- `tests/useTruthTriangle.test.ts` fails: `maybeSingle is not a function`
- Source now calls `.maybeSingle()` in `src/hooks/useTruthTriangle.ts`
- Test mocks still implement `.single()` chain.

### Likely root cause
Hook updated to safer Supabase API; unit mocks not updated.

---

## Cluster F — Type-level breakage in app code surfaced during Jest TS compile
**Blast radius:** Very High (blocks multiple suites even before assertions)

### Evidence
- `tests/pages/AlertCenter.test.tsx` surfaces heavy generic/type incompatibilities in:
  - `src/pages/AlertCenter.tsx` (queryFn return types don’t match expected table/view row types; downstream `map`/`length` on inferred unknown/never)
- `tests/pages/AuditTrail.test.tsx` compile fail in:
  - `src/pages/AuditTrail.tsx:188` (`unknown` not assignable to `ReactNode`)
- `tests/useMarketingAnalytics.test.tsx` compile fails in:
  - `src/hooks/useMarketingAnalytics.ts` (shape mismatch + nullable arithmetic + accumulator type mismatch)
- `tests/response-parser.test.ts` and `tests/content-filter.test.ts` fail on `.ts` import-extension handling from shared function files:
  - `supabase/functions/_shared/response-parser.ts`
  - `supabase/functions/_shared/content-filter.ts`

### Likely root cause
Recent schema/type tightening + cross-runtime import conventions introduced unresolved TS incompatibilities in React-query generics, nullable math, and ts-jest module resolution rules.

---

## Cluster G — Test scaffolding/reference drift (missing page + matcher setup assumptions)
**Blast radius:** Medium

### Evidence
- `tests/MarketingAnalytics.test.tsx`:
  - imports missing module: `../src/pages/MarketingAnalytics`
  - also fails on `toBeInTheDocument` typing availability

### Likely root cause
Test target file removed/renamed and test setup/types not aligned with current Jest env declarations.

---

## Prioritized remediation plan (quick wins first)

## P0 Quick Win 1 — Split Node vs Deno test execution
- **Action:** Remove `supabase/functions` from Jest roots OR explicitly ignore Deno test files in Jest; run those via separate Deno task/CI job.
- **Files:**
  - `/Users/milosvukovic/client-vital-suite/jest.config.ts`
  - `/Users/milosvukovic/client-vital-suite/package.json` (add `test:node`, `test:deno`, `test:ci` orchestration)
- **Blast radius reduced:** 8/21 failed suites immediately isolated.
- **Effort:** **S**

## P0 Quick Win 2 — Fix stale Supabase mock chain
- **Action:** Update `tests/useTruthTriangle.test.ts` mocks to provide `maybeSingle()` (or support both methods).
- **Files:**
  - `/Users/milosvukovic/client-vital-suite/tests/useTruthTriangle.test.ts`
- **Blast radius reduced:** 1 suite.
- **Effort:** **S**

## P0 Quick Win 3 — Repair broken/obsolete test references
- **Action:**
  - Update/remove `tests/MarketingAnalytics.test.tsx` import target if page was renamed/deleted.
  - Ensure jest-dom matcher typings are loaded in test tsconfig/setup.
- **Files:**
  - `/Users/milosvukovic/client-vital-suite/tests/MarketingAnalytics.test.tsx`
  - `/Users/milosvukovic/client-vital-suite/tests/setup.ts`
  - `/Users/milosvukovic/client-vital-suite/tsconfig*.json`
- **Effort:** **S**

## P1 — Align prompt/timing tests with current product contract
- **Action:**
  - Rebaseline `smart-prompt` assertions to current phase taxonomy and exact policy strings.
  - Update `smart-pause` test to avoid floor-clamp false negatives (or adjust algorithm to preserve long-message delta above floor).
- **Files:**
  - `/Users/milosvukovic/client-vital-suite/tests/smart-prompt.test.ts`
  - `/Users/milosvukovic/client-vital-suite/tests/smart-pause.test.ts`
  - `/Users/milosvukovic/client-vital-suite/supabase/functions/_shared/smart-prompt.ts`
  - `/Users/milosvukovic/client-vital-suite/supabase/functions/_shared/smart-pause.ts`
- **Effort:** **S–M**

## P1 — Stabilize brittle UI assertions
- **Action:** Replace hardcoded text-only selectors with semantic/role-based queries and `getAllBy*` where duplication is expected; update expected labels to current UI copy.
- **Files:**
  - `/Users/milosvukovic/client-vital-suite/tests/Observability.test.tsx`
  - `/Users/milosvukovic/client-vital-suite/tests/AttributionLeaks.test.tsx`
  - `/Users/milosvukovic/client-vital-suite/tests/pages/GlobalBrain.test.tsx`
  - `/Users/milosvukovic/client-vital-suite/tests/pages/SetterCommandCenter.test.tsx`
  - (as needed) related page components under `src/pages/**`
- **Effort:** **M**

## P2 — Resolve TS contract mismatches in production hooks/pages
- **Action:**
  - Correct `useQuery` generic contracts and queryFn return shapes in `AlertCenter`.
  - Fix `AuditTrail` render typing (`unknown` -> validated/renderable type).
  - Refactor `useMarketingAnalytics` math accumulator types + nullable guards.
  - Normalize shared import-extension strategy for ts-jest (`response-parser`/`content-filter`).
- **Files:**
  - `/Users/milosvukovic/client-vital-suite/src/pages/AlertCenter.tsx`
  - `/Users/milosvukovic/client-vital-suite/src/pages/AuditTrail.tsx`
  - `/Users/milosvukovic/client-vital-suite/src/hooks/useMarketingAnalytics.ts`
  - `/Users/milosvukovic/client-vital-suite/supabase/functions/_shared/response-parser.ts`
  - `/Users/milosvukovic/client-vital-suite/tests/response-parser.test.ts`
  - `/Users/milosvukovic/client-vital-suite/tests/content-filter.test.ts`
- **Effort:** **L**

---

## Suggested execution order
1. **Runtime split (Node vs Deno) + test scaffolding fixes** (P0)
2. **Mock/API drift + prompt/timing tests** (P0/P1)
3. **UI assertion rebaseline** (P1)
4. **Type-contract refactor in app code** (P2)
5. Re-run: `CI=1 npm test -- --runInBand` then separate Deno suite command

---

## Confidence notes
- Root causes are based on direct failure traces and file-level evidence from `/tmp/cvs-test-audit.log`.
- Highest leverage fix is **test runtime separation**; it removes systemic noise and lets real app regressions surface cleanly.