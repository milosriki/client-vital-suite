# 10X Evaluation Report — client-vital-suite

**Date:** 2026-03-01  
**Framework:** 10X-EVALUATION-PROMPT.md  
**Sources:** BRAINSTORM-PERFECT-DATA-2026-03-01.md, CRAW-FINDINGS-2026-02-26.md, MASTER-PERFECT-DATA-PROMPT.md, KNOWLEDGE.md, codebase scan

---

## Executive Summary

**Overall health: 64/100.** Strong foundation (AWS sync, PowerBI views, cancel filter documented in most paths) but critical gaps block the North Star question: *"Which ad made me money?"* Attribution chain has breaks (Deal↔Stripe, no call→ad link). Runtime crashes remain (snapshot.kpis, toFixed on null). **Top 3 10x opportunities:** (1) **Attribution chain completion** — wire Deal↔Stripe, call→ad; unlocks ROAS per creative. **Impact:** ~AED 500K+ in ad spend optimization. (2) **Schema registry + codegen** — extend Zod from 15/144 to all agent functions; CI fails if new function has no schema. **Impact:** Eliminates hallucination risk. (3) **Context7 pre-fetch in agent loop** — inject top-3 snippets before tool calls; agents use current docs, not training data. **Impact:** Reduces wrong API usage. **Critical blockers:** BusinessIntelligenceAI.tsx:182–193 crashes when `snapshot.kpis` undefined; MetricDrilldownModal.tsx:157 `item.change` undefined → `NaN`; 1 migration (20251215000004) uses `status = 'cancelled'` — different schema (appointments) but worth audit.

---

## Findings Table

| # | Finding | Severity | Evidence | Context7 | 10x Opportunity | Action |
|---|---------|----------|----------|----------|-----------------|--------|
| 1 | ~~snapshot.kpis crash when undefined~~ | ~~P0~~ | **RESOLVED** — optional chaining in context block + snapshot?.kpis/funnel/topCampaigns guards (2026-03-01) | ✓ | — | Done |
| 2 | item.change undefined → NaN | P1 | `src/components/dashboard/MetricDrilldownModal.tsx:157` — `Math.abs(item.change).toFixed(1)` when change undefined | ✓ | Type-level `NonNullable<T>` + runtime guard | `(item.change ?? 0)` before Math.abs |
| 3 | toFixed on null in 10+ components | P1 | CoachLeaderboard:142, MetaAdsAudience:53–55, ZoneDistributionBar:44, NorthStarWidget:74, etc. | ✓ | Single pattern: `(x ?? 0).toFixed(n)`; grep + replace | Audit all `.toFixed(` without `??` guard |
| 4 | Attribution chain: Deal↔Stripe missing | P0 | KNOWLEDGE.md §3 — "No Deal ↔ Stripe Invoice link"; cannot verify revenue per deal | N/A | Data contract: stripe_transactions.contact_id required; migration to backfill | Add deal_id→invoice_id FK; backfill from Stripe webhooks |
| 5 | Attribution chain: call→ad missing | P0 | KNOWLEDGE.md §2 — "No call → ad/campaign attribution" | N/A | CAPI + AnyTrack webhook: store fbclid/campaign on call_records | Extend call_records schema; enrich from attribution_events |
| 6 | Cancel filter: 1 migration uses `status = 'cancelled'` | P2 | `supabase/migrations/20251215000004_long_sales_cycle_tracking.sql:199` — appointments table (different schema) | N/A | Data contract enforcement + migration test suite | Verify appointments.status ≠ AWS scheduler.status; document |
| 7 | 15/144 edge functions with Zod | P1 | Grep: ai-ceo-master, marketing-copywriter, proactive-insights-generator, etc. | ✓ | Schema registry + codegen; CI fails if new function has no schema | Add Zod to all agent functions returning JSON |
| 8 | ~~No iteration limit in agent loop~~ | ~~P1~~ | **RESOLVED** — ptd-ultimate-intelligence (3), ai-ceo-master (5), ptd-agent-gemini (3), ptd-agent-atlas (3), agent-orchestrator (10) all have limits | SERVICE-FLOW-EVALUATION-2026-03-01 | — | Done |
| 9 | No source badge in UI | P2 | TAB-DATA-CONTRACTS says "Source Badge" but not implemented | N/A | Real-time freshness SLA + alert when stale | Create `<SourceBadge source="HubSpot" freshness="2h ago" />` |
| 10 | Context7 not in agent loop | P1 | KNOWLEDGE.md — "Context7 is Cursor-side only" | ✓ | Context7 pre-fetch before tool calls; inject top-3 snippets into system prompt | Pre-bake Supabase/React best practices into KNOWLEDGE.md; add to agent prompts |
| 11 | VisualDNA ROAS = 0 | P1 | KNOWLEDGE.md §4 — "Missing purchase_value field" | N/A | CAPI + AnyTrack: ensure purchase_value sent to Meta | Add purchase_value to ad objects in Facebook insights sync |
| 12 | North Star "500k ARR" hardcoded | P2 | BRAINSTORM-PERFECT-DATA — NorthStarWidget target hardcoded | N/A | Target from database/settings | Add `target_arr` to settings or config table |
| 13 | MoM +100% with prev=0 misleading | P2 | BRAINSTORM-PERFECT-DATA — "No context for zero baseline" | N/A | "from zero" badge when prev=0 | Add `fromZero` badge to usePeriodComparison; flag in UI |
| 14 | Inconsistent error shape across edge functions | P1 | BRAINSTORM-PERFECT-DATA — some `{ error }`, some `{ message }`, some throw | ✓ | Standardize: `{ ok, data?, error?: { code, message } }` | Per Context7 /supabase/supabase: try-catch + JSON error response |
| 15 | PowerBI views not wired | P1 | CRAW-FINDINGS — vw_powerbi_schedulers has richer columns; sync uses vw_schedulers | N/A | Switch sync bridge to PowerBI views | Update aws-sync-bridge.cjs to use vw_powerbi_* |

---

## 10x Priorities (Ranked)

1. **Attribution chain completion** — Wire Deal↔Stripe, call→ad. Unlocks "Which ad made me money?" Impact: ~AED 500K+ ad spend optimization. Effort: L.

2. **Schema registry + Zod codegen** — Extend Zod from 15/144 to all agent functions; CI fails if new function has no schema. Impact: Eliminates hallucination risk. Effort: M.

3. **Context7 pre-fetch in agent loop** — Inject top-3 snippets before tool calls; pre-bake Supabase/React best practices into KNOWLEDGE.md. Impact: Reduces wrong API usage. Effort: M.

4. **Runtime null-safety layer** — Automated null guards + optional chaining for snapshot.kpis, toFixed, item.change. Impact: Zero runtime crashes. Effort: S.

5. ~~**Agent iteration limits**~~ — **DONE** (all agents have MAX_LOOPS 3–10). See SERVICE-FLOW-EVALUATION-2026-03-01.

6. **Source badge + freshness SLA** — Real-time freshness; alert when stale. Impact: User trust. Effort: M.

7. **Standardized error shape** — `{ ok, data?, error?: { code, message } }` across all edge functions. Impact: Frontend can handle uniformly. Effort: M.

8. **PowerBI view switch** — Use vw_powerbi_schedulers, vw_powerbi_clientpackages, vw_powerbi_clients. Impact: Richer data (pricing, reviews, demographics) at zero cost. Effort: S.

---

## MCP Verification Log

| Library | Query | Result |
|---------|-------|--------|
| /supabase/supabase | Edge function error handling and request validation | try-catch + 500 JSON response; Sentry for monitoring; console.error for logging |
| /colinhacks/zod | Schema validation for API responses and safeParse | safeParse returns result object; use error.issues for validation failure details |
| /supabase/supabase | Edge function error handling | [snippet: try-catch, return new Response(JSON.stringify({ error: error.message }), { status: 500 })] |

---

## Statistical Caveats

- **MoM +100% with prev=0** — Not meaningful. Add "from zero" badge when prev=0.
- **Cancel rate** — Company 15.3% (296 real / 1,643 completed). Correct filter applied in most paths; verify migration 20251215000004 (appointments vs AWS).
- **ROAS per ad** — Cannot compute until Deal↔Stripe, call→ad wired. Current Meta-reported ROAS only.
- **Churn rate** — Estimated from health zones (RED + 0.3*YELLOW), not actual churn. Use for directional only.

---

## Checklist Before "Done"

- [x] Every finding has evidence (file:line or query)
- [x] Context7 called for at least 2 libraries (Supabase, Zod)
- [x] 10x opportunity stated for each P0/P1 finding
- [x] No correlation stated as causation without attribution
- [x] Zero-baseline metrics flagged
- [x] Actions are concrete (file, function, or config change)

---

## Related Docs

- BRAINSTORM-PERFECT-DATA-2026-03-01.md — Baseline evaluation
- MASTER-PERFECT-DATA-PROMPT.md — Execution prompt
- CRAW-FINDINGS-2026-02-26.md — AWS, cancel status, PowerBI
- TAB-DATA-CONTRACTS.md — Per-tab source contracts
- 10X-EVALUATION-PROMPT.md — Evaluation framework
