# Agent orchestration: current state and improvement plan

This note summarizes how the agent stack is orchestrated today and proposes concrete improvements to make the flows more reliable, observable, and easier to evolve.

## How orchestration works today
- **Entry points**
  - **Vercel `/api/*` routes** ingest external events (health, events, batch events, webhook backfill) and persist them into Supabase.
  - **Supabase Edge Functions** process those events for analytics, enrichment, and external systems (Stripe, HubSpot, call intelligence, RAG prep).
- **Memory + context**
  - Supabase tables store vector knowledge (`knowledge_base`), conversation logs (`agent_conversations`), decisions (`agent_decisions`), proactive insights (`proactive_insights`), and cached context (`agent_context`).
  - RAG and conversation history are pulled from these tables before generating answers.
- **Agent flavors** (see `SMART_AGENT_ARCHITECTURE.md`):
  - **Analyst**: deeper analysis and explanations (Claude).
  - **Advisor**: action planning, interventions, messaging (Claude).
  - **Watcher**: anomaly detection and alerts (Gemini or Claude Lite for speed).
- **Current orchestration pattern**
  - The frontend or API calls a specific agent endpoint/function.
  - The agent pulls recent memory, vector context, and live dashboard facts from Supabase.
  - The agent responds and appends messages/decisions back into Supabase for future grounding.

## Gaps and risks
- **Loose coupling**: Triggers between agents are implicit (e.g., a watcher alert must be manually reviewed before the advisor acts).
- **No global queue/priority**: High-priority incidents and routine checks compete equally; no SLA-aware scheduling.
- **Limited observability**: Decisions and RAG inputs are stored, but tool calls, retries, and latency budgets are not tracked centrally.
- **Recovery is manual**: If a Supabase Edge Function fails or rate limits hit, there is no automatic retry/backoff policy.
- **Evaluation coverage**: There is no automated eval harness to detect regressions in Stripe/HubSpot/call intelligence answers.

## What "better" looks like
- **Explicit orchestration**: Introduce a lightweight orchestrator (Cron/queue-driven Edge Function) that:
  - Picks work from a priority queue (`proactive_insights` can seed it),
  - Assigns it to the appropriate agent (Analyst/Advisor/Watcher),
  - Records tool usage, retries, and outcomes in `agent_decisions`.
- **Structured contracts**: Define typed payloads for cross-agent handoffs (alert → analysis → action) so each step validates inputs before proceeding.
- **Reliability controls**: Add retry/backoff and circuit-breaker helpers around external calls (Stripe, HubSpot) and persist failure reasons for replays.
- **Observability**: Emit per-step metrics (latency, token usage, success/fail) to Supabase tables or a lightweight log index; surface a "last 50 runs" dashboard in the UI.
- **Automatic backfill/replays**: When ingestion gaps are detected (missed webhooks, call records, or payouts), enqueue backfill tasks and track their completion status.
- **Evaluation harness**: Maintain a small set of fixtures (Stripe forensic scenarios, HubSpot sync edge cases, call QA samples) and run nightly evals to catch regressions.

## Quick wins to implement next
1) **Add a queue-backed orchestrator** (Supabase Edge Function) that polls `proactive_insights` and dispatches work to specialized agents with priority and retry metadata.
2) **Log tool calls**: Extend existing agent functions to write tool call inputs/outputs to `agent_decisions` with status fields (`pending`, `retrying`, `failed`, `done`).
3) **Backoff helpers**: Wrap Stripe/HubSpot/call requests with exponential backoff and rate-limit awareness; mark tasks as `retrying` instead of silently failing.
4) **Observability table/view**: Create a Supabase view for the last 50 agent runs (agent type, task, latency, status, error) and surface it in the dashboard.
5) **Eval seeds**: Store a handful of canonical test cases (payments mismatch, missing HubSpot owner, low connect-rate calls) and script a nightly eval job that runs agents against them.

## How this integrates with existing deployment flows
- Deploy orchestrator and logging changes as **Supabase Edge Functions** (use `./deploy-all-functions.sh` after verifying `PROJECT_REF`).
- Deploy any new `/api` surfaces from the **repo root** with `vercel --prod` so serverless routes stay in sync.
- Keep the RAG tables (`knowledge_base`, `agent_conversations`, `agent_decisions`, `proactive_insights`) as the shared memory for all agents and the orchestrator.
