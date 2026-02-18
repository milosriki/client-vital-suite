# Full Engineering Audit — PTD Fitness Client Vital Suite
## Date: 2026-02-18
## Skills Used: llm-app-patterns, data-engineering-data-pipeline, ai-agents-architect, observability-engineer, prompt-engineering-patterns, kpi-dashboard-design, ui-ux-pro-max, stripe-integration
## Context7: Supabase JS (realtime, RLS), Recharts (tooltip, funnel)

---

## 🔴 CRITICAL — Must Fix (Business Impact)

### 1. NO CIRCUIT BREAKER on LLM calls
**Skill**: llm-app-patterns → §5.3 Fallback Strategy  
**Issue**: `unified-ai-client.ts` has retry+fallback but NO circuit breaker. If DeepSeek goes down, every request will wait for 3 retries × 2 models × exponential backoff = 60+ seconds before failing.  
**Fix**: Add circuit breaker pattern — after 5 consecutive failures, open circuit for 60s, return cached/fallback response immediately.

### 2. NO REQUEST TIMEOUT on LLM fetch()
**Skill**: llm-app-patterns → §5.2 Rate Limiting  
**Issue**: `callDeepSeek()` uses `fetch()` with no `AbortController` timeout. If DeepSeek hangs, the edge function will timeout at Supabase's 60s limit with no graceful handling.  
**Fix**: Add `AbortController` with 30s timeout to all external API calls.

### 3. DATA PIPELINE: No incremental sync, no watermark
**Skill**: data-engineering-data-pipeline → §2 Ingestion  
**Issue**: `sync-hubspot-to-supabase` does full table replace (DELETE ALL + INSERT). 12K contacts = slow, risky (data loss window), no CDC.  
**Fix**: Implement watermark-based incremental sync using `updated_at` column. Only sync records changed since last sync.

### 4. DATA FRESHNESS: 647 hours stale
**Skill**: data-engineering-data-pipeline → §7 Monitoring  
**Issue**: Last HubSpot sync was Jan 22. No automated cron. Dashboard shows stale data with no prominent warning.  
**Fix**: 
- Add freshness badge to EVERY page header (green <24h, yellow <72h, red >72h)
- Set up daily cron job for HubSpot sync
- Add `data_freshness` column to every dashboard query

### 5. client_health_scores: 99.7% RED (formula broken)
**Skill**: kpi-dashboard-design → SMART KPIs  
**Issue**: Health score formula produces RED for almost all clients. This makes the entire health system useless — no signal, all noise.  
**Root cause**: Likely missing/stale input data (sessions, bookings) that the formula depends on.  
**Fix**: Audit the health score calculation, cross-validate with `client_packages_live` (real AWS data), recalibrate weights.

### 6. stripe_transactions: 0 rows (AED 420K+ untracked)
**Skill**: stripe-integration → Webhook Handling  
**Issue**: 2,780 stripe_events exist but stripe_transactions is empty. The `stripe-backfill` function hasn't been run.  
**Fix**: Run `stripe-backfill` to process events → transactions. Add webhook idempotency check.

---

## 🟡 HIGH — Should Fix (Engineering Quality)

### 7. NO PROMPT VERSIONING
**Skill**: prompt-engineering-patterns → §3.2 Prompt Versioning  
**Issue**: Prompts are hardcoded in `unified-prompts.ts`. No A/B testing, no version tracking, no performance measurement.  
**Fix**: Store prompts in `agent_knowledge` table with version, created_at, performance_score. Load at runtime.

### 8. NO PROMPT CACHING
**Skill**: prompt-caching (Antigravity skill)  
**Issue**: Same business context is rebuilt every AI call (queries 6+ tables). No caching.  
**Fix**: Cache business snapshot for 5 minutes. Use hash-based cache key for deterministic prompts.

### 9. MISSING DEAD LETTER QUEUE
**Skill**: data-engineering-data-pipeline → §2 Batch Ingestion  
**Issue**: Failed sync records are silently dropped. No DLQ for failed HubSpot contacts, failed Stripe events, or failed AI calls.  
**Fix**: Create `sync_dead_letter` table. Write failed records there with error reason.

### 10. NO DATA QUALITY FRAMEWORK
**Skill**: data-engineering-data-pipeline → §5 Data Quality  
**Issue**: No validation on data entering the system. Contacts have 138 columns, 30+ are NULL on most records. `appointments` all have 1970-01-01 dates.  
**Fix**: Add validation layer: required fields check, date sanity check, type validation before insert.

### 11. CONTACTS: 30+ NULL columns on first record
**Key NULLs that break features**:
- `phone` — CallTracking can't match calls to contacts
- `owner_name` — SalesPipeline can't filter by owner
- `lead_status` — Funnel stages incomplete
- `speed_to_lead_minutes` — SetterCommandCenter shows "—"
- `first_touch_source/time` — Attribution broken
- `last_activity_date` — "Active" calculations wrong

### 12. appointments: ALL dates 1970-01-01
**Issue**: 1,378 appointments all have epoch date. Date parsing broken in HubSpot sync.  
**Fix**: Fix date parsing in `sync-hubspot-to-supabase` — HubSpot returns millisecond timestamps, need `new Date(ms)`.

### 13. NO REALTIME SUBSCRIPTIONS
**Skill**: Context7 Supabase → Realtime  
**Issue**: Zero pages use Supabase Realtime. All data is fetched once and stale until manual refresh.  
**Fix**: Add Realtime subscriptions for `deals`, `call_records`, `contacts` on critical pages (CommandCenter, SalesPipeline).

### 14. MARKETING PAGE: Display-only, not actionable
**Skill**: kpi-dashboard-design → Department Views  
**Issue**: MarketingIntelligence shows numbers but no actions. Can't:
- Pause/scale campaigns
- Manage creatives
- Set budget
- A/B test ads
**Fix**: Integrate Pipeboard MCP (41 tools) for campaign management directly in dashboard.

---

## 🟠 MEDIUM — Engineering Debt

### 15. NO ARIA LABELS (Accessibility)
**Skill**: ui-ux-pro-max → Accessibility (CRITICAL priority)  
**Issue**: 0 aria-labels across entire app. Fails WCAG 2.1 AA.  
**Fix**: Add aria-label to all icon-only buttons, aria-describedby for data cards.

### 16. AGENT MEMORY: No context compaction in production
**Skill**: ai-agents-architect → Memory Systems  
**Issue**: `useAIChat` in BusinessIntelligenceAI accumulates messages with no compaction. Long sessions will hit context limit.  
**Fix**: Implement sliding window + summary compaction (already in unified-ai-client but not used in frontend).

### 17. NO ERROR BOUNDARIES per section
**Skill**: observability-engineer → Monitoring  
**Issue**: Error boundaries exist per page but not per section. One failed API call crashes the entire page.  
**Fix**: Wrap each Card/section in its own ErrorBoundary.

### 18. LLM TOKEN TRACKING: Disconnected from UI
**Skill**: llm-app-patterns → §4.1 Metrics  
**Issue**: `ai_execution_metrics` table has data (136 rows) but no dashboard shows it. Can't see cost, latency, or error rates.  
**Fix**: Wire `/enterprise/observability` page to show LLM metrics: cost/day, avg latency, error rate, model distribution.

### 19. NO CSV EXPORT on 6 pages
**Skill**: kpi-dashboard-design → Enable drilldown  
**Pages missing export**: CommandCenter, SalesPipeline, MarketingIntelligence, RevenueIntelligence, GlobalBrain, Interventions

### 20. revenue_forecasts table: May be empty
**Issue**: `usePredictions` hook queries `revenue_forecasts` but the forecast edge function writes to response, not table.  
**Fix**: `revenue-forecast` should upsert results into `revenue_forecasts` table.

---

## 📊 DATA FLOW DIAGRAM (Current State)

```
HubSpot ──(manual sync)──→ contacts (12,720)
                          → deals (19,507)
                          → sync_logs

AWS RDS ──(local script)──→ client_packages_live (218)
                          → training_sessions_live (6,589)
                          → aws_ops_snapshot (1)

CallGear ──(2x/day cron)──→ call_records (33,762)
                           → lost_leads (172)
                           → setter_daily_stats (92)

Stripe API ──(edge fn)──→ stripe_events (2,780)
                         → stripe_transactions (0) ← BROKEN
                         
Meta Ads ──(not connected)──→ facebook_ads_insights (1,663) ← STALE

Edge Functions (AI) ──→ ai_execution_metrics (136)
                      → client_predictions (211)
                      → client_health_scores (4,280) ← 99.7% RED
```

## 📋 FIX PRIORITY ORDER

| # | Fix | Impact | Effort | Skill |
|---|-----|--------|--------|-------|
| 1 | Data freshness badge on all pages | HIGH | 1h | observability |
| 2 | Circuit breaker + timeout on LLM | HIGH | 2h | llm-app-patterns |
| 3 | Fix health score formula | HIGH | 3h | business-analyst |
| 4 | Process stripe_transactions | HIGH | 1h | stripe-integration |
| 5 | Fix appointment dates | HIGH | 1h | data-pipeline |
| 6 | Prompt caching | MED | 2h | prompt-caching |
| 7 | Incremental HubSpot sync | MED | 4h | data-pipeline |
| 8 | Realtime subscriptions | MED | 3h | supabase/context7 |
| 9 | Dead letter queue | MED | 2h | data-pipeline |
| 10 | ARIA labels | MED | 2h | ui-ux-pro-max |
| 11 | Revenue forecast persistence | LOW | 1h | data-pipeline |
| 12 | LLM observability dashboard | LOW | 2h | observability |
| 13 | Pipeboard MCP integration | LOW | 8h | meta-ads |
