# PRD: Intelligence Score 95+ (from 46.7)

## Context
PTD Fitness dashboard + AI agents. Supabase Edge Functions (Deno/TypeScript). 
19 tools in tool-definitions.ts. Gemini AI (4-tier cascade). 151 edge functions.

Key files:
- `supabase/functions/_shared/unified-ai-client.ts` — AI client with tool loop
- `supabase/functions/_shared/tool-definitions.ts` — 19 tools + LISA_SAFE_TOOLS
- `supabase/functions/_shared/tool-executor.ts` — executes tool calls
- `supabase/functions/_shared/smart-prompt.ts` — Lisa v10.0 prompt (272 lines)
- `supabase/functions/_shared/unified-lisa-prompt.ts` — Lisa v7 edge function prompt
- `supabase/functions/_shared/unified-atlas-prompt.ts` — Atlas prompt
- `supabase/functions/_shared/constitutional-framing.ts` — safety guardrails
- `supabase/functions/_shared/learning-layer.ts` — agent memory
- `supabase/functions/_shared/content-filter.ts` — output sanitization
- `supabase/functions/_shared/intelligence-engine.ts` — intelligence service
- `supabase/functions/_shared/social-proof.ts` — testimonial injection
- `supabase/functions/ptd-ultimate-intelligence/index.ts` — main dashboard AI
- `supabase/functions/ptd-agent-gemini/index.ts` — Lisa's brain
- `supabase/functions/ptd-agent-atlas/index.ts` — Atlas's brain
- `supabase/functions/aisensy-orchestrator/index.ts` — WhatsApp orchestrator

Database views available:
- `view_truth_triangle` — Meta/HubSpot/Stripe monthly cross-validation
- `setter_funnel_matrix` — setter performance by owner
- `coach_performance_reports` — coach metrics
- `setter_performance_daily` — daily setter stats
- Tables: contacts, deals, call_records, stripe_transactions (now with contact_id FK), facebook_ads_insights, attribution_events, client_health_scores, staff, knowledge_base, agent_memory, ai_execution_metrics

## Rules
1. All changes are in `supabase/functions/` — edge function layer only
2. DO NOT modify frontend files (separate PRD handles those)
3. Run `deno check` on modified files if available, otherwise verify syntax
4. Every SQL view must use IF NOT EXISTS / CREATE OR REPLACE
5. Test tool execution by checking tool-executor.ts handles the new tools
6. Preserve all existing 19 tools — only ADD, never remove
7. DO NOT expose API keys or secrets in any output

## Scoring Dimensions (all must reach 90+)
- Context Efficiency (was 42) → target 95
- Architecture + Tool Adoption (was 52/40) → target 95
- Learning Loop (was 38) → target 90
- Output Validation (was 15) → target 95
- Anti-Hallucination → target 95
- Error Handling → target 95
- Cross-Source Attribution → target 95 (NEW)
- Token Optimization → target 90 (NEW)

## Tasks

### BATCH 1: Foundation (Low Risk)

- [x] **1. Token Budget Tracker in unified-ai-client.ts** — Add token counting to every AI call. Track input_tokens, output_tokens, model used, latency_ms. Log to `ai_execution_metrics` table. Add budget cap per request (default 8000 output tokens for Atlas, 512 for Lisa). When approaching context limit, auto-compact conversation history using summary. Reference: antigravity skill `context-optimization` and `context-compression`.

- [x] **2. Constitutional Framing for ALL agents** — In `constitutional-framing.ts`, ensure `getConstitutionalSystemMessage()` is called in EVERY edge function that uses AI. Audit all 151 functions, find which ones call `unifiedAI` or Google GenAI directly without constitutional framing. Add the framing call. The constitutional message must include: no hallucination, cite data sources, admit uncertainty, never fabricate numbers.

- [x] **3. Typed Errors in auth-middleware.ts** — Replace `throw new Error("Too Many Requests")` with `throw new RateLimitError(60)` and `throw new Error("Unauthorized...")` with `throw new UnauthorizedError(...)`. Import from app-errors.ts.

### BATCH 2: The Attribution Brain (HIGH IMPACT)

- [x] **4. Create view_atlas_lead_dna SQL view** — This is THE core intelligence view. Create a new migration file. The view joins:
  - `contacts` (lead info, lifecycle, source, email, phone)  
  - `attribution_events` ON `attribution_events.contact_email = contacts.email` (fb_ad_id, fb_campaign_id)
  - `facebook_ads_insights` ON `facebook_ads_insights.ad_id = attribution_events.fb_ad_id` (spend, impressions, clicks, ctr)
  - `call_records` ON `call_records.contact_id = contacts.id` (duration, outcome, sentiment)
  - `deals` ON `deals.contact_id = contacts.id` (stage, deal_value, close_date)
  - `stripe_transactions` ON `stripe_transactions.contact_id = contacts.id` (amount, status)
  - `client_health_scores` ON `client_health_scores.email = contacts.email` (health_score, zone)
  Use LEFT JOINs throughout. Include computed columns: `total_ad_spend`, `total_revenue`, `lead_roas`, `days_to_close`, `call_count`, `avg_call_duration`, `is_converted`. This view answers: "Which ad made me money end-to-end?"

- [x] **5. Create view_capacity_vs_spend SQL view** — Join `staff` (zone, gender) with aggregated `client_health_scores` (active client count per coach) and `facebook_ads_insights` (current spend by targeting). Compute `capacity_pct` per zone/gender segment. When capacity > 85%, flag as PAUSE_ADS.

- [ ] **6. Add `attribution_intelligence` tool to tool-definitions.ts** — New tool that queries `view_atlas_lead_dna`. Actions: `get_lead_dna` (single lead full trace), `get_ad_performance` (ad-level ROI with real revenue), `get_setter_performance` (funnel by setter), `get_coach_performance` (client outcomes by coach), `get_revenue_attribution` (which campaigns/ads drove actual Stripe payments), `get_capacity_alert` (which segments are full). Add to tool-executor.ts.

- [ ] **7. Add `attribution_intelligence` to Atlas's tools** — In ptd-ultimate-intelligence/index.ts, ensure Atlas personas (ATLAS, SHERLOCK, etc.) have access to the new tool. Update the ATLAS system prompt to mention this capability: "You can now trace any lead from the Facebook ad that generated them, through their calls, deals, and payments. Use attribution_intelligence tool."

### BATCH 3: Agent Intelligence Upgrade

- [ ] **8. Universal Tool Adoption for ptd-ultimate-intelligence** — Currently ptd-ultimate-intelligence imports `tools` from tool-definitions but may not use all of them effectively. Ensure the tool loop in unified-ai-client.ts properly handles ALL 20 tools (19 existing + 1 new). Verify the tool loop retries on transient failures. Add max_tool_calls limit (default 10) to prevent infinite loops.

- [ ] **9. Output Validation for ALL marketing agents** — Add JSON schema validation to every agent that produces structured output. Create a `validateAgentOutput(schema, data)` utility. Apply to: marketing-copywriter, ad-creative-analyst, data-reconciler, business-intelligence, proactive-insights-generator. Each must return valid JSON with required fields or throw ValidationError.

- [ ] **10. Memory Retention + Context Namespacing in learning-layer.ts** — Verify agent_memory has TTL columns (expires_at, archived) and agent_name namespacing. Add auto-cleanup: on each agent run, delete expired memories. Add relevance scoring: when retrieving memories, score by recency + frequency + relevance to current query. Limit retrieved memories to top 5 by score to save tokens.

- [ ] **11. Lisa Capacity Awareness** — In smart-prompt.ts or unified-lisa-prompt.ts, add a section: before booking, Lisa must check capacity. Add a new tool `check_capacity` to LISA_SAFE_TOOLS that queries `view_segment_capacity_hud` (or the new `view_capacity_vs_spend`). If the lead's zone/gender segment is >85% full, Lisa says: "just checking with the team on availability in your area..." and routes to a different zone or suggests waitlist. NO fake urgency. Real capacity data.

- [ ] **12. Social Proof from Real Data** — In social-proof.ts, ensure testimonials are pulled from REAL `knowledge_base` entries tagged as success stories, not hardcoded. Lisa should inject relevant proof: "one of our clients in marina lost 12kg in 8 weeks" — but ONLY if it's a real entry. Add a query to `knowledge_base WHERE category = 'success_story' AND tags LIKE '%zone%'` matching the lead's area.

### BATCH 4: Polish to 95+

- [ ] **13. Cross-Source Discrepancy Auto-Detection** — In data-reconciler or a new function, add automatic detection: compare `view_truth_triangle` monthly. If gap_stripe_hubspot > 10% in any month, auto-create an alert in `sync_errors` table with details. Atlas should surface these in dashboard chat without being asked.

- [ ] **14. Prompt Optimization for Token Efficiency** — Audit smart-prompt.ts (272 lines) and unified-lisa-prompt.ts. Apply antigravity skill `prompt-caching` principles: move static content (identity, rules, playbook) to cached prefix. Only dynamic content (context, phase, history) should be in the variable portion. This reduces token cost by ~40% per Lisa call.

- [ ] **15. Agent Self-Evaluation Loop** — Add to ptd-ultimate-intelligence: after every response, the agent rates its own confidence (0-100) based on data quality. If confidence < 70, append "[Low confidence — data gaps detected]" to response. Log confidence to ai_execution_metrics. This prevents hallucination by making uncertainty visible.

### BATCH 5: Elite Intelligence (Skills-Driven — 95+ Push)

- [ ] **16. Lisa Sales State Machine (from elite-sales-booking skill)** — Replace message-count-based phase detection in smart-prompt.ts with a proper state machine. Store `sales_stage` in HubSpot contact property via hubspot-manager.ts. Stages: CONNECTION → SITUATION → PROBLEM_AWARENESS → SOLUTION_AWARENESS → CONSEQUENCE → CLOSE. Never advance to stage N+1 until stage N criteria are met (goal extracted, area confirmed, etc). Load stage-specific prompts from a `sales_stages` config object. This replaces the current `getConversationPhase()` which just checks message_count.

- [ ] **17. Atlas Chain-of-Thought + Self-Critique (from prompt-optimize skill)** — In ptd-ultimate-intelligence/index.ts, add a Constitutional AI self-critique loop to Atlas. After generating a response, Atlas must: (1) verify all numbers against tool call results, (2) flag any claims without data backing, (3) rate confidence 0-100. Apply Chain of Thought to complex queries: "Step 1: Identify relevant data sources. Step 2: Query each source. Step 3: Cross-reference results. Step 4: Generate insight. Step 5: Self-verify." This prevents hallucination and forces data-backed answers.

- [ ] **18. Marketing Psychology Integration for Lisa (from marketing-psychology skill)** — Add Psychological Leverage & Feasibility Score (PLFS) to Lisa's decision-making. When selecting persuasion tactics, Lisa scores each on: Relevance (1-5), Impact (1-5), Ethical Rating (1-5). Only use top 3 tactics per conversation. Specifically apply: (1) Tactical Empathy (label emotions), (2) Self-Persuasion (help them convince themselves), (3) Micro-Commitments (small yeses before big ask). These are already partially in smart-prompt.ts — make them systematic with scoring.

- [ ] **19. Anchored Iterative Memory Compression (from context-compression skill)** — In learning-layer.ts, replace naive memory retrieval with anchored iterative summarization. When agent_memory exceeds 20 entries for a conversation, compress older entries into a structured summary: Session Intent, Key Facts Learned, Decisions Made, Current State. Merge incrementally (don't regenerate full summary each time). This saves 60%+ tokens while preserving critical context. Add explicit artifact tracking for file modifications.

- [ ] **20. Multi-Agent Cost Profiling (from agent-orchestration skill)** — Add cost tracking to unified-ai-client.ts. Log per-request: model, input_tokens, output_tokens, tool_calls_count, total_cost_estimate, latency_ms. Create a `view_agent_cost_summary` SQL view that aggregates by function_name, day, model. Atlas should be able to answer "how much did AI cost us this week?" Add budget alerts: if daily cost exceeds $50, log warning. Use the 4-tier Gemini cascade efficiently: Flash for simple queries, Pro only for complex cross-source analysis.

- [ ] **21. Vercel Edge Config for Feature Flags** — Use Vercel Edge Config (via MCP or API) to add feature flags for: `enable_truth_triangle`, `enable_capacity_alerts`, `enable_attribution_chain`, `lisa_state_machine_enabled`. This lets you toggle new intelligence features without redeploying. Check flag in each edge function before executing new logic.

- [ ] **22. Final verification** — List all modified files. Verify no syntax errors. Verify tool-executor.ts handles all new tools. Verify constitutional framing is in every AI-calling function. Run agent evaluation: test Atlas with 5 critical queries ("which ad makes money?", "which setter is best?", "which coach converts?", "are we leaking money?", "should I scale campaign X?") and verify data-backed answers.
