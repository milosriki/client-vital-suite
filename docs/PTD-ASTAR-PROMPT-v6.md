# PTD A-STAR MASTER PROMPT v6

## Objective
Finish `client-vital-suite` with production-grade reliability, strict source-truth wiring, and zero blocking runtime/query failures.

## Source-of-Truth Wiring
- AWS (read-only): clients, coaches, sessions, activity, health base truth
- HubSpot: lead/contact/deal workflow, notes, owner, stage progression
- CallGear: call event/status truth; cross-check into HubSpot lifecycle
- Meta Ads MCP: ad/campaign/spend/performance truth
- Supabase: canonical serving + computed intelligence for UI
- Vercel: production delivery

Conflict policy:
1) Event truth = AWS/CallGear
2) CRM workflow truth = HubSpot
3) Marketing truth = Meta
4) UI serving = Supabase (must mirror truth)

## Non-Negotiables
1. AWS is read-only. No AWS infra changes.
2. No mocks in production.
3. No hardcoded secrets.
4. No “done” without evidence.
5. Stop after 3 repeated failures; redesign approach.

## Mandatory Skill Order
1. brainstorming
2. concise-planning
3. systematic-debugging
4. context7 gate (2 queries max per subsystem)
5. coding-agent-loops/coding-agent (execution)
6. session-logs (loop-prevention post-check)

## Context7 Gate (before non-trivial edits)
- Query 1: contract/API quick check
- Query 2: edge-case + best-practice validation
- Only implement verified patterns.

## Screenshot-Driven P0 Issues
1. Marketing Command Center crash: `toFixed` undefined
2. Daily Ops snapshot null/absence handling
3. Health query contract mismatch (legacy fields vs current table)
4. Coach location normalization gap (`DUBAI • UNKNOWN` style rows)
5. Metric trust clarity gaps (e.g., MoM +100% with prev=0 needs context badge)

## Tab Contract Requirements (every left-nav tab)
For each tab/subtab define:
1. Primary source
2. Secondary/fallback source
3. Required fields
4. Join keys
5. Freshness SLA
6. Failure behavior + empty state
7. Visible source badge in UI

## Execution Waves
A. Stabilize blockers (runtime/query)
B. Repair contracts (schema/field mismatches)
C. Complete intelligence wiring (cross-source)
D. UX trust upgrades (source badges, freshness, empty states)
E. Deploy + full verification

## Acceptance Gates
- `npm run build` passes
- `npx tsc --noEmit` passes
- Zero blocking console runtime errors on core tabs
- Zero missing-column query failures
- Tab-data contracts documented
- Live smoke test passes on all critical tabs

## Evidence Bundle
- Build/typecheck logs
- Before/after screenshots
- Console error delta
- Query parity checks
- Commit IDs + deploy URL + alias verification

## Output Format
1. Done (VERIFIED)
2. In Progress
3. Blocked
4. Next 3

## Deliverables
- `TAB-DATA-CONTRACTS.md`
- `SOURCE-TRUTH-MATRIX.md`
- `REGRESSION-FIX-LOG.md`
- `OPEN-RISKS-AND-NEXT3.md`
- Final production verification report
