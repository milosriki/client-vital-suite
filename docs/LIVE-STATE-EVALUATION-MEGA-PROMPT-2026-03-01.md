# LIVE STATE EVALUATION MEGA PROMPT — 100% Done Solution

> **Purpose:** Deep evaluation of plan vs live production (Vercel + Supabase). Metrics alignment. 10x improvement plan. Context7 MCP verification. Architecture decisions. Full production deployment checklist. **Covers everything not yet done.** Use this prompt to compare current solution vs live vs full deployed production app.

**Skills:** ai-agents-architect, data-scientist, supabase-postgres-best-practices, vercel-react-best-practices, agent-orchestration-multi-agent-optimize, architecture-decision-records, prompt-engineer

---

## 1. Mission

1. **Evaluate** current plan alignment with live state on Vercel and Supabase
2. **Verify** metrics and formulas match KNOWLEDGE.md, `metrics-calculator.ts`, and actual code
3. **Identify** what's done (do not redo) vs what's not — exhaustive checklist
4. **Compare** current solution vs live vs full deployed production (prompt-engineer lens)
5. **Create** exact plan and execution for 10x better metrics
6. **Use Context7 MCP** to ground all recommendations in current docs
7. **Document** architecture decisions (ADR format)
8. **Apply** ai-agents-architect, data-scientist, Postgres, React, agent-orchestration best practices
9. **Deliver** 100% deployable, working, production-ready solution

---

## 2. Context7 Gate (Mandatory Before Evaluation)

**Before any recommendation, run Context7:**

| Step | Tool | Parameters |
|------|------|------------|
| 1 | `resolve-library-id` | `libraryName`: "supabase", `query`: "Edge function error handling and request validation best practices" |
| 2 | `query-docs` | `libraryId`: from step 1, `query`: "Supabase Edge Functions try-catch, JSON error response, status 500" |
| 3 | `resolve-library-id` | `libraryName`: "react", `query`: "React 19 null safety, optional chaining, toFixed guards" |
| 4 | `query-docs` | `libraryId`: from step 3, `query`: "React number formatting, optional chaining for undefined" |
| 5 | `resolve-library-id` | `libraryName`: "postgres" or "supabase", `query`: "PostgreSQL view best practices, indexing" |
| 6 | `query-docs` | `libraryId`: from step 5, `query`: "PostgreSQL partial indexes, view performance" |

**Max 6 Context7 calls total.** Cite in output: `Per Context7 [library]: [pattern]`

---

## 3. Live State Verification Protocol

### 3.1 Vercel Production Check

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Build | `npm run build` | Exit 0 |
| TypeScript | `npx tsc --noEmit` | Exit 0 |
| Deploy URL | Vercel dashboard or `vercel ls` | No failed deployments |
| Console errors | Open: BusinessIntelligenceAI, CommandCenter, DailyOps, ExecutiveOverview | No red errors |
| Core tabs load | Navigate: /, /command-center, /daily-ops, /marketing | No crash, data visible |

### 3.2 Supabase Production Check

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Migrations | `supabase db remote commit` or Supabase dashboard | All migrations applied |
| Edge functions | `supabase functions list` | 143+ functions deployed |
| Key views | `SELECT COUNT(*) FROM view_atlas_lead_dna` etc. | Views exist, return rows |
| client_reviews | `SELECT COUNT(*) FROM client_reviews` | Table exists; 0+ rows after sync |
| client_demographics | `SELECT COUNT(*) FROM client_demographics` | Table exists; 0+ rows after sync |
| agent_knowledge | `SELECT COUNT(*) FROM agent_knowledge WHERE category = 'findings'` | 0+ rows after ingest |

### 3.3 Sync Bridge State

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| PowerBI views | Grep aws-sync-bridge.cjs for vw_powerbi_* | Uses vw_powerbi_schedulers, vw_powerbi_clientpackages, vw_powerbi_clients |
| syncReviews | Grep for syncReviews | Function exists, upserts to client_reviews |
| syncDemographics | Grep for syncDemographics | Function exists, upserts to client_demographics |
| Cancel filter | Grep scripts for `Cancelled-%` | sync-aws-full.cjs:143 fixed (see CRAW TODO 6) |

---

## 4. Plan vs Reality Alignment Matrix

**Compare these sources:**

| Source | What It Says | Live Reality | Gap |
|--------|--------------|--------------|-----|
| DEPLOY-CHECKLIST-2026-03-01 | Phase 1 done, build passes | [VERIFY] | |
| 10X-EVALUATION-REPORT | snapshot.kpis RESOLVED, item.change P1 | [VERIFY] | |
| EXECUTION-PLAN Phase 1 | 1.3–1.6 null guards done | [VERIFY] | |
| CRAW-FINDINGS TODO 1–6 | 5 done, 1 open (sync-aws-full cancel) | [VERIFY] | |
| DEPLOY-MANIFEST | 4 migrations, 12 functions | [VERIFY applied] | |
| TAB-DATA-CONTRACTS | Source badges not implemented | [VERIFY] | |
| KNOWLEDGE.md | Deal↔Stripe missing, call→ad missing | [VERIFY] | |

**Output:** Table with ✅ Aligned | ❌ Gap | ⚠️ Partial for each row.

---

## 5. Metrics & Formula Alignment

### 5.1 Formula Verification (from KNOWLEDGE.md §4)

| Metric | Formula | Code Location | Status |
|--------|---------|---------------|--------|
| ROAS | `revenue / spend` | daily_business_metrics, RevenueVsSpendChart | [VERIFY] |
| CAC | `totalSpend / realNewClients` | stripe-dashboard-data, financial-analytics | [VERIFY] |
| CLV | `ARPU / churnRate` | metrics-calculator.ts | [VERIFY] |
| LTV:CAC | `ltv / cac` | metrics-calculator.ts | [VERIFY] |
| Cancel rate | `real_cancels / (real_cancels + completed)` | [VERIFY filter] |
| CPL | Not computed | — | MISSING |
| CPO | Not computed | — | MISSING |

### 5.2 Canonical Formulas (metrics-calculator.ts)

**Single source of truth:** `supabase/functions/_shared/metrics-calculator.ts`

| Metric | Canonical Formula | Import Usage |
|--------|-------------------|--------------|
| ROAS | `computeROAS(revenue, spend)` — null if spend≤0 | [VERIFY] All 28+ functions use this |
| CPL | `computeCPL(spend, leads)` | [VERIFY] Used where CPL needed |
| CPO | `computeCPO(spend, deals)` | [VERIFY] Used where CPO needed |
| CAC | `computeCAC(totalCost, newClients)` | [VERIFY] stripe-dashboard-data, financial-analytics |
| CLV | `computeCLV(arpu, churnDecimal)` | [VERIFY] churnRate/100 for decimal |
| Churn | `computeChurnRate(churned, totalActive)` | [VERIFY] Returns % (e.g. 5.2) |
| LTV:CAC | `computeLTVCACRatio(clv, cac)` | [VERIFY] Healthy > 3:1 |

**Action:** Grep for inline `revenue/spend`, `spend/leads`, etc. — replace with `computeROAS`, `computeCPL`, etc.

### 5.3 Statistical Caveats (Data Scientist Lens)

| Metric | Caveat | Action |
|--------|--------|--------|
| MoM +100% when prev=0 | Not meaningful | Add "from zero" badge |
| Churn rate | Estimated from health zones, not actual | Document as directional |
| ROAS per ad | Cannot compute until Deal↔Stripe | Block attribution chain |
| VisualDNA ROAS | purchase_value missing → 0 | Add purchase_value to Meta sync |
| Correlation vs causation | "Ad spend up, revenue up" — need attribution chain | Never state causation without chain |
| Zero baseline | MoM +100% when prev=0 | Flag in UI; use "from zero" badge |

### 5.4 Prompt-Engineer Comparison: Current vs Live vs Full

| Dimension | Current (Code) | Live (Vercel) | Full (Deployed + Verified) |
|-----------|----------------|---------------|----------------------------|
| Null guards | Partial (10+ components) | [VERIFY] | All toFixed, snapshot, item.change safe |
| Migrations | 4 pending | [VERIFY applied] | All applied |
| Edge functions | 12 modified | [VERIFY deployed] | 143+ deployed |
| Sync bridge | PowerBI + reviews + demographics | [VERIFY run] | client_reviews, client_demographics populated |
| Attribution | Deal↔Stripe, call→ad missing | Same | Same until Phase 3 |
| Source badge | Not implemented | Same | 5 tabs have badge |
| Error shapes | Inconsistent | Same | `{ ok, data?, error? }` everywhere |

**Output:** Table with ✅ Aligned | ❌ Gap | ⚠️ Partial for each row.

---

## 6. What's Done (Do Not Redo)

**From 10X-REPORT, EXECUTION-PLAN, SERVICE-FLOW-EVALUATION:**

| Item | Evidence | Status |
|------|----------|--------|
| snapshot.kpis null-safety | BusinessIntelligenceAI optional chaining | DONE |
| Agent iteration limits | ptd-ultimate-intelligence, ai-ceo-master, etc. all have MAX_LOOPS 3–10 | DONE |
| Tool errors surfaced | catch → toolResults.push in all agents | DONE |
| Coaches.tsx churn priority | Depletion + churn >= 60 → HIGH | DONE |
| PowerBI views in aws-sync-bridge | vw_powerbi_schedulers, vw_powerbi_clientpackages, vw_powerbi_clients | DONE |
| client_reviews sync | syncReviews() in aws-sync-bridge | DONE |
| client_demographics sync | syncDemographics() in aws-sync-bridge | DONE |
| Cancel filter (most paths) | truth-porter, rds-data-analyst, ops-snapshot, setup-coach-intelligence | DONE |
| Context7 pre-bake | KNOWLEDGE.md § Supabase Edge Function Best Practices | DONE |

---

## 7. What's NOT Done (Exact Plan — Exhaustive)

### 7.1 P0 — Launch Blockers

| # | Item | File:Line | Action | Effort |
|---|------|-----------|--------|--------|
| 1 | MetricDrilldownModal item.change | MetricDrilldownModal.tsx:157 | `(item.change ?? 0)` before Math.abs | 5 min |
| 2 | toFixed on null (P0 components) | MillionDollarPanel, VisualDNA, MetaAdsCreatives, HealthChart | `(x ?? 0).toFixed(n)` | 1 hr |
| 3 | sync-aws-full.cjs cancel filter | sync-aws-full.cjs:143 | `status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked'` | 5 min |
| 4 | Error boundaries | DailyOps, CommandCenter, ExecutiveOverview | Wrap in ErrorBoundary | 1 hr |

### 7.2 toFixed Null-Safety Audit (Full List — from VERCEL-LIVE-VERIFY)

**Components WITHOUT `?? 0` or `?.` guard before `.toFixed()`:**

| File | Lines | Risk |
|------|-------|------|
| MillionDollarPanel.tsx | 202, 302, 333 | roas, cpl, cpa |
| VisualDNA.tsx | 68, 99, 110 | trueRoas, ad.ctr, platformRoas |
| MetaAdsCreatives.tsx | 196, 417, 421, 478–480, 588–591 | c.ctr, c.cpa, c.roas |
| HealthChart.tsx | 40, 54 | zone.percentage |
| CreativeGallery.tsx | 115, 157, 164, 172 | creative.roas, cpa_aed, ctr_pct |
| ClientRiskMatrix.tsx | 55, 158 | score, health_score |
| CohortWaterfall.tsx | 103, 111, 203, 216 | conversionToNext, dropOff |
| DailyOptimization.tsx | 16, 26, 46 | value, delta |
| SourceTruthMatrix.tsx | 111, 205 | gap, avgFb |
| ConversionFunnel.tsx | 279 | conversionRate |

**Already safe:** DailyTrends, ZoneDistributionBar, CoachLeaderboard, BusinessIntelligenceAI, CommandCenter, ExecutiveOverview, MarketingIntelligence, MetricDrilldownModal.

### 7.3 P1 — High Impact

| # | Item | Action | Effort |
|---|------|--------|--------|
| 5 | Attribution: Deal↔Stripe | Add deal_id→invoice_id FK; backfill from Stripe webhooks | L |
| 6 | Attribution: call→ad | Extend call_records; enrich from attribution_events | L |
| 7 | Standardized error shape | Create `api-response.ts`; `{ ok, data?, error?: { code, message } }` | M |
| 8 | Schema registry + Zod | Extend to 15→144 functions; CI fails if no schema | M |
| 9 | Source badge | `<SourceBadge source="HubSpot" freshness="2h ago" />` on 5 tabs | M |
| 10 | Context7 in agent loop | Pre-bake more into KNOWLEDGE.md; inject into agent prompts | S |
| 11 | metrics-calculator adoption | Grep for inline formulas; replace with computeROAS, computeCPL, etc. | S |

### 7.4 P2 — Nice to Have

| # | Item | Action | Effort |
|---|------|--------|--------|
| 12 | North Star target_arr from DB | Add target_arr to settings/config | S |
| 13 | MoM "from zero" badge | usePeriodComparison; flag when prev=0 | S |
| 14 | VisualDNA purchase_value | Add to Meta insights sync | S |

---

## 8. 10x Improvement Matrix

| Current State | 10x Improvement |
|---------------|-----------------|
| Manual finding review | Automated evaluation pipeline: run on every PR |
| Ad-hoc null guards | Type-level `NonNullable<T>` + runtime guard layer |
| 15/144 functions with Zod | Schema registry + codegen; CI fails if new function has no schema |
| Context7 in docs only | Context7 pre-fetch in agent loop; inject top-3 snippets |
| No source badge | Real-time freshness SLA + alert when stale |
| Attribution chain broken | Deal↔Stripe + call→ad wired → "Which ad made me money?" answerable |
| Single fixes | Data contract enforcement + migration test suite |
| Inline metric formulas | All use metrics-calculator.ts; single source of truth |

---

## 8a. Agent-Orchestration-Multi-Agent-Optimize

**Apply when evaluating agent flows:**

| Dimension | Check | Target |
|-----------|-------|--------|
| **Context window** | Token usage per request | Compress; semantic relevance filter |
| **Cost** | Per-user cost tracking | ai_execution_metrics; cost ceiling per request |
| **Latency** | Parallel tool execution | Use Promise.all for independent tools |
| **Coordination** | Inter-agent overhead | Minimal; fault-tolerant |
| **Quality vs speed** | Model selection | Dynamic by task complexity |

**Output:** Note any agent flow exceeding 50K tokens or 5+ sequential tool calls.

---

## 8b. Supabase Postgres Best Practices

**Apply when evaluating schema and queries:**

| Rule | Check | Action |
|------|-------|--------|
| **query-missing-indexes** | EXPLAIN on slow queries | Add index on filter/sort columns |
| **schema-partial-indexes** | Cancel filter, status filters | `WHERE status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked'` — partial index |
| **security-rls** | client_reviews, client_demographics | RLS policies exist |

**Output:** List any view missing index; any migration without RLS.

---

## 8c. Vercel React Best Practices

**Apply when evaluating frontend:**

| Rule | Check | Action |
|------|-------|--------|
| **async-parallel** | useQuery/useEffect waterfalls | Use Promise.all; parallel fetches |
| **bundle-defer-third-party** | Analytics, logging | Load after hydration |
| **rerender-memo** | Expensive components | Extract expensive work into memoized |

**Output:** Note any page with sequential async fetches (waterfall).

---

## 8d. ai-agents-architect Sharp Edges

| Issue | Severity | Verify |
|-------|----------|--------|
| Agent loops without iteration limits | critical | All have MAX_LOOPS 3–10 ✅ |
| Tool errors not surfaced | high | catch → toolResults.push ✅ |
| Vague tool descriptions | high | tool-definitions.ts quality varies |
| Too many tools | medium | 39+ tools; persona filtering |
| Agent internals not logged | medium | console.log; LangSmith optional |
| Fragile parsing | medium | ai-ceo-master parses JSON with regex |

**Output:** Mark any sharp edge still open.

---

## 9. Architecture Decision Records (ADR Format)

**For each major decision, document:**

```markdown
## ADR-NNN: [Title]

**Status:** Proposed | Accepted | Deprecated
**Date:** YYYY-MM-DD

### Context
[Why we needed to decide]

### Decision
[What we decided]

### Consequences
**Positive:** [benefits]
**Negative:** [trade-offs]
**Risks:** [mitigations]

### References
[Links to code, docs]
```

**Required ADRs:**

| ADR | Title | Status |
|-----|-------|--------|
| ADR-001 | Attribution chain (Deal↔Stripe, call→ad) — when to implement | Proposed |
| ADR-002 | Schema registry + Zod (15→144) — enforcement strategy | Proposed |
| ADR-003 | Error shape standardization — `{ ok, data?, error? }` | Proposed |
| ADR-004 | Source badge + freshness SLA — implementation approach | Proposed |
| ADR-005 | metrics-calculator.ts as single source for ROAS/CPL/CPO/CAC/CLV | Proposed |
| ADR-006 | Cancel filter: `LIKE 'Cancelled-%' AND != 'Cancelled-Rebooked'` — data contract | Accepted |
| ADR-007 | Agent iteration limits (3–10) — per ai-agents-architect | Accepted |

---

## 10. Full Production Deployment Checklist

### Pre-Deploy

- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes
- [ ] All P0 items (7.1) complete
- [ ] No hardcoded secrets

### Deploy Order

1. `supabase db push`
2. `supabase functions deploy --all`
3. `npx supabase gen types typescript --project-id ztjndilxurtsfqdsvfds > src/integrations/supabase/types.ts`
4. `git add -A && git commit && git push` (Vercel auto-deploy)

### Post-Deploy

- [ ] Vercel deployment succeeds
- [ ] No console errors on: BusinessIntelligenceAI, CommandCenter, DailyOps, ExecutiveOverview
- [ ] Core tabs load without crash
- [ ] Run sync bridge: `RDS_PASSWORD=xxx SUPABASE_SERVICE_KEY=xxx node scripts/aws-sync-bridge.cjs --full`
- [ ] Run ingest: `SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/ingest-unified-knowledge.mjs --source all`
- [ ] Verify: `SELECT COUNT(*) FROM client_reviews`, `client_demographics`, `agent_knowledge WHERE category = 'findings'`

---

## 11. Output Format

### 11.1 Executive Summary (1 paragraph)

State: overall health (0–100), plan vs live alignment, top 3 gaps, top 3 10x opportunities, deploy readiness.

### 11.2 Live State Verification Table

| Check | Result | Evidence |
|-------|--------|----------|
| ... | ... | ... |

### 11.3 Plan vs Reality Table

| Source | Gap | Action |
|--------|-----|--------|
| ... | ... | ... |

### 11.4 Metrics & Formulas Table

| Metric | Formula | metrics-calculator | Code Usage | Status |
|--------|---------|-------------------|------------|--------|
| ROAS | revenue/spend | computeROAS | [grep] | |
| CPL | spend/leads | computeCPL | [grep] | |
| CPO | spend/deals | computeCPO | [grep] | |
| CAC | totalCost/newClients | computeCAC | [grep] | |
| CLV | arpu/churnRate | computeCLV | [grep] | |
| Churn | churned/(active+churned) | computeChurnRate | [grep] | |
| LTV:CAC | clv/cac | computeLTVCACRatio | [grep] | |

### 11.5 Done vs Not Done

| Done | Not Done |
|------|----------|
| ... | ... |

### 11.6 Execution Plan (Ordered)

| Order | Task | Effort | Verification |
|-------|------|--------|--------------|
| 1 | ... | ... | ... |

### 11.7 Context7 Verification Log

| Library | Query | Result |
|---------|-------|--------|
| /supabase/supabase | ... | ... |

### 11.8 ADR Drafts

[One ADR per major decision]

### 11.9 Skill Audit Outputs

| Skill | Findings |
|-------|----------|
| agent-orchestration | Context/cost/latency notes |
| supabase-postgres | Missing indexes, RLS gaps |
| vercel-react | Waterfalls, bundle, re-render |
| ai-agents-architect | Sharp edges still open |

---

## 12. Related Docs

| Doc | Purpose |
|-----|---------|
| CRAW-FINDINGS-2026-02-26.md | AWS, cancel status, PowerBI, company metrics |
| 10X-EVALUATION-REPORT-2026-03-01.md | Findings, priorities, Context7 log |
| 10X-EVALUATION-PROMPT.md | Evaluation framework |
| EXECUTION-PLAN-2026-03-01.md | Phases, RICE, dependencies |
| DEPLOY-CHECKLIST-2026-03-01.md | Pre/post deploy steps |
| DEPLOY-MANIFEST-2026-03-01.md | Migrations, functions, scripts |
| VERCEL-LIVE-VERIFY-2026-03-01.md | Build/tsc, toFixed audit, execution log |
| TAB-DATA-CONTRACTS.md | Per-tab source, freshness, failure policy |
| KNOWLEDGE.md | Project truth, formulas, schema |
| MASTER-PERFECT-DATA-PROMPT.md | Data rules, Context7 gate |
| SERVICE-FLOW-EVALUATION-2026-03-01.md | Agent compliance, page→service map |
| supabase/functions/_shared/metrics-calculator.ts | Canonical ROAS/CPL/CPO/CAC/CLV formulas |

---

## 13. Checklist Before "Done"

- [ ] Context7 called for Supabase, React, Postgres (max 6 calls)
- [ ] Live state verified (Vercel + Supabase)
- [ ] Plan vs reality table complete
- [ ] Current vs Live vs Full comparison table complete
- [ ] Metrics formulas verified against metrics-calculator.ts
- [ ] Done vs not done table complete (exhaustive)
- [ ] toFixed audit list complete (all 10+ components)
- [ ] Execution plan ordered by dependency
- [ ] ADR drafts for all 7 required ADRs
- [ ] Agent-orchestration, Postgres, React, ai-agents-architect audits complete
- [ ] No recommendation contradicts Context7
- [ ] All actions are concrete (file, function, or config)
