# PRD: Phase 2 — Agent Intelligence Overhaul

## Context
Working directory: /Users/milosvukovic/client-vital-suite
39 AI agents use Gemini via unifiedAI.chat(). Only 1/39 validates LLM output. Token budget tracker is broken (always 0). 8/9 marketing agents use INSERT not UPSERT. Memory tables grow unbounded.

## Tasks

- [x] Fix token budget tracker in supabase/functions/_shared/unified-ai-client.ts: The totalTokens and totalCost fields are always 0 because usageMetadata from Gemini responses is never extracted. After each successful AI call, extract usage_metadata.prompt_token_count and usage_metadata.candidates_token_count from the response and increment the tracking fields. Log usage per function name.
- [ ] Add Zod output validation to top 5 AI agents: marketing-analyst, marketing-scout, ad-creative-analyst, proactive-insights-generator, and health-calculator. For each: define a Zod schema for the expected LLM output, validate after JSON.parse, and log validation failures. Use the pattern from marketing-copywriter which already validates correctly.
- [ ] Convert 8 marketing agents from INSERT to UPSERT: marketing-analyst, marketing-scout, marketing-predictor, marketing-allocator, loss-analyst, ad-creative-analyst, proactive-insights-generator, populate-loss-analysis. Add composite unique keys where needed (e.g. ad_id + date, or campaign_id + analysis_date). Check for existing duplicates first and dedup before adding UNIQUE constraints.
- [ ] Create memory retention cron: New edge function cleanup-old-agent-data that runs daily. Delete agent_memory older than 90 days. Delete agent_conversations older than 30 days. Update agent_patterns.last_used_at and delete patterns not used in 180 days.
- [ ] Add 4 new pg_cron schedules via migration: populate-loss-analysis daily 2AM UTC, populate-baselines daily 3AM UTC, ad-creative-analyst daily 4AM UTC, true-roas-calculator daily 5AM UTC. Use same net.http_post pattern as existing crons.
- [ ] Run npm run build && npx tsc --noEmit to verify zero errors
- [ ] Git commit: "feat: phase 2 - agent intelligence overhaul, validation, memory retention"
