# Agent Unification Action Plan

## Context
A recent audit highlighted significant discrepancies across the deployed agents in `supabase/functions/`. Two agents currently leverage the shared prompt infrastructure, while nine still rely on inline prompts and divergent role definitions. A shared prompt builder (`_shared/unified-prompts.ts`) and memory system (`_shared/unified-brain.ts`) already exist and should be leveraged consistently.

## Key Gaps
- **Prompt usage**: Only `ptd-agent-gemini` and `ptd-agent-claude` use the unified prompt builder; the remaining agents embed bespoke prompts.
- **Role definitions**: No centralized role registry; personas and tones are scattered across files.
- **Model consistency**: Multiple Claude versions in production (4.5-20250929, 4-20250514, 3.5-20241022, 3 Haiku) plus mixed Gemini versions (2.0/2.5 Flash).
- **Context duplication**: PTD business context is hardcoded in most agents instead of pulled from the shared module.

## Recommended Shared Additions
Add standardized exports to `_shared/unified-prompts.ts` to centralize role and format definitions:
- `AGENT_ROLES` catalog for Smart Agent, Business Intelligence, Churn Predictor, Intervention Recommender, Agent Analyst, and Stripe Payouts AI personas.
- `PTD_BUSINESS_CONTEXT` string covering company profile, key metrics, client segments, and integrations.
- `OUTPUT_FORMATS` for standard response envelopes, client analyses, and intervention plans.
- `ERROR_TEMPLATES` for common failure cases (AI timeout, stale data, API failure) with fallback and retry guidance.

## Migration Priorities
1. **High-traffic agents**: `smart-agent`, `business-intelligence`, `proactive-insights-generator`, `stripe-payouts-ai` — adopt unified prompt builder, attach appropriate role contexts, and include PTD business context.
2. **Specialized agents**: `churn-predictor`, `intervention-recommender`, `agent-analyst` — standardize prompts and personas via shared constants while preserving existing business logic.
3. **Orchestration**: `super-agent-orchestrator` — align role context for synthesis without altering fallback behavior.
4. **Legacy**: Maintain deprecation notice for `ptd-agent` and avoid feature expansion.

## Implementation Notes
- Update `buildUnifiedPromptForEdgeFunction` consumers to incorporate role snippets (persona + capabilities) after the generated prompt.
- Keep existing tools, error handling, and database interactions intact; changes focus solely on prompt construction and context sourcing.
- Standardize AI models to the latest stable variants to reduce divergence.

## Validation Checklist
- Run type checks for `_shared/unified-prompts.ts` (e.g., `deno check supabase/functions/_shared/unified-prompts.ts` when available).
- Exercise critical agent flows in staging: Smart Agent tools, business intelligence summaries, proactive insights generation, Stripe payouts analysis, churn risk scoring, and intervention templates.
- Confirm token usage reductions and output consistency post-migration.
- Monitor error rates and response times to ensure parity with current behavior.
