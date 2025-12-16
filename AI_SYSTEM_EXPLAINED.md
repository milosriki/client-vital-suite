# AI System Explained — Agentic Architecture (No Mock Data)

## Core Models
- **Claude 3.5 Sonnet** (primary reasoning agent)
- **Gemini 2.5 Pro** (secondary reasoning agent)
- **Specialist agents** (10+ targeted agents for intelligence, fraud, operations)

## Tooling & Function Calling (15 Tools)
1) `client_control` — client data lookup/health
2) `lead_control` — lead search
3) `sales_flow_control` — pipeline data
4) `hubspot_control` — HubSpot sync/workflows
5) `stripe_control` — fraud scan / payments intelligence
6) `call_control` — call transcripts
7) `analytics_control` — dashboards/metrics
8) `intelligence_control` — run AI intelligence routines
9) `get_at_risk_clients`
10) `get_coach_performance`
11) `get_proactive_insights`
12) `get_daily_summary`
13) `run_sql_query`
14) `universal_search`
15) `get_coach_clients`

## Prompt & Context Pipeline
- Unified prompt builder pulls: lifecycle mapping (12-stage lead journey), ultimate-truth alignment, ROI guidance, HubSpot workflow intelligence, RAG snippets, agent memory, and tool specs.
- Agents choose tools, retrieve live Supabase data, then synthesize answers (no synthetic data).

## RAG & Memory
- **Knowledge base:** `knowledge_documents`, `knowledge_base` with embeddings for semantic search.
- **Memory:** `agent_memory` stores past Q&A per thread; embeddings enable recall; `agent_patterns` tracks learned behaviors.

## Self-Learning
- Patterns logged with confidence + usage counts; informs intervention success rules (e.g., when health <50, certain playbooks succeed 85%).

## Reliability & Next Improvements
- Add queueing/retries around agent tasks, richer observability (per-tool metrics), and eval coverage for critical flows (Stripe forensics, HubSpot sync, CAPI batching).
