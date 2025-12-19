# Ultimate Multi-Agent Code Audit Plan v3.0

## Pre-Audit Discovery: Issues Already Found

Before even running agents, I discovered these **critical issues**:

### CRITICAL - Fix Immediately

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **Debug code in production** | `src/components/ptd/HealthIntelligenceTab.tsx:45,53,57` | Hardcoded `localhost:7242` fetch calls will fail in prod |
| 2 | **Orphan page not in router** | `src/pages/WorkflowStrategy.tsx` | Page exists but unreachable - dead code or missing route? |
| 3 | **Ghost functions on Supabase** | 111 deployed vs 68 in code | 43 functions exist on Supabase but not in codebase - old deploys? |

### HIGH - Fix Soon

| # | Issue | Count | Impact |
|---|-------|-------|--------|
| 4 | Console.log statements | 145 | Debug noise in production |
| 5 | `any` type usage | 262 | Weak typing, potential runtime errors |
| 6 | Empty catch blocks | 5 | Silently swallowed errors |
| 7 | Orphan edge functions | ~31 | Functions in code but never called |
| 8 | Mixed SDK versions | 2+ | `@supabase/supabase-js@2` vs `@2.75.0` |
| 9 | Unresolved TODOs | 1+ | `DataEnrichmentTab.tsx:38` |

### MEDIUM - Code Quality

| # | Issue | Impact |
|---|-------|--------|
| 10 | 33 different env vars | Need verification all are set |
| 11 | Functions create client inside handler | Inefficient, should use shared |
| 12 | Supabase tables vs code usage mismatch | 96 tables but only ~42 used in frontend |

---

## Full Audit Scope

| Layer | Local Count | Deployed | Gap |
|-------|-------------|----------|-----|
| Frontend Files | 310 | - | - |
| Edge Functions | 68 | 111 | **43 ghost functions!** |
| Database Tables | - | 96 | Need usage check |
| Pages in Router | 26 | - | 1 orphan (WorkflowStrategy) |
| Service Integrations | 8+ | - | - |

---

## 50-Agent Parallel Audit Architecture

### PHASE 1: CRITICAL MISMATCH DETECTION (10 agents)

These agents find things **you didn't know were broken**:

#### Group A: Frontend ↔ Backend Mismatch (5 agents - PARALLEL)

| # | Agent | What It Finds |
|---|-------|---------------|
| 1 | `mismatch-functions-called-vs-exist` | Functions called from frontend but don't exist in code |
| 2 | `mismatch-functions-exist-vs-called` | Functions in code but never called (orphans) |
| 3 | `mismatch-tables-used-vs-exist` | Tables used in frontend but may not exist in DB |
| 4 | `mismatch-routes-vs-pages` | Pages that exist but not in router (found: WorkflowStrategy) |
| 5 | `mismatch-deployed-vs-local` | Compare 111 deployed functions vs 68 local |

**Why These Agents?**: These find **hidden breaks** - code that looks fine but is actually disconnected.

#### Group B: Code Quality Red Flags (5 agents - PARALLEL)

| # | Agent | What It Finds |
|---|-------|---------------|
| 6 | `debug-code-detector` | localhost, console.log, debugger statements |
| 7 | `error-swallowing-detector` | Empty catch blocks, unhandled promise rejections |
| 8 | `any-type-detector` | All `any` usages, suggest proper types |
| 9 | `todo-fixme-detector` | Unresolved TODO/FIXME/HACK/XXX comments |
| 10 | `hardcoded-secrets-detector` | Potential secrets, API keys, tokens in code |

**Why These Agents?**: These find **code that will break in production** or hide errors.

---

### PHASE 2: SECURITY AUDIT (10 agents)

#### Group C: Edge Function Security (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 11 | `security-jwt-audit` | All 68 local functions | Missing `verify_jwt` on non-webhooks |
| 12 | `security-webhook-signatures` | 6 webhook functions | Missing Stripe/HubSpot/Facebook signatures |
| 13 | `security-admin-guards` | Utility functions (cleanup, reassign, erase) | Missing role checks |
| 14 | `security-service-role-usage` | All functions | Incorrect ANON vs SERVICE_ROLE usage |
| 15 | `security-env-vars` | All 33 env vars | Unused, missing, or exposed vars |

#### Group D: Database Security (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 16 | `rls-disabled-tables` | All 96 tables | Tables with RLS disabled (found: update_source_log) |
| 17 | `rls-policy-gaps` | Admin tables | Overly permissive policies |
| 18 | `rls-pii-exposure` | contacts, leads, users | PII without proper protection |
| 19 | `storage-policy-audit` | storage.objects | Path-based access issues |
| 20 | `realtime-channel-audit` | 20+ channels found | Unauthorized broadcast access |

---

### PHASE 3: RELIABILITY AUDIT (10 agents)

#### Group E: Background Processing (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 21 | `async-timeout-risks` | Heavy functions (anomaly, BI, data-quality) | Missing waitUntil |
| 22 | `async-agent-loops` | agent-*, ptd-* orchestrators | Potential infinite loops |
| 23 | `async-sync-jobs` | hubspot-sync, facebook-sync | Large data without pagination |
| 24 | `async-queue-check` | sync_queue usage | Missing job queue implementation |
| 25 | `async-promise-handling` | All async code | Unhandled rejections |

#### Group F: Integration Resilience (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 26 | `resilience-hubspot` | All hubspot-* functions | Missing backoff, cursors |
| 27 | `resilience-stripe` | All stripe-* functions | Missing idempotency |
| 28 | `resilience-facebook` | All facebook-* functions | Missing rate limiting |
| 29 | `resilience-callgear` | All callgear-* functions | Missing error recovery |
| 30 | `resilience-supabase` | All DB calls | Missing retry logic |

---

### PHASE 4: DATA INTEGRITY AUDIT (10 agents)

#### Group G: Database Performance (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 31 | `index-high-write-tables` | events, stripe_events, call_records | Missing indexes |
| 32 | `index-join-columns` | FK relationships | Missing FK indexes |
| 33 | `index-query-patterns` | Most queried columns | Missing query indexes |
| 34 | `index-vector-tables` | knowledge_documents, agent_memory | Missing ANN indexes |
| 35 | `index-time-series` | Logs, analytics tables | Missing time-based indexes |

#### Group H: Schema Quality (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 36 | `schema-bad-names` | All tables | "really connection", "table_name" |
| 37 | `schema-orphan-tables` | All 96 tables | Tables never referenced in code |
| 38 | `schema-duplicate-tables` | sync_logs vs sync_log | Overlapping/redundant tables |
| 39 | `schema-constraint-check` | All tables | Missing CHECK constraints |
| 40 | `schema-fk-integrity` | All relationships | Broken or missing FKs |

---

### PHASE 5: FRONTEND CODE AUDIT (10 agents)

#### Group I: Unused Code Detection (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 41 | `unused-components` | src/components/**/*.tsx | Components never imported |
| 42 | `unused-pages` | src/pages/**/*.tsx | Pages not in router (found: WorkflowStrategy) |
| 43 | `unused-hooks` | src/hooks/**/*.ts | Hooks never called |
| 44 | `unused-exports` | All export statements | Exports never imported |
| 45 | `unused-types` | src/types/**/*.ts | Types never referenced |

#### Group J: Flow & Integration (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 46 | `flow-dead-function-calls` | supabase.functions.invoke() | Calls to non-existent functions |
| 47 | `flow-dead-table-queries` | supabase.from() | Queries to non-existent tables |
| 48 | `flow-dead-rpc-calls` | supabase.rpc() | RPC to non-existent procedures |
| 49 | `flow-broken-props` | Component props | Props passed but never used |
| 50 | `flow-state-leaks` | State management | Orphan state, stale queries |

---

## Immediate Fixes Required (Pre-Audit)

### Fix 1: Remove Debug Code from Production
```typescript
// DELETE these lines from src/components/ptd/HealthIntelligenceTab.tsx:45,53,57
fetch('http://127.0.0.1:7242/ingest/...')  // REMOVE
```

### Fix 2: Add Missing Route OR Delete Orphan Page
```typescript
// Option A: Add to src/main.tsx router
{ path: "/workflow-strategy", element: <WorkflowStrategy /> }

// Option B: Delete src/pages/WorkflowStrategy.tsx if unused
```

### Fix 3: Clean Up Ghost Functions on Supabase
```bash
# List deployed functions not in local code
# Then: supabase functions delete <function-name>
```

---

## Environment Variables to Verify (33 found)

All these env vars are used in functions - need to verify they're all set:

```
# AI/ML
ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, GOOGLE_API_KEY
LANGSMITH_API_KEY, LOVABLE_API_KEY

# Integrations
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
HUBSPOT_ACCESS_TOKEN, HUBSPOT_API_KEY
FB_ACCESS_TOKEN, FB_AD_ACCOUNT_ID
CALLGEAR_API_KEY, CALLGEAR_API_URL
STAPE_CAPIG_API_KEY

# Supabase
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# GitHub
GITHUB_TOKEN, GITHUB_REPO

# Phone/Routing
AI_COACH_SIP_URI, BILLING_PHONES, BLACKLISTED_NUMBERS
DEFAULT_ROUTING_PHONES, FAILSAFE_ROUTING_PHONES
OPERATOR_PHONES, SALES_PHONES, SUPPORT_PHONES
SENSITIVE_PHONE_LINES, SUSPICIOUS_PHONE_NUMBERS
VIP_NUMBERS, VIP_ROUTING_PHONES, AUTHORIZED_IP_ADDRESSES

# Alerts
SMS_ALERT_WEBHOOK_URL
```

---

## SDK Version Inconsistency to Fix

Found mixed versions in function imports:
```typescript
// Some use:
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Others use:
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
```

**Fix**: Standardize all to latest version in `_shared/supabase.ts`

---

## Tables Used vs Available (Potential Orphans)

### Tables USED in Frontend Code (42):
```
agent_context, agent_conversations, agent_decisions, agent_memory,
agent_patterns, ai_feedback_learning, app_settings, appointments,
automation_logs, batch_config, batch_jobs, business_calibration,
business_forecasts, business_goals, call_records, capi_events,
capi_events_enriched, client_health_scores, coach_performance,
coach_reviews, contact_activities, contacts, daily_summary, deals,
enhanced_leads, events, facebook_ads_insights, intervention_log,
knowledge_base, kpi_tracking, leads, notifications, prepared_actions,
proactive_insights, reassignment_log, staff, sync_errors, sync_logs,
sync_queue, system_preferences, weekly_patterns
```

### Tables in DB (96) - Need to Find Orphans:
```
Check which of the 96 tables are never referenced in:
- Frontend code
- Edge function code
- RPC functions
- Triggers
```

---

## Realtime Channels Used (20 found)

```
error-monitor-realtime, sync_errors_realtime, sync-status-realtime,
notifications-realtime, insights-realtime, health_scores_changes,
vital-health-scores, vital-deals, vital-interventions, vital-sync-errors,
vital-sync-logs, vital-contacts, vital-calls, vital-daily-summary,
deals-monitor, health-monitor, errors-monitor, calls-realtime,
leads-realtime, deals-realtime
```

**Check**: Are all these channels properly secured with RLS?

---

## Edge Functions: Called vs Existing

### Functions Called from Frontend (37):
```
ai-ceo-master, ai-trigger-deploy, anomaly-detector, auto-reassign-leads,
business-intelligence, capi-validator, churn-predictor, cleanup-fake-contacts,
coach-analyzer, daily-report, data-quality, enrich-with-stripe,
fetch-facebook-insights, fetch-forensic-data, fetch-hubspot-live,
health-calculator, hubspot-command-center, hubspot-live-query,
integration-health, intervention-recommender, marketing-stress-test,
pipeline-monitor, proactive-insights-generator, process-capi-batch,
process-knowledge, ptd-24x7-monitor, ptd-agent-gemini, ptd-self-developer,
ptd-watcher, send-to-stape-capi, stripe-dashboard-data, stripe-forensics,
stripe-payout-controls, stripe-payouts-ai, super-agent-orchestrator,
sync-hubspot-to-capi, sync-hubspot-to-supabase
```

### Functions in Code but NEVER Called from Frontend (31):
```
agent-analyst, agent-orchestrator, ai-deploy-callback, anytrack-webhook,
calendly-webhook, callgear-icp-router, callgear-live-monitor,
callgear-sentinel, callgear-supervisor, fetch-callgear-data,
generate-embeddings, generate-lead-replies, generate-lead-reply,
hubspot-analyzer, hubspot-anytrack-webhook, hubspot-webhook,
openai-embeddings, ptd-agent, ptd-agent-claude, ptd-execute-action,
ptd-proactive-scanner, ptd-self-learn, ptd-ultimate-intelligence,
reassign-owner, smart-agent, smart-coach-analytics, stripe-history,
stripe-webhook, sync-hubspot-data, ultimate-truth-alignment, verify-all-keys
```

**Note**: Some are webhooks (valid), some may be orphans, some called by other functions.

### Functions Deployed on Supabase but NOT in Code (~43):
```
Need to compare Supabase deployment list with local code.
These are "ghost functions" - possibly old deploys never cleaned up.
```

---

## Execution Plan

### Stage 1: Launch All 50 Agents (Parallel)
All agents run simultaneously - no conflicts because:
- Read-only analysis
- Different file/function scopes
- Different pattern detection

### Stage 2: Aggregate Findings
Combine into categorized reports:
- `CRITICAL_FIXES.md` - Must fix before next deploy
- `SECURITY_FIXES.md` - Auth, signatures, RLS
- `RELIABILITY_FIXES.md` - Background jobs, retries
- `DATA_FIXES.md` - Indexes, constraints, migrations
- `CLEANUP.md` - Dead code, orphans to delete

### Stage 3: Generate Patches
For each finding, generate:
- TypeScript code patches
- SQL migrations
- Configuration changes
- Delete recommendations

### Stage 4: Priority Order
1. **CRITICAL**: Debug code, ghost functions, security
2. **HIGH**: Error handling, missing indexes
3. **MEDIUM**: Code quality, dead code cleanup
4. **LOW**: Optimization, refactoring

---

## Deliverables

| Report | Contains |
|--------|----------|
| `CRITICAL_FIXES.md` | Debug code removal, route fixes, ghost cleanup |
| `SECURITY_FIXES.md` | JWT, signatures, RLS, role guards |
| `RELIABILITY_FIXES.md` | Background jobs, rate limiting, retries |
| `DATA_INTEGRITY_FIXES.md` | Indexes, constraints, migrations |
| `UNUSED_CODE_REPORT.md` | Files safe to delete |
| `BROKEN_FLOWS_REPORT.md` | Disconnected function/table calls |
| `MISMATCH_REPORT.md` | Local vs deployed discrepancies |
| `ENV_VARS_AUDIT.md` | Missing, unused, or exposed vars |
| `PRIORITY_ACTION_PLAN.md` | Day-by-day fix schedule |

---

---

## SPECIAL: Orphan Recovery Analysis

**Don't just delete orphans - check if they contain lost logic!**

### For Each Orphan Found, Agents Will Check:

#### 1. Is It Duplicate or Unique Logic?
```
Compare orphan function/component against similar named ones:
- stripe-history vs stripe-dashboard-data → same purpose?
- sync-hubspot-data vs sync-hubspot-to-supabase → overlap?
- generate-lead-reply vs generate-lead-replies → singular vs batch?
```

#### 2. Does It Contain Logic Missing Elsewhere?
```
For each orphan, extract:
- Unique business logic patterns
- Error handling that might be missing in active code
- API calls/integrations not used elsewhere
- Data transformations that might be needed
```

#### 3. Was It Partially Implemented?
```
Check orphan for:
- TODO/FIXME comments indicating unfinished work
- Stubbed functions that should be completed
- Test code that reveals intended functionality
- Comments describing features not yet wired up
```

#### 4. History Check
```
For orphans, check git history:
- When was it last modified?
- Who created it and why?
- Was it ever connected and then disconnected?
- Are there related commits that explain purpose?
```

### Orphan Categories

| Category | Action | Example |
|----------|--------|---------|
| **True Orphan** | Safe to delete | Old experiment, superseded code |
| **Lost Feature** | Recover & wire up | Partially built feature never connected |
| **Duplicate** | Merge best logic | Two functions doing same thing |
| **Webhook/Cron** | Keep - external trigger | Not called from frontend but valid |
| **Internal Call** | Keep - called by other functions | Function A calls Function B |

### Agents for Orphan Recovery (Additional 5)

| # | Agent | Purpose |
|---|-------|---------|
| 51 | `orphan-logic-extractor` | Extract unique logic from orphans before deletion |
| 52 | `orphan-duplicate-finder` | Find duplicates and recommend merge |
| 53 | `orphan-history-checker` | Check git history for context |
| 54 | `orphan-internal-caller` | Check if orphans call each other |
| 55 | `orphan-feature-recovery` | Identify partially built features to complete |

---

## Potential Duplicate Pairs Found (Need Verification)

| Pair | Likely Issue |
|------|--------------|
| `sync-hubspot-data` vs `sync-hubspot-to-supabase` | Same purpose? |
| `generate-lead-reply` vs `generate-lead-replies` | Singular vs batch? |
| `hubspot-webhook` vs `hubspot-anytrack-webhook` | Different sources? |
| `ptd-agent` vs `ptd-agent-claude` vs `ptd-agent-gemini` | Multi-model? |
| `openai-embeddings` vs `generate-embeddings` | Same purpose? |
| `sync_logs` vs `sync_log` (tables) | Typo duplicate? |
| `agent-orchestrator` vs `super-agent-orchestrator` | Evolution? |

### For Each Duplicate Pair, Agent Will:
1. Compare code side-by-side
2. Identify unique logic in each
3. Recommend: merge, keep both, delete one
4. If merge: show combined best-of-both code

---

## Lost Logic Detection

### Signs of Partially Implemented Features:

| Pattern | Meaning |
|---------|---------|
| Function exists but never called | Forgot to wire up |
| Route exists but page not created | Started but didn't finish |
| Page exists but not in router | **FOUND: WorkflowStrategy.tsx** |
| Table exists but never queried | Old feature, schema left behind |
| Component has props never passed | Designed but not integrated |
| Hook defined but never used | Built but forgot to use |

### WorkflowStrategy.tsx Analysis Needed

This orphan page found - agent will check:
1. What feature was this supposed to be?
2. Is there related code that should connect to it?
3. Should we add the route or delete the file?
4. Does it contain unique UI/logic worth keeping?

---

## Why 55 Agents Now?

1. **Complete Coverage**: Every file, function, table examined
2. **Specialized Focus**: Each agent expert in one issue type
3. **No Conflicts**: All read-only, different scopes
4. **Find Hidden Issues**: Mismatch agents catch what you can't see
5. **Prioritized Output**: Issues ranked by severity
6. **Orphan Recovery**: Don't lose valuable logic when cleaning up
7. **Duplicate Merge**: Consolidate scattered implementations
8. **Feature Recovery**: Identify and complete partial features

---

## Approval Required

**This plan will find:**

- [x] Things you didn't know were broken (already found 12!)
- [ ] Ghost/orphan code AND recover lost logic from them
- [ ] Duplicate code AND merge best implementations
- [ ] Lost features AND recommend completion
- [ ] Security vulnerabilities (auth, signatures, RLS)
- [ ] Reliability issues (timeouts, retries, queues)
- [ ] Data integrity problems (indexes, constraints)
- [ ] Code quality issues (types, errors, debug code)
- [ ] Integration mismatches (frontend ↔ backend ↔ DB)

**Ready to launch all 55 agents?**

---

## Quick Reference: Agent Count by Phase

| Phase | Focus | Agent Count |
|-------|-------|-------------|
| Phase 1 | Critical Mismatch Detection | 10 |
| Phase 2 | Security Audit | 10 |
| Phase 3 | Reliability Audit | 10 |
| Phase 4 | Data Integrity Audit | 10 |
| Phase 5 | Frontend Code Audit | 10 |
| Bonus | Orphan Recovery & Feature Detection | 5 |
| **TOTAL** | | **55 agents** |

---

*Plan v3.0 - The Ultimate Audit*
*Pre-discovered: 12 critical issues before even running agents*
*Scope: 310 frontend files + 68 local functions + 111 deployed functions + 96 tables*
*Special: Orphan recovery, duplicate merge, lost feature detection*
