# 10x Evaluation Prompt — Business Analyst + Data Scientist + MCP Context

> Use this prompt to find 10x improvement opportunities, evaluate findings with statistical rigor, and integrate Context7 MCP for evidence-based recommendations.

---

## Mission

Evaluate client-vital-suite findings with **business analyst** and **data scientist** rigor. Identify **10x improvement opportunities** (not incremental fixes). Use **Context7 MCP** to ground recommendations in current docs. Produce evidence-backed, actionable output.

---

## Phase 1: Define Evaluation Framework

### Business Analyst Lens

| Dimension | Question | Evidence Required |
|-----------|----------|-------------------|
| **North Star** | What is the single metric that matters most? | PTD: "Which ad made me money?" → attribution chain completeness |
| **KPI Hierarchy** | Are metrics correctly nested (leading → lagging)? | Map: ad_spend → leads → calls → deals → revenue |
| **Data Quality** | What % of rows pass validation per source? | Count valid/total per table; flag tables <95% |
| **Attribution** | Can we trace revenue to source? | % of stripe_transactions with contact_id; % of deals with utm_source |
| **Unit Economics** | CAC, LTV, ROAS — are they calculable and correct? | Formula check; null/zero handling |
| **Actionability** | Can a user act on this insight? | Every finding → specific action + expected AED impact |

### Data Scientist Lens

| Dimension | Question | Evidence Required |
|-----------|----------|-------------------|
| **Statistical Validity** | Are comparisons significant? | MoM +100% with prev=0 → not meaningful; need n, p-value, or "from zero" badge |
| **Causal Inference** | Correlation vs causation? | "Ad X drove revenue" — need attribution chain, not just timing |
| **Outlier Handling** | How do we treat anomalies? | Define: 3σ rule, IQR, or domain threshold |
| **Missing Data** | What's the missingness pattern? | MCAR/MAR/MNAR; imputation or exclude |
| **Reproducibility** | Can we recreate this analysis? | Query + timestamp + schema version |
| **Hypothesis Testing** | What are we testing? | H0/H1; reject/fail-to-reject with evidence |

### 10x Question (For Every Finding)

> "What would make this **10x better** — not 10% better?"

| Incremental (1.1x) | 10x |
|-------------------|-----|
| Fix toFixed crash | Automated null-safety lint + runtime guard layer |
| Add one Zod schema | Schema registry + codegen for all 144 functions |
| Fix cancel filter | Data contract enforcement + migration test suite |
| Add source badge | Real-time freshness SLA + alert when stale |
| Context7 in docs | Context7 pre-fetch in agent loop before every tool call |

---

## Phase 2: MCP Context Integration

### When to Use Context7

| Task | resolve-library-id | query-docs |
|------|--------------------|------------|
| Supabase Edge Functions | `/supabase/supabase` | "Error handling best practices in Deno edge functions" |
| React 19 + TanStack Query | `/tanstack/react-query` or `/vercel/next.js` | "Suspense and loading states with useQuery" |
| Zod validation | `/colinhacks/zod` | "Schema validation for API responses" |
| Postgres views | `/supabase/supabase` | "Creating views and RLS policies" |

### Context7 Gate (Mandatory Before Recommendations)

1. **Resolve:** `resolve-library-id` with `libraryName` + `query` (full question)
2. **Query:** `query-docs` with `libraryId` + `query` (specific question)
3. **Max 3 calls per finding.** If no match, state "No Context7 match; using training data."
4. **Cite:** "Per Context7 [library]: [key pattern]"

### MCP-Aware Output Format

```
Finding: [description]
Evidence: [code path, query, screenshot]
Context7: [library ID] — [relevant pattern or "N/A"]
10x Opportunity: [what would make this 10x better]
Business Impact: [AED or % if quantifiable]
Data Science Note: [statistical/causal caveat if any]
Action: [concrete step]
```

---

## Phase 3: Evaluation Protocol

### For Each Finding

1. **Classify:** Data / Agent / API / UX / Trust
2. **Severity:** P0 (blocks) / P1 (degrades) / P2 (improves)
3. **Evidence:** File:line, query, or network trace
4. **Root Cause:** Why does this exist? (Not just where it crashes)
5. **10x Angle:** What structural change would prevent this class of issue?
6. **Context7 Check:** Did we verify against current docs? Cite or say "unverified"
7. **Statistical Note:** If numbers involved — valid comparison? Sample size? Baseline?

### Red Flags (Escalate)

- **No evidence:** "We think X might be wrong" → Must have query/code path
- **Correlation as causation:** "Ad spend up, revenue up" → Need attribution chain
- **Zero baseline:** "MoM +100%" when prev=0 → Misleading; add "from zero" badge
- **Unvalidated output:** Agent returns JSON without schema → Hallucination risk
- **Stale docs:** Recommendation contradicts Context7 → Use Context7 as source of truth

---

## Phase 4: 10x Improvement Matrix

| Current State | 10x Improvement |
|---------------|-----------------|
| Manual finding review | Automated evaluation pipeline: run on every PR |
| Ad-hoc null guards | Type-level enforcement: `NonNullable<T>` + runtime guard layer |
| 6/144 functions with Zod | Schema registry + codegen; CI fails if new function has no schema |
| Context7 in docs only | Context7 pre-fetch in agent loop; inject top-3 snippets into system prompt |
| Source badge in spec | Real-time freshness; alert when any tab exceeds SLA |
| 18 blind spots identified | Continuous blind-spot scanner: weekly diff of findings vs fixes |
| Single Sales Brain design | Unified agent + automated routing by intent |
| No iteration limits | Configurable max_steps + cost ceiling per request |

---

## Phase 5: Output Template

### Executive Summary (1 paragraph)

State: overall health (0–100), top 3 10x opportunities, and critical blockers.

### Findings Table

| # | Finding | Severity | Evidence | Context7 | 10x Opportunity | Action |
|---|---------|----------|----------|----------|-----------------|--------|
| 1 | ... | P0/P1/P2 | file:line | ✓/✗ | ... | ... |

### 10x Priorities (Ranked)

1. **[Name]** — [1 sentence]. Impact: [AED or %]. Effort: [S/M/L].
2. ...

### MCP Verification Log

| Library | Query | Result |
|---------|-------|--------|
| /supabase/supabase | Edge function error handling | [snippet or N/A] |

### Statistical Caveats

- [Any finding where numbers need context: baseline, sample size, significance]

---

## Phase 6: Checklist Before "Done"

- [ ] Every finding has evidence (file:line or query)
- [ ] Context7 called for at least 2 libraries relevant to recommendations
- [ ] 10x opportunity stated for each P0/P1 finding
- [ ] No correlation stated as causation without attribution
- [ ] Zero-baseline metrics flagged
- [ ] Actions are concrete (file, function, or config change)

---

## Quick Reference: Context7 Flow

```
1. resolve-library-id
   libraryName: "supabase" | "react" | "zod" | "tanstack-query"
   query: [full user question]

2. query-docs
   libraryId: [from step 1, e.g. /supabase/supabase]
   query: [specific question, e.g. "How to validate request body with Zod"]

3. Cite in output: "Per Context7 /supabase/supabase: ..."
```

---

## Related Docs

- BRAINSTORM-PERFECT-DATA-2026-03-01.md — Baseline evaluation
- MASTER-PERFECT-DATA-PROMPT.md — Execution prompt
- CRAW-FINDINGS-2026-02-26.md — AWS, cancel status, PowerBI
- TAB-DATA-CONTRACTS.md — Per-tab source contracts
