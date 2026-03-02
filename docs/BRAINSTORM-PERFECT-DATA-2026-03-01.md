# Full Brainstorm: 100% Perfect Data — Evaluation, Blind Spots, Solutions

> AI Wrapper Product + AI Agents Architect + API Design + Architect Review  
> Context7 MCP integration | Todo-all to finish | 0–100 evaluation | Improved prompt

---

## Part 1: 0–100 Evaluation

| Dimension | Score | Evidence | Gap |
|-----------|-------|----------|-----|
| **Data Source Truth** | 72 | AWS/HubSpot/CallGear/Meta hierarchy defined; SOURCE-TRUTH-MATRIX exists; conflict policy documented | Views may not exist; cancel filter drift; PowerBI views not fully wired |
| **Agent Architecture** | 72 | 12 executors, intelligence_control with 10+ actions, ReAct-style tool use; **iteration limits 3–10** (SERVICE-FLOW-EVALUATION) | Tool overload (39+ functions); no single Sales Brain |
| **Prompt Engineering** | 65 | Unified prompts, constitutional framing, DEEP THOUGHT protocol | No Context7 pre-fetch; no output schema validation everywhere; hallucination guard weak |
| **API Design** | 70 | REST edge functions, tool-definitions with params | Inconsistent error shapes; no versioning; some tools return raw JSON |
| **Output Validation** | 58 | Zod in 6 functions (ai-ceo-master, marketing-copywriter, etc.) | 17/144 functions have validation; proactive-insights has fallback, not strict |
| **Cost/Observability** | 62 | ai_execution_metrics, token tracking | No per-user limits; no cost alerts; LangSmith optional |
| **Runtime Hardening** | 55 | Error boundaries on some pages | toFixed null guards missing; snapshot fallbacks weak; 3 pages no error boundary |
| **Tab Data Contracts** | 68 | TAB-DATA-CONTRACTS.md, SOURCE-TRUTH-MATRIX | Not enforced in code; source badges missing in UI; freshness SLA not monitored |
| **Context7 Integration** | 35 | Mentioned in KNOWLEDGE.md, PTD-ASTAR "2 queries max" | No MCP call in edge functions; agents don't fetch docs before non-trivial edits |
| **Deploy/CI** | 75 | Vercel auto-deploy, Supabase functions | 30+ uncommitted files; migrations not pushed; edge functions not deployed |

**Overall: 64/100** — Strong foundation, critical gaps in data validation, runtime safety, and Context7 wiring.

---

## Part 2: Blind Spots

### A) Data Blind Spots

| Blind Spot | Impact | Root Cause |
|------------|--------|------------|
| **View existence** | intelligence_control fails if view_atlas_lead_dna, view_contact_360, view_capacity_vs_spend, source_discrepancy_matrix, view_marketing_attribution missing | Migrations not applied; no startup check |
| **Cancel filter** | Wrong counts, wrong churn logic | `status = 'Cancelled'` returns 0; must use `LIKE 'Cancelled-%' AND != 'Cancelled-Rebooked'` |
| ~~**Snapshot null**~~ | ~~BusinessIntelligenceAI crash~~ | **RESOLVED** — optional chaining in context block + snapshot?.kpis guard (2026-03-01) |
| **toFixed on null** | ClientCard, HealthScoreBadge, DailyTrends, CallIntelligenceKPIs crash | No `?? 0` before `.toFixed()` |
| **Owner drift** | Setter performance wrong | HubSpot owner_id vs staff mapping; call_records.agent_name vs contacts.owner |
| **Attribution gaps** | "Which ad made money?" unanswered | CAPI → HubSpot → Stripe chain has breaks; no contact_id on stripe_transactions in some paths |

### B) Agent Blind Spots

| Blind Spot | Impact | Root Cause |
|------------|--------|------------|
| ~~**No iteration limit**~~ | ~~Agent loops forever~~ | **RESOLVED** — ptd-ultimate-intelligence (3), ai-ceo-master (5), ptd-agent-gemini (3), ptd-agent-atlas (3), agent-orchestrator (10) |
| ~~**Tool errors not surfaced**~~ | ~~Agent retries same failing tool~~ | **RESOLVED** — all agents catch and push ERROR to toolResults (SERVICE-FLOW-EVALUATION) |
| **No Context7 pre-fetch** | Stale patterns, wrong API usage | Agents use training data, not current Supabase/React docs |
| **Thin wrapper risk** | "ChatGPT with PTD context" | Domain expertise in prompts; need more workflow integration |
| **Sales Brain fragmented** | setter-performance, proactive-insights, call_records separate | No unified agent; user must know which to call |

### C) API/Architecture Blind Spots

| Blind Spot | Impact | Root Cause |
|------------|--------|------------|
| **Inconsistent error shape** | Frontend can't handle uniformly | Some return `{ error: string }`, some `{ message }`, some throw |
| **No output schema enforcement** | Hallucinated fields, wrong types | Only 6/144 functions use Zod; rest trust LLM |
| **Secrets in scripts** | RDS password, cron_secret hardcoded | scripts/aws-sync-bridge.cjs, set-database-settings.sh |
| **VITE_PTD_INTERNAL_ACCESS_KEY** | Client bundle exposure | Removed in local changes; verify not in prod |

### D) UX/Trust Blind Spots

| Blind Spot | Impact | Root Cause |
|------------|--------|------------|
| **No source badge** | User can't tell if data is live or stale | TAB-DATA-CONTRACTS says "Source Badge" but not implemented |
| **No freshness SLA** | Stale data shown as truth | data_freshness tool exists but not surfaced in UI |
| **Empty state = crash** | Some tabs crash instead of "No data" | Missing null guards, no fallback UI |
| **MoM +100% with prev=0** | Misleading; needs "from zero" badge | No context for zero baseline |

---

## Part 3: Context7 MCP — What We Need

### Current State
- Context7 plugin in `.cursor/settings.json`
- KNOWLEDGE.md: "resolve-library-id → /supabase/supabase then query-docs"
- PTD-ASTAR: "Context7 gate (2 queries max per subsystem)"
- **Gap:** Edge functions run in Deno; no MCP client. Context7 is Cursor-side only.

### Options

| Option | Feasibility | Use Case |
|--------|-------------|----------|
| **A) Cursor-only** | ✅ Now | Agent (human) runs Context7 before coding; improves prompts in docs |
| **B) Edge function HTTP** | Medium | Call Context7 API from Deno if API key + endpoint available |
| **C) Pre-baked docs** | ✅ Now | Ingest Supabase/React best practices into KNOWLEDGE.md; agents read it |
| **D) Prompt template** | ✅ Now | Add "Before implementing X, verify against: [doc links]" to agent prompts |

### Recommended: A + C + D
1. **Cursor:** Use Context7 before editing Supabase/React code (2 queries per subsystem).
2. **Pre-bake:** Add "Supabase Edge Functions Best Practices" and "React 19 + TanStack Query" sections to KNOWLEDGE.md from Context7.
3. **Prompts:** Add to unified-prompts.ts: "For schema/API changes, verify against KNOWLEDGE.md § Supabase. Never assume—check."

---

## Part 4: Todo-All to Finish Perfectly

### Wave 1: Deploy & Stabilize (P0)
- [ ] `supabase db push` (4 migrations)
- [ ] `supabase functions deploy` (12 functions)
- [ ] `git add -A && git commit && git push` (Vercel deploy)
- [ ] Verify production: build, no console errors on core tabs

### Wave 2: Runtime Hardening (P0-B)
- [ ] ClientCard.tsx: `(client.health_score ?? 0).toFixed(0)`
- [ ] HealthScoreBadge.tsx: `(score ?? 0).toFixed(0)`
- [x] BusinessIntelligenceAI.tsx: `(snapshot?.kpis?.totalRevenue ?? 0).toLocaleString()`, same for all kpis/funnel/topCampaigns — **DONE**
- [ ] DailyTrends.tsx: `(day.answeredRate ?? 0).toFixed(0)`
- [ ] CallIntelligenceKPIs.tsx: null guards
- [ ] MetricDrilldownModal.tsx: `(item.change ?? 0).toFixed(1)`
- [ ] Add error boundaries to 3 missing pages

### Wave 3: Data Truth (P1)
- [ ] Verify view_atlas_lead_dna, view_contact_360, view_capacity_vs_spend, source_discrepancy_matrix, view_marketing_attribution exist
- [ ] Run aws-sync-bridge with PowerBI views
- [ ] Confirm cancel filter in all sync + health-score paths
- [ ] HubSpot webhook: verify HMAC in prod
- [ ] Stripe webhook: verify endpoint + events

### Wave 4: Agent Hardening (P1)
- [x] Add max_iterations to ReAct loop — **DONE** (ptd-ultimate-intelligence: 3, ai-ceo-master: 5, ptd-agent-gemini: 3, ptd-agent-atlas: 3, agent-orchestrator: 10)
- [x] Surface tool errors — **DONE** (all agents catch and push ERROR to toolResults)
- [ ] Extend Zod validation to proactive-insights-generator, business-intelligence
- [ ] Add "Data unavailable" when confidence < 70% (already in ATLAS prompt; enforce in code)

### Wave 5: Sales Brain Wiring (P2)
- [ ] Create sales-brain agent or extend ai-ceo-master with: get_setter_performance + get_proactive_insights + call_records summary
- [ ] Wire to SetterCommandCenter or /intelligence
- [ ] Tool: `sales_brain_control` with actions: setter_kpis, proactive_alerts, call_summary

### Wave 6: Context7 + Prompt Upgrade (P2)
- [ ] Run Context7: resolve Supabase, React 19, TanStack Query; append to KNOWLEDGE.md
- [ ] Add to unified-prompts: "Verify schema/API against KNOWLEDGE.md before answering."
- [ ] Add to PTD-ASTAR: "Context7: 2 queries max. resolve-library-id then query-docs."
- [ ] Create MASTER-PERFECT-DATA-PROMPT (see Part 6)

### Wave 7: Trust & Observability (P2)
- [ ] Source badge component: `<SourceBadge source="HubSpot" freshness="2h ago" />`
- [ ] Add to Command Center, Marketing, Pipeline, Revenue, Coaches
- [ ] data_freshness tool → surface in SystemObservability or header
- [ ] Per-user cost tracking (optional)

---

## Part 5: Solutions Summary

| Blind Spot | Solution |
|------------|----------|
| View existence | Migration check script; health endpoint that queries each view |
| Cancel filter | Grep + fix all `status = 'Cancelled'` → `LIKE 'Cancelled-%' AND != 'Cancelled-Rebooked'` |
| Snapshot null | Optional chaining + `?? 0` / `?? []` everywhere |
| toFixed null | `(x ?? 0).toFixed(n)` pattern |
| No iteration limit | Add `max_iterations` to agent loop; break and return "Max steps reached" |
| Tool errors | Structured error object; agent prompt: "If tool returns error, report it and stop" |
| Context7 | Pre-bake docs + prompt instruction; Cursor-side 2-query gate |
| Sales Brain | New tool or extend intelligence_control with setter + proactive + calls |
| Output validation | Zod schema for every agent that returns structured data |
| Source badge | Reusable component; add to TAB-DATA-CONTRACTS as required |

---

## Part 6: Improved Master Prompt (MASTER-PERFECT-DATA-PROMPT)

```markdown
# MASTER PERFECT DATA PROMPT v1

## Mission
Finish client-vital-suite with 100% perfect data: zero runtime crashes, strict source-truth, and evidence for every claim.

## Source-of-Truth (Immutable)
1. AWS (read-only): clients, coaches, sessions, cancel status
2. CallGear: call events
3. HubSpot: leads, contacts, deals, workflow
4. Meta: ads, spend, performance
5. Supabase: canonical serving layer

Conflict: Event truth > CRM > UI cache.

## Data Rules
- Cancel filter: `status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked'`
- Numbers: `(value ?? 0).toFixed(n)` always
- Snapshots: `(snapshot?.kpis?.totalRevenue ?? 0)` before any method
- Views: Assume view_atlas_lead_dna, view_contact_360, etc. exist; if not, fail gracefully

## Context7 Gate (Before Non-Trivial Edits)
1. resolve-library-id: libraryName from task (e.g. "supabase", "react")
2. query-docs: query = specific question
3. Implement only verified patterns. Max 2 queries per subsystem.

## Agent Rules
- Max 10 tool iterations per request
- If tool returns error, report it and stop
- Confidence < 70%: say "Data unavailable" — never guess
- Output: Validate with Zod before returning

## Verification Checklist
- [ ] npm run build
- [ ] npx tsc --noEmit
- [ ] No console errors on affected tab
- [ ] Screenshot or network proof of real data

## Output Format
1. Done (VERIFIED + evidence)
2. In Progress
3. Blocked (reason)
4. Next 3
```

---

## Part 7: Architecture Review (Architect)

### Strengths
- Clear source hierarchy
- Tool executor pattern with 12 specialized executors
- Constitutional framing
- TAB-DATA-CONTRACTS and SOURCE-TRUTH-MATRIX exist

### Risks
- **High:** 30+ uncommitted files = production drift
- **High:** toFixed/snapshot crashes = user-facing failures
- **Medium:** No iteration limits = agent runaway
- **Medium:** Fragmented Sales Brain = poor UX

### Recommendations
1. **Immediate:** Deploy + P0-B null guards
2. **Short:** Add iteration limits, Zod to high-traffic agents
3. **Medium:** Unify Sales Brain, add source badges
4. **Ongoing:** Context7 pre-bake into KNOWLEDGE.md monthly

---

## Part 8: API Design (Principles)

### Gaps
- No API versioning
- Inconsistent error shape across edge functions
- Tool responses are raw JSON strings; no schema

### Improvements
- Standardize: `{ ok: boolean, data?: T, error?: { code: string, message: string } }`
- Add `X-API-Version: 1` header
- Document tool response schemas in tool-definitions.ts

---

## Summary: Path to 100

| Phase | Actions | Target Score |
|-------|---------|--------------|
| Now | Deploy + P0-B | 72 |
| +1 week | Data truth + agent hardening | 82 |
| +2 weeks | Sales Brain + Context7 + trust badges | 90 |
| +1 month | Full Zod, cost tracking, observability | 95 |
| Ongoing | Monthly Context7 refresh, contract enforcement | 100 |

**Blind spot count:** 18 identified. **Solution coverage:** 18/18. **Next:** Execute Wave 1–2.
