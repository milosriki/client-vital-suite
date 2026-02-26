# Autonomous Full Platform Audit — Vital Suite

> **Run:** `claude --dangerously-skip-permissions -p "$(cat docs/prompts/AUTONOMOUS_FULL_AUDIT.md)"`
>
> **Estimated duration:** 30-60 minutes autonomous execution
>
> **Safety:** Read-only audit. No DB writes, no deploys, no migrations, no `supabase db reset`.

---

## MISSION

You are a senior AI engineer + LLM specialist auditing the entire Vital Suite platform.
Your job: systematically verify every page, every service, every data flow, every column.
Output a single structured report at `docs/audit/FULL_PLATFORM_AUDIT_REPORT.md`.

Read CLAUDE.md first. Obey all safety rules.

---

## EXECUTION STRATEGY

Use **parallel subagents** (Task tool) wherever tasks are independent.
Maximum 4 concurrent subagents per phase.
After each phase, update the report file with findings before starting the next phase.
Run `npm run build` after any code analysis to confirm build health.

---

## PHASE 1: BUILD HEALTH + TYPE SAFETY (Batch — Run First)

### 1.1 Build Verification
```bash
npm run build 2>&1
```
- Record: total warnings, total errors, any missing imports
- If build fails: log all errors with file:line

### 1.2 TypeScript Strict Check
```bash
npx tsc --noEmit 2>&1
```
- Count type errors by file
- Categorize: missing types, null safety, incorrect generics, unused vars

### 1.3 Dead Import Analysis
```bash
# Find imports that reference non-existent files
grep -rn "from ['\"]\./" src/ --include="*.tsx" --include="*.ts" | head -200
```
- Cross-reference: does each imported file exist?
- Flag: orphaned imports, circular dependencies

---

## PHASE 2: PAGE-BY-PAGE DATA AUDIT (Parallel Subagents)

For EACH of these 33 active pages, spawn a subagent that:
1. Reads the page component file
2. Identifies ALL hooks and data sources used
3. Checks if data sources return real data or mock/hardcoded data
4. Lists every tab, every column, every metric displayed
5. Flags: missing data, null safety issues, hardcoded mock arrays, broken columns

### Group A — Dashboard & Command (2 pages)
| Route | File | Subagent Task |
|-------|------|---------------|
| `/` | `src/pages/ExecutiveOverview.tsx` | Audit all 11 KPI metrics, verify each maps to a real Supabase query, check funnel conversion calculations |
| `/command-center` | `src/pages/CommandCenter.tsx` | Audit RPC `get_command_center_data`, verify all 16 queries, check JSONB parsing safety |

### Group B — Sales & Pipeline (4 pages)
| Route | File | Subagent Task |
|-------|------|---------------|
| `/sales-pipeline` | `src/pages/SalesPipeline.tsx` | Audit deal stages, verify `deals` table columns match UI, check HubSpot sync trigger |
| `/sales-tracker` | `src/pages/SalesCoachTracker.tsx` | Audit setter funnel, `setter_daily_stats` columns, no-show calculation |
| `/lead-tracking` | `src/pages/LeadTracking.tsx` | Audit lead lifecycle, attribution fields, stale lead detection |
| `/conversion-funnel` | `src/pages/ConversionFunnel.tsx` | Audit stage grouping logic, verify all stages exist in `deals.stage` |

### Group C — Revenue (1 page)
| Route | File | Subagent Task |
|-------|------|---------------|
| `/revenue` | `src/pages/RevenueIntelligence.tsx` | Audit Stripe edge function data, pipeline calculations, HubSpot health, revenue channels |

### Group D — Marketing & Attribution (1 page)
| Route | File | Subagent Task |
|-------|------|---------------|
| `/marketing` | `src/pages/MarketingIntelligence.tsx` | **CRITICAL:** Identify ALL 40 mock data arrays, map which charts use real vs mock, list every tab and its data source |

### Group E — Client Management (3 pages)
| Route | File | Subagent Task |
|-------|------|---------------|
| `/clients` | `src/pages/Clients.tsx` | Audit health score filters, pagination, column mappings to `client_health_scores` |
| `/clients/:email` | `src/pages/ClientDetail.tsx` | Audit 360-view fields, intervention history, session data completeness |
| `/client-activity` | `src/pages/ClientActivity.tsx` | Audit activity timeline, verify event types and sorting |

### Group F — Team & Coaching (4 pages)
| Route | File | Subagent Task |
|-------|------|---------------|
| `/coaches` | `src/pages/Coaches.tsx` | Audit coach metrics, health zones, session counts, client enrichment |
| `/coach-locations` | `src/pages/CoachLocations.tsx` | Audit GPS data sources — is `mdm_location_events` wired or still mock coordinates? |
| `/interventions` | `src/pages/Interventions.tsx` | Audit `intervention_log` columns, status filters, priority logic |
| `/skills` | `src/pages/SkillCommandCenter.tsx` | Audit skill assessment data source, radar chart dimensions |

### Group G — Operations & Calls (3 pages)
| Route | File | Subagent Task |
|-------|------|---------------|
| `/calls` | `src/pages/CallTracking.tsx` | Audit `call_records` columns (call_direction, call_outcome, duration), owner filter |
| `/daily-ops` | `src/pages/DailyOps.tsx` | Audit `aws_ops_snapshot` JSONB parsing, verify all fields are safely parsed |
| `/setter-command-center` | `src/pages/SetterCommandCenter.tsx` | Audit delegation tracking, speed-to-lead, view_delegation_analytics columns |

### Group H — Intelligence & Analytics (5 pages)
| Route | File | Subagent Task |
|-------|------|---------------|
| `/global-brain` | `src/pages/GlobalBrain.tsx` | Audit brain API endpoints, knowledge retrieval, memory facts |
| `/intelligence` | `src/pages/BusinessIntelligenceAI.tsx` | Audit 6-table parallel fetch (useBusinessSnapshot), LLM chat integration |
| `/predictions` | `src/pages/PredictiveIntelligence.tsx` | Audit `client_predictions` table, churn model outputs, threshold logic |
| `/war-room` | `src/pages/WarRoom.tsx` | Audit CAC/LTV calculations, unit economics, revenue forecasting |
| `/alert-center` | `src/pages/AlertCenter.tsx` | Audit alert types, severity levels, dismissal logic |

### Group I — Enterprise (7 pages)
| Route | File | Subagent Task |
|-------|------|---------------|
| `/enterprise/strategy` | `src/pages/enterprise/EnterpriseStrategy.tsx` | Audit `mv_enterprise_truth_genome`, segment capacity HUD |
| `/enterprise/call-analytics` | `src/pages/enterprise/CallAnalytics.tsx` | Is this real data or shell/mock? |
| `/enterprise/observability` | `src/pages/enterprise/SystemObservability.tsx` | Audit system health metrics — real `ai_execution_metrics` or mock? |
| `/enterprise/ai-advisor` | `src/pages/enterprise/AIAdvisor.tsx` | Audit AI advisor queue, recommendation engine data |
| `/enterprise/client-health` | `src/pages/enterprise/ClientHealth.tsx` | Shell or real? Check if wired to `client_health_scores` |
| `/enterprise/coach-performance` | `src/pages/enterprise/CoachPerformance.tsx` | Shell or real? Check if wired to `coach_performance` |
| `/enterprise/knowledge-base` | `src/pages/enterprise/KnowledgeBase.tsx` | Audit vector search integration, pgvector usage |

### Group J — Archived (3 pages)
| Route | File | Subagent Task |
|-------|------|---------------|
| `/lead-follow-up` | `src/pages/_archived/LeadFollowUp.tsx` | Audit: still functional or broken after archival? |
| `/attribution-leaks-detail` | `src/pages/_archived/AttributionLeaks.tsx` | Identify mock arrays, assess if real attribution data available |
| `/workflow-strategy` | `src/pages/_archived/WorkflowStrategy.tsx` | Audit: still functional or broken? |

---

## PHASE 3: HOOK-TO-TABLE COLUMN VERIFICATION (Critical)

For each custom hook in `src/hooks/`, verify:

1. **Column existence**: Every `.select("col1, col2, col3")` — does each column exist in `src/integrations/supabase/types.ts`?
2. **Null safety**: Every `.toFixed()`, `.toLowerCase()`, `.split()`, `.map()` on query results — is there null checking?
3. **Type casting**: Any `as unknown as X` or `as any` — flag dangerous casts
4. **Missing error handling**: Any `const { data } = await supabase...` without checking `error`
5. **Stale query keys**: Do QUERY_KEYS in `src/config/queryKeys.ts` match actual usage in hooks?

### Hooks to audit:
```
src/hooks/useExecutiveData.ts
src/hooks/useMarketingAnalytics.ts
src/hooks/useRevenueIntelligence.ts
src/hooks/useDailyOps.ts
src/hooks/useClientHealthScores.ts
src/hooks/useSessionIntelligence.ts
src/hooks/useTruthTriangle.ts
src/hooks/useDeepIntelligence.ts
src/hooks/useProactiveInsights.ts
src/hooks/usePredictions.ts
src/hooks/usePeriodComparison.ts
src/hooks/useCohortProgression.ts
src/hooks/useClientActivity.ts
src/hooks/useDedupedQuery.ts
src/hooks/useMasterSync.ts
src/hooks/useMetaAds.ts
src/hooks/enterprise/useEnterpriseTruthGenome.ts
src/hooks/enterprise/useClientXRay.ts
src/hooks/enterprise/useCoachCommand.ts
src/hooks/enterprise/useSystemObservability.ts
src/hooks/enterprise/useCallAnalytics.ts
src/hooks/enterprise/useKnowledgeSearch.ts
src/hooks/enterprise/useAIAdvisorQueue.ts
src/hooks/enterprise/useRealtimeHealthScores.ts
```

---

## PHASE 4: EDGE FUNCTION SERVICE HEALTH (Parallel)

### 4.1 Shared Module Integrity
Read `supabase/functions/_shared/unified-ai-client.ts` and verify:
- Gemini cascade order (3.1-flash → 2.0-flash → 1.5-flash → 3-pro)
- Circuit breaker thresholds
- Token tracking accuracy
- No Anthropic/Claude SDK references

### 4.2 Tool Executor Coverage
Read `supabase/functions/_shared/tool-executor.ts` and verify:
- All 12 executor types are implemented
- Each executor handles errors properly
- No silent failures (catch blocks that swallow errors)

### 4.3 Webhook Functions (DO NOT MODIFY — Read Only)
For each webhook, verify the handler signature and data flow:
- `supabase/functions/hubspot-webhook/index.ts` — contact/deal upsert + attribution enrichment
- `supabase/functions/stripe-webhook/index.ts` — payment event handling
- `supabase/functions/callgear-webhook/index.ts` — call recording ingestion
- `supabase/functions/anytrack-webhook/index.ts` — click attribution
- `supabase/functions/calendly-webhook/index.ts` — booking events

### 4.4 Cron Function Data Population
For each cron function, verify:
- Does it write to the table the frontend reads?
- Is the schedule correct (UTC vs Dubai time)?
- Is there error handling + retry?

Key cron → table mappings to verify:
| Cron Function | Writes To | Frontend Reads From |
|---------------|-----------|---------------------|
| marketing-historian | facebook_ads_insights (baseline) | useMarketingAnalytics |
| health-calculator | client_health_scores | useClientHealthScores |
| daily-marketing-brief | daily_marketing_briefs | useDeepIntelligence |
| true-roas-calculator | true_roas_results? | campaign_full_funnel view |
| funnel-stage-tracker | funnel_metrics? | useDeepIntelligence |
| marketing-loss-analyst | loss_analysis | useDeepIntelligence |
| populate-baselines | marketing_baselines? | useMarketingAnalytics |
| ad-creative-analyst | ad_creative_analysis? | MarketingIntelligence |
| coach-analyzer | coach_performance | useCoachCommand |
| churn-predictor | client_predictions | usePredictions |

---

## PHASE 5: DATA FLOW COMPLETENESS (E2E Chains)

### 5.1 Attribution Chain Verification
Trace the complete path and verify each link exists:
```
Facebook Ad (Meta API)
  → facebook_ads_insights (fetch-facebook-insights cron)
    → anytrack-webhook → attribution_events (email/phone/fb_ad_id)
      → attribution_chain (hubspot_contact_id + form_event_id)
        → contacts.attributed_ad_id, attributed_campaign_id
          → deals.contact_id (FK)
            → stripe_transactions.contact_id (FK)
              → Revenue (deal_value + stripe amount)
```
For each arrow: verify the column exists, the FK is enforced, data is populated.

### 5.2 HubSpot Sync Chain
```
HubSpot API → hubspot-webhook → contacts (66 properties)
HubSpot API → hubspot-sync-hourly → contacts + deals (batch)
contacts.hubspot_contact_id → deals.contact_id → attribution
```
Verify: are all 66 HubSpot properties mapped in `hubspot-field-mapping.ts` actually used in the frontend?

### 5.3 Revenue Reconciliation Chain
```
Stripe → stripe-webhook → stripe_transactions
Stripe → stripe-backfill → stripe_transactions
stripe_transactions.contact_id → contacts.id
deals.contact_id → contacts.id
=> view_truth_triangle (Meta spend + HubSpot deals + Stripe revenue)
```
Verify: does `view_truth_triangle` exist? Does it join correctly?

### 5.4 GPS Data Chain
```
TinyMDM API → tinymdm-pull-locations → mdm_location_events
mdm_location_events → gps-dwell-engine → coach_gps_patterns
coach_gps_patterns → CoachLocations.tsx
```
Verify: is CoachLocations using real `mdm_location_events` or mock coordinates?

### 5.5 AI Intelligence Chain
```
unified-ai-client.ts → Gemini API (4-tier cascade)
  → tool-executor.ts (12 executors)
    → tool-definitions.ts (40+ tools)
      → learning-layer.ts (agent_memory, ai_feedback_learning)
        → proactive_insights (frontend reads via useProactiveInsights)
```
Verify: does the cascade actually fall back correctly? Is learning-layer writing to real tables?

---

## PHASE 6: MISSING TABS & COLUMNS DETECTION

### 6.1 Frontend Columns vs Database Columns
For each page that renders a DataTable or table:
1. Extract all column accessors/keys from the JSX
2. Cross-reference with `src/integrations/supabase/types.ts`
3. Flag any column that:
   - Doesn't exist in the database type (typo or removed column)
   - Exists but is always null (never populated by any function)
   - Has wrong type (string vs number vs boolean)

### 6.2 Missing Tabs Analysis
For each page with tab navigation:
1. List all tabs and their content
2. Identify tabs that render empty/placeholder content
3. Identify tabs that should exist but don't (based on available data)

### 6.3 Missing Pages Analysis
Based on available edge functions and data tables, identify:
- Edge functions with no corresponding frontend UI
- Database views with no frontend consumer
- Hooks that exist but aren't imported by any page

---

## PHASE 7: MOCK DATA INVENTORY (Comprehensive)

Find EVERY instance of hardcoded/mock data in the frontend:
```bash
# Search patterns
grep -rn "mockData\|MOCK_\|sampleData\|demoData\|hardcoded\|placeholder" src/ --include="*.tsx" --include="*.ts"
grep -rn "const.*=.*\[.*{.*name:.*value:" src/ --include="*.tsx" --include="*.ts"
```

For each mock data array found:
1. File path + line number
2. What it represents (users, campaigns, revenue, etc.)
3. Is real data available in Supabase for this?
4. Priority: HIGH (blocks real insights), MEDIUM (visualization only), LOW (example/template)

---

## PHASE 8: CURRENCY & FORMATTING AUDIT

### 8.1 Currency Display
- All revenue values MUST display as AED (not $)
- Verify `formatCurrency` from `src/lib/ceo-utils.tsx` is used everywhere
- Flag any page using `$` or `USD` formatting directly
- Check: is dual display (AED primary + USD equivalent) implemented?

### 8.2 Number Formatting
- All `.toFixed()` calls must have null checks
- All percentages must handle division by zero
- Date formatting must use `date-fns` consistently

---

## PHASE 9: SECURITY & QUALITY SCAN

### 9.1 Secrets Check
```bash
grep -rn "ANTHROPIC\|sk-\|api_key.*=.*['\"]" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".env"
```

### 9.2 Console Pollution
```bash
grep -rn "console.log\|console.warn\|console.error" src/ --include="*.tsx" --include="*.ts" | wc -l
```
- Count by file, flag excessive logging (>5 per file)

### 9.3 Error Boundary Coverage
For each page route, verify it has:
- `<ErrorBoundary>` wrapper (or route-level error boundary)
- `<Suspense>` with appropriate fallback
- Error state handling in data hooks

---

## OUTPUT FORMAT

Create `docs/audit/FULL_PLATFORM_AUDIT_REPORT.md` with this structure:

```markdown
# Vital Suite — Full Platform Audit Report
**Generated:** [timestamp]
**Build Status:** PASS/FAIL (X errors, Y warnings)
**TypeScript Status:** PASS/FAIL (X type errors)

## Executive Summary
- Total pages audited: X/33
- Pages with real data: X
- Pages with mock data: X
- Pages with broken columns: X
- Missing data flows: X
- Critical issues: X
- Warnings: X

## Build Health
[build output + type errors]

## Page-by-Page Audit Results
### / (ExecutiveOverview)
- **Status:** ✅ PASS / ⚠️ WARN / ❌ FAIL
- **Data Sources:** [list]
- **Tabs:** [list with status]
- **Columns:** [list, flagging missing/null]
- **Mock Data:** [yes/no, details]
- **Issues:** [list]

[repeat for all 33 pages]

## Data Flow Verification
### Attribution Chain: ✅/❌
### HubSpot Sync: ✅/❌
### Revenue Reconciliation: ✅/❌
### GPS Pipeline: ✅/❌
### AI Intelligence: ✅/❌

## Missing Components
### Edge Functions Without UI
[list]

### Database Views Without Frontend Consumer
[list]

### Hooks Without Page Consumer
[list]

## Mock Data Inventory
| File | Line | Data | Real Data Available? | Priority |
[table]

## Currency Audit
[findings]

## Security Scan
[findings]

## Recommendations (Priority Ordered)
### Critical (Fix Now)
### High (This Sprint)
### Medium (Next Sprint)
### Low (Backlog)
```

---

## RULES

1. **DO NOT** modify any production code — this is a READ-ONLY audit
2. **DO NOT** run `supabase db reset` or any destructive database commands
3. **DO NOT** deploy anything — no `vercel deploy`, no `supabase functions deploy`
4. **DO NOT** modify `.env` files
5. **DO NOT** delete any files
6. **DO** create the audit report file at `docs/audit/FULL_PLATFORM_AUDIT_REPORT.md`
7. **DO** create `docs/audit/` directory if it doesn't exist
8. **DO** run `npm run build` and `npx tsc --noEmit` for health checks
9. **DO** use parallel subagents for independent page audits (Groups A-J)
10. **DO** cross-reference types.ts for every column reference
11. If you hit context limits, write partial results to the report, note where you stopped, and exit cleanly
