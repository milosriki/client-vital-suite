# Tracing Integration Plan

This document consolidates the end-to-end plan for enabling reliable tracing across the entire stack, based on analysis of 92 pull requests.

## Objectives
- Achieve end-to-end tracing visibility from frontend → API → Edge Functions.
- Enable sub-2-second diagnostic insights with consistent correlation IDs.
- Deliver unified latency, reliability, and cost reporting for AI-powered flows.

## Current State Snapshot
- LangSmith tracing is only present in ~3-4 of 107+ edge functions (~5% coverage).
- PR #92 (open) introduces shared tracing utilities (`langsmith-tracing.ts`, `prompt-manager.ts`) and the `/api/langsmith/status` endpoint.
- PR #91 (open) surfaces LangSmith status in the UI, but depends on #92.

## Top Gaps Blocking Insights
1. Inconsistent tracing coverage leaves ~95% of operations invisible.
2. No shared correlation IDs spanning frontend → API → Edge Functions.
3. No centralized KPI/latency/cost dashboard to surface insights.

## Fastest Path to Completion
| Timeline | Action | Impact |
| --- | --- | --- |
| Day 0-1 | Merge PRs #92 and #91 to land common tracing utilities and status UX. | Unblocks standardized instrumentation and validation. |
| Day 2-5 | Instrument the top 10 revenue-critical flows using the shared tracing utilities. | Makes core business paths observable. |
| Week 1-2 | Expand to full coverage, add token/cost tracking, and publish dashboards. | Enables portfolio-level observability and cost control. |
| Week 3-4 | Add streaming tracing support and optimize hot paths. | Delivers sub-2-second insights and faster remediation. |

## Execution Checklist (Start Here)
1. **Merge dependencies**: Land PR #92 first, then #91.
2. **Enable correlation IDs**: Propagate a single `x-correlation-id` header from the frontend through API routes to edge functions; ensure each tracer attaches the ID.
3. **Instrument high-impact flows (Day 2-5)**:
   - Checkout/session creation
   - Payment and subscription events
   - AI prompt/response pipelines in edge functions
   - HubSpot/Stripe/Supabase webhooks
4. **Add coverage gates**: Require tracing stubs in new edge functions and APIs via lint/test checks.
5. **Dashboards**: Publish LangSmith/observability dashboards that show latency, success rate, error signatures, and token/cost usage.
6. **Streaming readiness**: Ensure streaming endpoints emit incremental trace chunks with shared correlation IDs.

## Detailed Instrumentation Priorities
- **Backend/Edge Functions**: Add LangSmith tracing middleware to every function; use `withLangsmithTracing` (from PR #92) as the standard entry point. Ensure errors are captured with full context (request params, user/session, correlation ID).
- **Frontend**: Generate a correlation ID per user session (fallback per request) and forward via `x-correlation-id`. Surface tracing status from PR #91 to block risky actions when tracing is unhealthy.
- **API Routes**: Wrap handlers with tracing utilities, record latency, and attach token usage when calling AI providers.

## Reporting and KPIs
- **Latency**: P50/P90/P99 per route and per key AI prompt class.
- **Reliability**: Error rate by route/function and dominant error signatures.
- **Cost**: Tokens and per-request cost aggregated daily; highlight top cost drivers.
- **Adoption**: % of routes/functions emitting traces; target 100% by end of Week 2.

## Validation Steps (per deployment)
- Confirm `/api/langsmith/status` returns `healthy` and displays correctly in the UI (PR #91 dependency).
- Sample traces from a full user journey (frontend → API → Edge) and verify correlation ID continuity.
- Check dashboards for live latency/error/cost signals; ensure alerts fire on SLO breaches.

## Known Risks & Mitigations
- **Partial coverage**: Mitigate with CI guardrails requiring tracing hooks in new/modified edge functions.
- **Missing correlation IDs**: Add request middleware that fails fast when IDs are absent; auto-generate only as a fallback.
- **Provider variability**: Standardize token/cost capture across OpenAI/Anthropic/other providers using adapters from PR #92 utilities.

## Definition of Done
- 100% of frontend/API/edge flows emit LangSmith traces with correlation IDs.
- Dashboards expose latency, reliability, and cost KPIs with alerts.
- Streaming endpoints provide incremental trace visibility with sub-2-second availability of actionable insights.
