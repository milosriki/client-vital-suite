# Comprehensive Multi-Agent Code Audit Plan

## Executive Summary
This plan orchestrates **45 parallel agents** to perform a complete codebase audit across all domains. Agents are organized into **9 non-conflicting groups** that can run simultaneously without stepping on each other's work.

---

## Codebase Scope
| Category | Count |
|----------|-------|
| TypeScript/TSX Files | 310 |
| Supabase Edge Functions | 70 |
| React Components | ~100 |
| Custom Hooks | 18 |
| Service Integrations | 8+ (Stripe, HubSpot, CallGear, Meta, Calendly, AnyTrack, Supabase, OpenAI) |

---

## Why 45 Agents?

### Reasoning:
1. **Non-Overlapping Domains**: Each agent scans a specific domain/aspect - no conflicts
2. **Parallel Execution**: Agents in the same group don't share file dependencies
3. **Complete Coverage**: Every file, function, hook, type, and service is examined
4. **Specialized Focus**: Each agent has deep expertise in one area (exports, types, hooks, etc.)

### Agent Distribution:
- **Group 1-2**: Frontend Components & Pages (10 agents)
- **Group 3-4**: Supabase Functions (10 agents)
- **Group 5**: Hooks & State Management (5 agents)
- **Group 6**: Types & Interfaces (5 agents)
- **Group 7**: Service Integrations (5 agents)
- **Group 8**: Cross-Cutting Concerns (5 agents)
- **Group 9**: Architecture & Flow (5 agents)

---

## Detailed Agent Plan

### GROUP 1: Frontend Pages Audit (5 agents - PARALLEL)

| Agent # | Name | Scope | What It Finds |
|---------|------|-------|---------------|
| 1 | `pages-dashboard-audit` | Dashboard.tsx, Overview.tsx, Analytics.tsx | Unused imports, dead code paths, unconnected data flows |
| 2 | `pages-ptd-audit` | PTDControl.tsx, all ptd/ components | Disconnected tabs, orphan state, unused handlers |
| 3 | `pages-hubspot-audit` | HubSpotLiveData.tsx, HubSpotAnalyzer.tsx, hubspot/ | Broken API calls, unused data transformations |
| 4 | `pages-sales-audit` | SalesPipeline.tsx, Clients.tsx, Coaches.tsx | Lost business logic, unused filters |
| 5 | `pages-ai-audit` | AIDevConsole.tsx, AIKnowledge.tsx, AILearning.tsx | Orphan AI handlers, unused prompts |

**Why parallel?**: Each agent scans completely different page files - zero overlap.

---

### GROUP 2: Component Library Audit (5 agents - PARALLEL)

| Agent # | Name | Scope | What It Finds |
|---------|------|-------|---------------|
| 6 | `components-ui-audit` | src/components/ui/* | Unused UI primitives, dead variants |
| 7 | `components-dashboard-audit` | src/components/dashboard/* | Orphan dashboard widgets, unused props |
| 8 | `components-charts-audit` | src/components/charts/*, HealthChart.tsx | Disconnected chart configs |
| 9 | `components-ai-audit` | src/components/ai/* (PTDControlChat, VoiceChat) | Dead AI component branches |
| 10 | `components-misc-audit` | Remaining: Navigation, Layout, ErrorBoundary, etc. | Unused utility components |

**Why parallel?**: Each agent handles distinct component directories.

---

### GROUP 3: Supabase Functions - Core Services (5 agents - PARALLEL)

| Agent # | Name | Scope | What It Finds |
|---------|------|-------|---------------|
| 11 | `functions-stripe-audit` | stripe-*, enrich-with-stripe | Dead Stripe handlers, unused webhook paths |
| 12 | `functions-hubspot-audit` | hubspot-*, sync-hubspot-* | Orphan HubSpot sync logic |
| 13 | `functions-callgear-audit` | callgear-*, fetch-callgear-data | Disconnected call tracking |
| 14 | `functions-capi-audit` | capi-*, send-to-stape-capi, process-capi-batch | Lost CAPI event flows |
| 15 | `functions-ai-agents-audit` | ai-ceo-master, agent-*, smart-agent | Dead AI orchestration paths |

**Why parallel?**: Each agent scans a distinct service domain.

---

### GROUP 4: Supabase Functions - Specialized (5 agents - PARALLEL)

| Agent # | Name | Scope | What It Finds |
|---------|------|-------|---------------|
| 16 | `functions-ptd-audit` | ptd-* (7 functions) | Disconnected PTD agent logic |
| 17 | `functions-health-audit` | health-calculator, integration-health, anomaly-detector | Orphan health checks |
| 18 | `functions-webhooks-audit` | *-webhook (5 functions) | Dead webhook handlers |
| 19 | `functions-analytics-audit` | business-intelligence, daily-report, coach-analyzer | Unused analytics pipelines |
| 20 | `functions-data-audit` | data-quality, cleanup-*, generate-* | Lost data processing |

**Why parallel?**: Distinct function categories with no shared code.

---

### GROUP 5: Hooks & State Management (5 agents - PARALLEL)

| Agent # | Name | Scope | What It Finds |
|---------|------|-------|---------------|
| 21 | `hooks-data-audit` | useDashboardData, useDashboardFeatures, useVitalState | Unused data hooks, dead subscriptions |
| 22 | `hooks-realtime-audit` | useRealtimeHealthScores, useConnectionStatus | Disconnected realtime handlers |
| 23 | `hooks-ui-audit` | use-toast, use-mobile, useKeyboardShortcuts | Unused UI hooks |
| 24 | `hooks-integration-audit` | useSuperAgentOrchestrator, useSyncLock | Orphan integration logic |
| 25 | `hooks-currency-audit` | useCurrency, useNotifications, useLatestCalculationDate | Lost utility hooks |

**Why parallel?**: Each hook is independent - no dependency conflicts.

---

### GROUP 6: Types & Interfaces (5 agents - PARALLEL)

| Agent # | Name | Scope | What It Finds |
|---------|------|-------|---------------|
| 26 | `types-core-audit` | src/types/*.ts - main types | Unused type definitions |
| 27 | `types-supabase-audit` | src/integrations/supabase/types.ts | Dead database types |
| 28 | `types-inline-audit` | Inline types across all files | Orphan inline interfaces |
| 29 | `types-props-audit` | Component prop types | Unused prop definitions |
| 30 | `types-api-audit` | API response/request types | Disconnected API contracts |

**Why parallel?**: Type scanning is read-only analysis.

---

### GROUP 7: Service Integration Audit (5 agents - PARALLEL)

| Agent # | Name | Scope | What It Finds |
|---------|------|-------|---------------|
| 31 | `integration-stripe-flow` | All Stripe touchpoints (frontend→function→webhook) | Broken Stripe flows |
| 32 | `integration-hubspot-flow` | All HubSpot touchpoints | Dead HubSpot connections |
| 33 | `integration-supabase-flow` | Supabase client usage, RPC calls | Orphan database calls |
| 34 | `integration-meta-flow` | Facebook/Meta CAPI, ads tracking | Lost ad tracking |
| 35 | `integration-external-flow` | CallGear, Calendly, AnyTrack | Dead external webhooks |

**Why parallel?**: Each traces a distinct service's complete flow.

---

### GROUP 8: Cross-Cutting Concerns (5 agents - PARALLEL)

| Agent # | Name | Scope | What It Finds |
|---------|------|-------|---------------|
| 36 | `exports-audit` | All export statements | Unused exports across all files |
| 37 | `imports-audit` | All import statements | Unused imports, circular deps |
| 38 | `error-handling-audit` | try/catch, error boundaries, error states | Unhandled error paths |
| 39 | `async-audit` | async/await, promises, subscriptions | Dangling promises, lost async flows |
| 40 | `config-audit` | Config files, env usage, constants | Dead configuration |

**Why parallel?**: Each analyzes a different code pattern.

---

### GROUP 9: Architecture & Flow Analysis (5 agents - PARALLEL)

| Agent # | Name | Scope | What It Finds |
|---------|------|-------|---------------|
| 41 | `routing-flow-audit` | App.tsx, router config, page connections | Dead routes, orphan pages |
| 42 | `data-flow-audit` | Props drilling, context usage, query flows | Broken data pipelines |
| 43 | `event-flow-audit` | Event handlers, callbacks, subscriptions | Disconnected event chains |
| 44 | `api-flow-audit` | API calls, RPC, fetch patterns | Dead API endpoints |
| 45 | `state-flow-audit` | State management, tanstack-query, realtime | Lost state updates |

**Why parallel?**: Each analyzes a different architectural dimension.

---

## Execution Strategy

### Phase 1: Launch All 45 Agents (Parallel)
All agents run simultaneously because:
- They scan **different file sets** (no write conflicts)
- They analyze **different patterns** (exports vs imports vs types)
- They trace **different flows** (Stripe vs HubSpot vs Supabase)

### Phase 2: Aggregate Results
Combine findings into categories:
1. **UNUSED_CODE**: Functions, components, types never imported
2. **DISCONNECTED_SERVICES**: API calls with no handler, webhooks with no consumer
3. **ERRORS**: Unhandled error paths, missing error boundaries
4. **LOST_LOGIC**: Dead code branches, unreachable conditions
5. **FLOW_BREAKS**: Broken data pipelines, orphan state

### Phase 3: Generate Fix Report
Prioritized list of issues with:
- File location
- Line numbers
- Severity (Critical/High/Medium/Low)
- Recommended fix

---

## Expected Findings

Based on codebase structure, likely issues:

| Category | Expected Count | Examples |
|----------|---------------|----------|
| Unused Exports | 50-100 | Functions defined but never imported |
| Dead Components | 10-20 | Components not rendered anywhere |
| Orphan Types | 20-40 | Interfaces defined but unused |
| Broken Flows | 5-15 | API calls to non-existent endpoints |
| Lost Hooks | 5-10 | Hooks defined but never called |
| Dead Functions | 30-50 | Supabase functions with no trigger |

---

## Why This Works Without Conflicts

1. **File-Level Isolation**: Agents in same group scan different directories
2. **Read-Only Analysis**: No agent modifies code - all are scanning
3. **Pattern Specialization**: Each agent looks for different code patterns
4. **Service Boundaries**: Integration agents follow distinct API flows

---

## Approval Required

**Do you approve this 45-agent parallel audit plan?**

Once approved, I will:
1. Launch all 45 agents simultaneously
2. Collect their findings
3. Generate a consolidated audit report
4. Prioritize fixes by severity

---

*Plan generated for: client-vital-suite*
*Files to scan: 310 TypeScript/TSX + 70 Supabase functions*
*Estimated coverage: 100% of codebase*
