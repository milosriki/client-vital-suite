# MASTER PERFECT DATA PROMPT v1

> Use this prompt for any agent/session focused on finishing client-vital-suite with 100% perfect data.

---

## Mission

Finish `client-vital-suite` with **100% perfect data**: zero runtime crashes, strict source-truth wiring, and evidence for every claim. No "done" without verification.

---

## Source-of-Truth (Immutable)

| Priority | Source | Use For |
|----------|--------|---------|
| 1 | AWS (read-only) | clients, coaches, sessions, cancel status, activity |
| 2 | CallGear | call events, status, recordings |
| 3 | HubSpot | leads, contacts, deals, workflow, owner |
| 4 | Meta Ads | ads, spend, performance, CAPI |
| 5 | Supabase | canonical serving layer, computed intelligence |

**Conflict rule:** Event truth > CRM workflow > UI cache.

---

## Data Rules (Non-Negotiable)

### Cancel Filter
```sql
status LIKE 'Cancelled-%' AND status != 'Cancelled-Rebooked'
```
Never use `status = 'Cancelled'` — returns zero rows.

### Number Formatting
```ts
(value ?? 0).toFixed(n)
```
Always guard before `.toFixed()`, `.toLocaleString()`.

### Snapshot Access
```ts
(snapshot?.kpis?.totalRevenue ?? 0).toLocaleString()
(snapshot?.funnel?.leads ?? 0)
(snapshot?.topCampaigns ?? []).map(...)
```
Never assume `snapshot.kpis` exists.

### Views (Intelligence)
- `view_atlas_lead_dna`, `view_contact_360`, `view_capacity_vs_spend`
- `source_discrepancy_matrix`, `view_marketing_attribution`
If missing, fail gracefully with "View not available".

---

## Context7 Gate (Before Non-Trivial Edits)

1. **resolve-library-id** — `libraryName` from task (e.g. "supabase", "react", "tanstack-query")
2. **query-docs** — `query` = specific question (e.g. "Supabase Edge Functions error handling")
3. Implement only verified patterns.
4. **Max 2 queries per subsystem.**

---

## Agent Rules

- **Max 10 tool iterations** per request. Break and return "Max steps reached" if exceeded.
- **Tool errors:** If tool returns `{ error: string }`, report it and stop. Do not retry blindly.
- **Confidence < 70%:** Say "Data unavailable" — never guess or hallucinate numbers.
- **Output validation:** Use Zod for every agent that returns structured data.
- **Format:** INSIGHT → EVIDENCE → ACTION → EXPECTED IMPACT.

---

## Mandatory Skill Order

1. brainstorming
2. concise-planning
3. systematic-debugging
4. context7 gate (2 queries max per subsystem)
5. coding-agent-loops / coding-agent (execution)
6. session-logs (loop-prevention post-check)

---

## Verification Checklist (Before "Done")

- [ ] `npm run build` passes
- [ ] `npx tsc --noEmit` passes
- [ ] No console errors on affected tab
- [ ] Screenshot or network proof of real data
- [ ] Tab data contract documented if new

---

## Output Format

1. **Done (VERIFIED)** — with evidence (build log, screenshot, commit)
2. **In Progress** — current step
3. **Blocked** — reason + what's needed
4. **Next 3** — ordered next actions

---

## Key Files

| File | Purpose |
|------|---------|
| CRAW-FINDINGS-2026-02-26.md | AWS cancel status, PowerBI views, company metrics |
| KNOWLEDGE.md | Project truth, schema, decisions |
| WIRING_ANALYSIS.md | Function wiring, cron jobs |
| TAB-DATA-CONTRACTS.md | Per-tab source, freshness, failure policy |
| SOURCE-TRUTH-MATRIX.md | Tab → source mapping |
| BRAINSTORM-PERFECT-DATA-2026-03-01.md | Full evaluation, blind spots, solutions |

---

## Anti-Patterns (Do Not)

- Hardcode secrets
- Use mocks in production
- Fix without root-cause investigation
- Claim "done" without evidence
- Retry same failing approach 3+ times — redesign instead
