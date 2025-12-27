# 🤖 CLAUDE AGENT EXECUTION PLAN
## PTD Client-Vital-Suite Full Tracing Implementation

**Status:** PRs #92, #91, #93 MERGED ✅
**Date:** 2025-12-27
**Functions to instrument:** 90

---

## WAVE 1: Foundation (CURRENT)

### Task 1.1: Create observability.ts wrapper
```typescript
// supabase/functions/_shared/observability.ts
// Unified wrapper combining langsmith-tracing.ts with:
// - Correlation ID propagation
// - Cost tracking
// - Structured logging
// - Easy withTracing() wrapper
```

### Task 1.2: Create SQL migration
```sql
-- supabase/migrations/20251227_ai_execution_metrics.sql
CREATE TABLE ai_execution_metrics (...)
```

---

## WAVE 2: Critical Path Instrumentation

### Agent 2A: AI Agents (5 functions)
- [ ] smart-agent/index.ts
- [ ] agent-orchestrator/index.ts
- [ ] ptd-agent-claude/index.ts
- [ ] ptd-agent-gemini/index.ts
- [ ] ai-ceo-master/index.ts

### Agent 2B: Stripe Functions (5 functions)
- [x] stripe-enterprise-intelligence (✅ has tracing from PR#92)
- [x] stripe-forensics (✅ has tracing)
- [x] stripe-payouts-ai (✅ has tracing)
- [ ] stripe-webhook/index.ts
- [ ] enrich-with-stripe/index.ts

### Agent 2C: HubSpot + Health (5 functions)
- [ ] hubspot-sync-manager/index.ts
- [ ] hubspot-webhook/index.ts
- [ ] calculate-health-scores/index.ts
- [ ] churn-predictor/index.ts
- [ ] intervention-recommender/index.ts

---

## WAVE 3: Bulk Instrumentation (85 remaining functions)

### Pattern to apply:
```typescript
import { traceStart, traceEnd, isTracingEnabled } from "../_shared/langsmith-tracing.ts";

Deno.serve(async (req) => {
  const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();
  const runId = isTracingEnabled() 
    ? await traceStart({ name: "FUNCTION_NAME" }, { correlationId })
    : null;
  
  try {
    // existing logic
    const result = await handleRequest(req);
    
    if (runId) await traceEnd(runId, { success: true, result });
    return result;
  } catch (error) {
    if (runId) await traceEnd(runId, { success: false }, error.message);
    throw error;
  }
});
```

---

## WAVE 4: Frontend + Dashboard

### Task 4.1: Frontend correlation IDs
- Add X-Correlation-ID to all Supabase function calls
- Store correlation ID in session

### Task 4.2: Observability Dashboard
- Create /observability page
- Show metrics from ai_execution_metrics table

---

## EXECUTION LOG

| Time | Action | Status |
|------|--------|--------|
| 07:30 | Merged PR #92 | ✅ |
| 07:30 | Merged PR #91 | ✅ |
| 07:31 | Merged PR #93 | ✅ |
| 07:32 | Starting Wave 1 | 🔄 |

