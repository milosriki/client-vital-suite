# Service Flow Evaluation — All Pages, All Services, ai-agents-architect Audit

> **Date:** 2026-03-01  
> **Scope:** Full app service flows, agent architecture, Context7 MCP verification, history alignment  
> **Method:** ai-agents-architect skill + code trace (actual flow, not theory)

---

## 1. Executive Summary

**Verdict:** Agent flows **comply** with ai-agents-architect patterns in practice. Iteration limits exist (3–10). Tool errors are surfaced. History docs (10X, BRAINSTORM) are **outdated** — they claim "no iteration limit" but code has limits. Remaining gaps: snapshot.kpis null-safety, Context7 not in agent loop, inconsistent error shapes.

---

## 2. ai-agents-architect Compliance (Actual Code)

### 2.1 ReAct Loop — Iteration Limits ✅

| Function | MAX_LOOPS / maxIterations | Location | Status |
|----------|---------------------------|----------|--------|
| ptd-ultimate-intelligence | 3 | L690 | ✅ |
| ai-ceo-master | 5 | L324 | ✅ |
| ptd-agent-gemini | 3 | L996 | ✅ |
| ptd-agent-atlas | 3 | L910 | ✅ |
| agent-orchestrator | 10 | L438 | ✅ |
| aisensy-orchestrator | 1-turn (no outer loop) | L221–251 | ✅ Single tool round |

**History alignment:** BRAINSTORM-PERFECT-DATA and 10X-EVALUATION-REPORT state "ReAct loop has no max_steps" — **OUTDATED**. All agent loops have limits.

### 2.2 Tool Errors Surfaced ✅

| Function | Error Handling | Evidence |
|----------|----------------|----------|
| ptd-ultimate-intelligence | `catch (err) → toolResults.push(\`${toolCall.name}: ERROR - ${err.message}\`)` | L726–728 |
| ai-ceo-master | `catch (e) → toolResults.push(\`Tool '${tc.name}' failed: ${e.message}\`)` | L353–356 |
| ptd-agent-gemini | Same pattern | L1053+ |
| ptd-agent-atlas | Same pattern | L1012+ |
| aisensy-orchestrator | `catch (e) → toolResults.push(\`Tool '${call.name}' Failed: ${e.message}\`)` | L233–234 |

**Verdict:** Tool errors are surfaced to the agent. No silent failures.

### 2.3 Tool Registry

- **tool-executor.ts:** 12 executors (HubSpot, Stripe, CallGear, Forensic, System, Intelligence, Sales, Location, Meta, AWS, Error, Command Center)
- **tool-definitions.ts:** Tools registered with schema for Gemini
- **Lazy loading:** N/A — all tools in single executor switch
- **Tool overload:** 39+ functions available; agents filter by persona (e.g. ceoTools, intelligenceTools)

### 2.4 Anti-Patterns Check

| Anti-Pattern | Status |
|--------------|--------|
| Unlimited Autonomy | ❌ Avoided — all loops have limits |
| Tool Overload | ⚠️ Medium — 39+ tools; mitigated by persona filtering |
| Memory Hoarding | ⚠️ brain.learn() fire-and-forget; no audit of what's stored |

### 2.5 Sharp Edges (ai-agents-architect)

| Issue | Severity | Actual Status |
|-------|----------|---------------|
| Agent loops without iteration limits | critical | ✅ Fixed — all have limits |
| Tool errors not surfaced | high | ✅ Fixed — catch and push to toolResults |
| Vague tool descriptions | high | ⚠️ Partial — tool-definitions.ts has descriptions; quality varies |
| Too many tools | medium | ⚠️ 39+ tools; persona filtering helps |
| Agent internals not logged | medium | ⚠️ console.log present; LangSmith optional |
| Fragile parsing | medium | ⚠️ ai-ceo-master parses JSON from text with regex |

---

## 3. Page → Service Flow (Actual Invocations)

### 3.1 Active Pages (Non-Archived)

| Page | Edge Functions Invoked | Flow |
|------|------------------------|------|
| BusinessIntelligenceAI | smart-ai-advisor, business-intelligence | Chat → context from snapshot → invoke; fallback on error |
| CommandCenter | hubspot-command-center, ptd-watcher, sync-hubspot, daily-report | Tab-based; each tab invokes different function |
| CallTracking | (direct DB / components) | hubspot-live-query, etc. |
| MarketingIntelligence | (invoke at L1465) | marketing-predictor, etc. |
| SalesPipeline | (invoke at L53) | pipeline-related |
| RevenueIntelligence | stripe-dashboard-data | Single invoke |
| Coaches | smart-ai-advisor | L440 |
| WarRoom | ptd-24x7-monitor | L54, L86 |
| SkillCommandCenter | (invoke at L113, L244) | skill-related |
| GlobalBrain | (PTDControlChat, PTDUnlimitedChat) | ptd-ultimate-intelligence, ptd-agent-atlas, ai-ceo-master |
| ExecutiveOverview | (dashboardApi) | business-intelligence, etc. |
| LeadTracking | (components) | hubspot-live-query |
| ConversionFunnel | (components) | — |
| MetaAds | (components) | — |
| CoachLocations | coach-intelligence-engine, gps-pattern-analyzer, gps-dwell-engine | fetch() to function URLs |
| AuditTrail | (invoke at L76) | audit-related |

### 3.2 Critical Flow: BusinessIntelligenceAI

```
User types prompt
  → useAIChat.sendMessage()
  → context = snapshot ? buildContext(snapshot) : "No data loaded yet."
  → supabase.functions.invoke("smart-ai-advisor", { body: { message, context } })
  → on error: supabase.functions.invoke("business-intelligence", { body: { ... } })
  → setMessages with response
```

**Crash risk:** `snapshot.kpis.totalRevenue.toLocaleString()` — if `snapshot.kpis` or `totalRevenue` is undefined, crashes. **Fix:** Add optional chaining (see §6).

### 3.3 Critical Flow: CEO / GlobalBrain

```
use-ceo-data.ts
  → supabase.functions.invoke("ai-ceo-master", { body: { command } })
  → ai-ceo-master: MAX_LOOPS=5, executeSharedTool in loop
  → Returns JSON; frontend parses
```

---

## 4. Context7 MCP Verification

| Library | Query | Result |
|---------|-------|--------|
| /supabase/supabase | Edge function error handling | try-catch + return JSON `{ error: error.message }` status 500 |
| /supabase/supabase | Request validation | Zod + safeParse recommended |
| /websites/developers_hubspot | CAPI lifecycle events | HubSpot native CAPI maps lifecycle; no dynamic value per contact |

**Gap:** Context7 is Cursor-side only. Agent prompts do not receive Context7 snippets. **Opportunity:** Pre-fetch top-3 snippets before tool calls; inject into system prompt.

---

## 5. History Alignment

### 5.1 Outdated Findings (Correct in Code)

| Doc | Claim | Actual |
|-----|-------|--------|
| BRAINSTORM-PERFECT-DATA | "ReAct loop has no max_steps" | All agents have MAX_LOOPS 3–10 |
| 10X-EVALUATION-REPORT #8 | "No iteration limit in agent loop" | ptd-ultimate-intelligence, ai-ceo-master, ptd-agent-gemini, ptd-agent-atlas all have limits |
| BRAINSTORM-PERFECT-DATA | "Tool errors not surfaced" | All agents catch and push ERROR to toolResults |

### 5.2 Still Valid Findings

| Doc | Finding | Status |
|-----|---------|--------|
| 10X #1 | snapshot.kpis crash | ✅ Valid — needs optional chaining |
| 10X #4–5 | Deal↔Stripe, call→ad missing | ✅ Valid — PTD-DEEP-EVALUATION |
| 10X #7 | 15/144 functions with Zod | ✅ Valid |
| 10X #10 | Context7 not in agent loop | ✅ Valid |
| PTD-DEEP-EVALUATION | GTM trigger, CAPI 0 AED, lifecycle | ✅ Valid |

---

## 6. Final Fix List (Deployment-Ready)

### 6.1 P0 — Runtime Crashes

| Fix | File | Change |
|-----|------|--------|
| snapshot.kpis null-safety | src/pages/BusinessIntelligenceAI.tsx | Use `(snapshot?.kpis?.totalRevenue ?? 0).toLocaleString()` and same for all kpis/funnel/topCampaigns in context block |

### 6.2 P1 — Agent / Data Quality

| Fix | File | Change |
|-----|------|--------|
| (Already done) | — | Iteration limits present |
| (Already done) | — | Tool errors surfaced |
| Standardize error shape | All edge functions | `{ ok, data?, error?: { code, message } }` per Context7 |

### 6.3 P2 — Documentation

| Fix | File | Change |
|-----|------|--------|
| Update 10X #8 | docs/10X-EVALUATION-REPORT-2026-03-01.md | Mark "iteration limit" as RESOLVED |
| Update BRAINSTORM | docs/BRAINSTORM-PERFECT-DATA-2026-03-01.md | Remove "No iteration limit" from blind spots |

---

## 7. Deployment Checklist

- [x] Apply snapshot.kpis optional chaining (BusinessIntelligenceAI.tsx) — **DONE**
- [x] Run `npm run build` — must pass — **PASSED**
- [ ] Run `npx tsc --noEmit` — must pass
- [ ] Deploy: `supabase functions deploy --all` (if edge changes)
- [ ] Deploy: Vercel auto-deploy on push
- [ ] Update 10X + BRAINSTORM docs (history alignment)

---

## 8. Service Flow Summary

| Layer | Count | Notes |
|-------|-------|------|
| Active pages (non-archived) | ~35 | See §3.1 |
| Edge functions invoked from frontend | 40+ | hubspot-live-query, smart-ai-advisor, ai-ceo-master, stripe-dashboard-data, sync-hubspot, etc. |
| Agent functions with ReAct loop | 5 | ptd-ultimate-intelligence, ai-ceo-master, ptd-agent-gemini, ptd-agent-atlas, agent-orchestrator |
| Tool executors | 12 | tool-executor.ts |
| Tools available to agents | 39+ | tool-definitions.ts |

---

## Related Docs

- PTD-DEEP-EVALUATION-2026-03-01.md — Root causes, dependency chains
- 10X-EVALUATION-REPORT-2026-03-01.md — Findings table
- BRAINSTORM-PERFECT-DATA-2026-03-01.md — Baseline scores
- KNOWLEDGE.md — Attribution, forensic audit
