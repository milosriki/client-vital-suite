# Comprehensive Multi-Agent Code Audit Plan v2.0

## Full Scope Discovery

| Layer | Count | What We Audit |
|-------|-------|---------------|
| Frontend (React/Vite) | 310 files | Unused code, dead components, broken flows |
| Supabase Edge Functions | 111 functions | Security gaps, missing JWT, signature verification |
| Database Tables | 96 tables | RLS policies, missing indexes, orphan tables |
| Service Integrations | 8+ | Stripe, HubSpot, Meta, CallGear, Calendly, AnyTrack |
| Cross-Layer Flows | ~50 flows | Frontend→Function→DB→Webhook chains |

---

## Why This Plan is Better

Based on the Supabase analysis, I've identified these critical gaps:

### Security Gaps Found
- **~60+ functions** have `verify_jwt=false` but should require auth
- **Webhooks** missing signature verification (Stripe, HubSpot, Facebook, Calendly)
- **No idempotency** on event processing → duplicate records
- **Admin utilities** exposed without role checks

### Reliability Gaps Found
- **No background processing** → timeouts on heavy tasks
- **Missing rate limiting** → API storms and 429 errors
- **No cursor persistence** → sync gaps and duplicates
- **No circuit breakers** → cascading failures

### Data Integrity Gaps Found
- **Missing indexes** on high-traffic tables
- **RLS disabled** on some sensitive tables
- **Table naming issues** (spaces in names)
- **Orphan tables** with no references

---

## 45-Agent Parallel Audit Architecture

### PHASE 1: Security Audit (15 agents)

#### Group A: JWT & Auth Verification (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 1 | `auth-webhooks-audit` | 11 webhook functions | Which need signature verification |
| 2 | `auth-admin-audit` | Admin/utility functions (cleanup, reassign, export, erase) | Missing JWT + role guards |
| 3 | `auth-bi-audit` | BI/analytics functions (business-intelligence, pipeline-monitor, etc.) | Exposed data endpoints |
| 4 | `auth-sync-audit` | Sync/fetch functions (hubspot-*, facebook-*, stripe-*) | Missing auth on sensitive syncs |
| 5 | `auth-agent-audit` | AI/agent/orchestrator functions (ptd-*, agent-*, ai-*) | Unprotected automation |

**Expected Output**: List of functions needing `verify_jwt=true` + role checks

#### Group B: Webhook Security (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 6 | `webhook-stripe-audit` | stripe-webhook | Missing signature validation, idempotency |
| 7 | `webhook-hubspot-audit` | hubspot-webhook, hubspot-anytrack-webhook | Missing HMAC, duplicate processing |
| 8 | `webhook-facebook-audit` | facebook-webhook, facebook-lead-webhook | Missing verify_token, appsecret_proof |
| 9 | `webhook-calendly-audit` | calendly-webhook, anytrack-webhook | Missing provider signatures |
| 10 | `webhook-misc-audit` | call-tracking-webhook, system-health-webhook | Missing auth/signatures |

**Expected Output**: Security patches for each webhook

#### Group C: Database Security (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 11 | `rls-public-audit` | All public.* tables | Tables with RLS disabled |
| 12 | `rls-storage-audit` | storage.objects, storage.buckets | Path-based access issues |
| 13 | `rls-realtime-audit` | realtime.messages partitions | Unauthorized broadcast access |
| 14 | `rls-admin-audit` | system_settings, app_settings, business_rules | Overly broad policies |
| 15 | `rls-pii-audit` | contacts, enhanced_leads, facebook_leads | PII exposure risks |

**Expected Output**: RLS policy fixes, table-by-table

---

### PHASE 2: Reliability Audit (10 agents)

#### Group D: Background Processing (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 16 | `async-heavy-audit` | anomaly-detector, data-quality, business-intelligence | Missing waitUntil, timeout risks |
| 17 | `async-agent-audit` | ptd-*, agent-*, proactive-insights-generator | Long-running without backgrounding |
| 18 | `async-sync-audit` | hubspot-sync, facebook-ads-sync, stripe-* fetchers | Large data fetches blocking response |
| 19 | `async-pipeline-audit` | pipeline-monitor, diagnostics-daily, daily-report | Heavy aggregation in foreground |
| 20 | `async-queue-audit` | Check for sync_queue usage | Missing job queue implementation |

**Expected Output**: Functions needing `EdgeRuntime.waitUntil()` + job queue

#### Group E: Rate Limiting & Resilience (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 21 | `ratelimit-hubspot-audit` | All hubspot-* functions | Missing backoff, cursor, pagination |
| 22 | `ratelimit-facebook-audit` | All facebook-* functions | Missing quota headers, retry logic |
| 23 | `ratelimit-stripe-audit` | All stripe-* functions | Missing rate limit handling |
| 24 | `ratelimit-callgear-audit` | All callgear-* functions | Missing backoff on external calls |
| 25 | `circuit-breaker-audit` | All sync/fetch functions | Missing circuit breaker patterns |

**Expected Output**: Retry/backoff implementations needed

---

### PHASE 3: Data Integrity Audit (10 agents)

#### Group F: Database Performance (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 26 | `index-events-audit` | events, stripe_events, attribution_events | Missing indexes on high-write tables |
| 27 | `index-contacts-audit` | contacts, enhanced_leads, hubspot_* | Missing FK/query indexes |
| 28 | `index-calls-audit` | call_records, call_analytics, call_transcription_jobs | Missing tracking indexes |
| 29 | `index-logs-audit` | webhook_logs, sync_logs, edge_function_logs | Missing time-series indexes |
| 30 | `index-vector-audit` | knowledge_documents, agent_memory, knowledge_base | Missing ivfflat/hnsw indexes |

**Expected Output**: CREATE INDEX statements

#### Group G: Schema & Naming (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 31 | `schema-naming-audit` | All 96 tables | Bad names ("really connection", "table_name") |
| 32 | `schema-orphan-audit` | All tables | Tables with no FK references or usage |
| 33 | `schema-duplicate-audit` | sync_logs vs sync_log, etc. | Redundant/overlapping tables |
| 34 | `schema-constraint-audit` | All tables | Missing CHECK constraints, enums |
| 35 | `schema-partition-audit` | realtime.messages_* | Partition maintenance issues |

**Expected Output**: Rename/cleanup migrations

---

### PHASE 4: Frontend Code Audit (10 agents)

#### Group H: Unused Code Detection (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 36 | `unused-components-audit` | src/components/**/*.tsx | Components never imported |
| 37 | `unused-pages-audit` | src/pages/**/*.tsx | Pages not in router |
| 38 | `unused-hooks-audit` | src/hooks/**/*.ts | Hooks never called |
| 39 | `unused-utils-audit` | src/utils/**/*.ts, src/lib/**/*.ts | Utility functions never used |
| 40 | `unused-types-audit` | src/types/**/*.ts | Types/interfaces never referenced |

**Expected Output**: Files safe to delete

#### Group I: Flow & Integration (5 agents - PARALLEL)

| # | Agent | Scope | Finds |
|---|-------|-------|-------|
| 41 | `flow-supabase-audit` | All supabase client calls | Calls to non-existent functions/tables |
| 42 | `flow-routing-audit` | App.tsx, Navigation.tsx | Dead routes, orphan pages |
| 43 | `flow-props-audit` | All component props | Props passed but never used |
| 44 | `flow-state-audit` | useVitalState, tanstack-query | Unused state, stale queries |
| 45 | `flow-error-audit` | try/catch, ErrorBoundary | Unhandled error paths |

**Expected Output**: Broken flow map

---

## Critical Findings to Check

### From Supabase Analysis - MUST FIX:

#### 1. Functions Needing JWT (60+ functions)
```
business-intelligence, pipeline-monitor, data-quality, data-flow-validator,
diagnostics-daily, daily-report, integration-health, smart-coach-analytics,
stripe-dashboard-data, stripe-history, fetch-forensic-data, hubspot-analyzer,
hubspot-live-query, cleanup-fake-contacts, reassign-owner, erase-contact,
export-contact, verify-all-keys, ALL ptd-*, ALL agent-*, ALL ai-*
```

#### 2. Webhooks Needing Signatures
```
stripe-webhook      → Stripe signature header
hubspot-webhook     → X-HubSpot-Signature
facebook-webhook    → verify_token + appsecret_proof
calendly-webhook    → Calendly HMAC
anytrack-webhook    → AnyTrack signature
```

#### 3. Tables Needing RLS
```
update_source_log   → RLS disabled (sensitive!)
system_settings     → Needs admin-only policy
app_settings        → Needs admin-only policy
business_rules      → Needs admin-only policy
```

#### 4. Tables Needing Indexes
```
events(event_time, source, event_id)
stripe_events(processed, created_at, event_id)
call_records(tracking_number_id, started_at)
attribution_events(event_time, event_id)
contacts(owner_id, status, hubspot_contact_id)
```

#### 5. Tables Needing Rename
```
"really connection" → really_connection
"table_name"        → DROP or rename to actual purpose
```

---

## Execution Strategy

### All 45 Agents Run in Parallel Because:

1. **Read-Only Analysis** - No agent modifies anything
2. **Domain Isolation** - Each agent scans different files/functions
3. **Pattern Specialization** - Each looks for different issues
4. **No Dependencies** - Agents don't need each other's results

### Agent Outputs Collected Into:

| Report | Contains |
|--------|----------|
| `SECURITY_FIXES.md` | JWT, signatures, RLS patches |
| `RELIABILITY_FIXES.md` | Background jobs, rate limiting |
| `DATA_INTEGRITY_FIXES.md` | Indexes, constraints, migrations |
| `UNUSED_CODE_REPORT.md` | Files/functions safe to delete |
| `BROKEN_FLOWS_REPORT.md` | Disconnected integrations |

---

## SQL Migrations Needed (Pre-identified)

### 1. User Roles Table
```sql
CREATE TABLE IF NOT EXISTS user_roles (
  user_id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('admin','analyst','operator','viewer'))
);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
```

### 2. Webhook Idempotency Tables
```sql
CREATE TABLE IF NOT EXISTS stripe_events (
  id text PRIMARY KEY,
  type text,
  received_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hubspot_events (
  id text PRIMARY KEY,
  event_type text,
  received_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS facebook_events (
  id text PRIMARY KEY,
  event_type text,
  received_at timestamptz DEFAULT now()
);
```

### 3. Background Job Queue
```sql
CREATE TABLE IF NOT EXISTS sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','retrying')),
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz DEFAULT now(),
  last_error text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status, next_attempt_at);
```

### 4. Integration Cursors
```sql
CREATE TABLE IF NOT EXISTS integration_cursors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  account_id text NOT NULL,
  cursor_key text NOT NULL,
  cursor_value text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (provider, account_id, cursor_key)
);
```

### 5. Missing Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_events_time ON events(event_time);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed ON stripe_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_call_records_tracking ON call_records(tracking_number_id, started_at);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
```

---

## Code Templates Needed

### 1. Admin Guard (for all non-webhook functions)
```typescript
// supabase/functions/_shared/auth.ts
import { createClient } from "npm:@supabase/supabase-js@2";

export async function requireAdmin(req: Request) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");

  if (!token) {
    return { ok: false, res: new Response("Unauthorized", { status: 401 }) };
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { ok: false, res: new Response("Unauthorized", { status: 401 }) };
  }

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!roleRow || roleRow.role !== "admin") {
    return { ok: false, res: new Response("Forbidden", { status: 403 }) };
  }

  return { ok: true, user };
}
```

### 2. Stripe Webhook Signature Verification
```typescript
import Stripe from "npm:stripe";

export async function verifyStripeSignature(req: Request) {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
  const signature = req.headers.get("stripe-signature")!;
  const body = await req.text();

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
    return { ok: true, event };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
```

### 3. Background Job Pattern
```typescript
export async function handleWithBackground(req: Request, heavyWork: () => Promise<void>) {
  const jobId = crypto.randomUUID();

  // Record job start
  const supabase = createServiceClient();
  await supabase.from("sync_queue").insert({
    id: jobId,
    job_type: "heavy_task",
    payload: {},
    status: "running"
  });

  // Run in background
  EdgeRuntime.waitUntil(
    heavyWork()
      .then(() => supabase.from("sync_queue").update({ status: "succeeded" }).eq("id", jobId))
      .catch((e) => supabase.from("sync_queue").update({ status: "failed", last_error: e.message }).eq("id", jobId))
  );

  return new Response(JSON.stringify({ job_id: jobId }), { status: 202 });
}
```

### 4. Rate Limit with Backoff
```typescript
async function withBackoff<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      const delay = Math.min(30000, 500 * 2 ** i) + Math.floor(Math.random() * 250);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Max retries exceeded");
}
```

---

## Approval Checklist

### This plan will find:

- [ ] **Unused frontend code** (components, pages, hooks, types)
- [ ] **Disconnected services** (API calls to nowhere)
- [ ] **Security gaps** (missing JWT, signatures, RLS)
- [ ] **Reliability issues** (no background jobs, rate limits)
- [ ] **Data integrity problems** (missing indexes, bad naming)
- [ ] **Broken flows** (frontend→function→db chains)
- [ ] **Lost logic** (dead code paths, unreachable conditions)
- [ ] **Error handling gaps** (unhandled errors, missing boundaries)

### Deliverables after audit:

1. **SECURITY_FIXES.md** - All auth/signature/RLS patches
2. **RELIABILITY_FIXES.md** - Background job + rate limit implementations
3. **DATA_INTEGRITY_FIXES.md** - Index + migration scripts
4. **UNUSED_CODE_REPORT.md** - Safe-to-delete files
5. **BROKEN_FLOWS_REPORT.md** - Disconnected integration map
6. **PRIORITY_ACTION_PLAN.md** - Day-by-day fix schedule

---

## Ready to Execute?

**Approve to launch all 45 agents in parallel.**

Once approved, I will:
1. Launch all 45 specialized agents simultaneously
2. Each agent scans its domain and reports findings
3. Aggregate all findings into categorized reports
4. Generate SQL migrations and code patches
5. Create prioritized fix schedule

---

*Plan v2.0 - Covers both frontend (310 files) and backend (111 functions + 96 tables)*
*Incorporates all gaps identified in Supabase analysis*
