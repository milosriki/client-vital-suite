# Super-Agent Orchestrator

A hierarchical 3-super-agent system with tier agents for self-coding, validation, and deployment with LangSmith tracing.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SUPER-AGENT ORCHESTRATOR                               │
│                                                                                  │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐        │
│  │  SUPER-AGENT 1     │  │  SUPER-AGENT 2     │  │  SUPER-AGENT 3     │        │
│  │  "Code Sentinel"   │──▶│  "Data Guardian"  │──▶│  "Deploy Master"  │        │
│  │                    │  │                    │  │                    │        │
│  │  ┌──────────────┐  │  │  ┌──────────────┐  │  │  ┌──────────────┐  │        │
│  │  │ Connection   │  │  │  │ Cross-       │  │  │  │ Error        │  │        │
│  │  │ Validator    │  │  │  │ Checker      │  │  │  │ Analyzer     │  │        │
│  │  └──────────────┘  │  │  └──────────────┘  │  │  └──────────────┘  │        │
│  │  ┌──────────────┐  │  │  ┌──────────────┐  │  │  ┌──────────────┐  │        │
│  │  │ Schema       │  │  │  │ Memory       │  │  │  │ Self-        │  │        │
│  │  │ Checker      │  │  │  │ Syncer       │  │  │  │ Improver     │  │        │
│  │  └──────────────┘  │  │  └──────────────┘  │  │  └──────────────┘  │        │
│  │  ┌──────────────┐  │  │  ┌──────────────┐  │  │  ┌──────────────┐  │        │
│  │  │ Type         │  │  │  │ Data         │  │  │  │ Deployment   │  │        │
│  │  │ Validator    │  │  │  │ Validator    │  │  │  │ Validator    │  │        │
│  │  └──────────────┘  │  │  └──────────────┘  │  │  └──────────────┘  │        │
│  │                    │  │                    │  │  ┌──────────────┐  │        │
│  │                    │  │                    │  │  │ Recovery     │  │        │
│  │                    │  │                    │  │  │ Agent        │  │        │
│  └────────────────────┘  └────────────────────┘  │  └──────────────┘  │        │
│                                                   └────────────────────┘        │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           SHARED MEMORY (Supabase)                       │   │
│  │  • agent_context    • agent_patterns    • sync_logs    • proactive_insights│   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         LANGSMITH TRACING                                │   │
│  │  • Run traces    • Error tracking    • Performance metrics               │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Super-Agent Roles

### Super-Agent 1: Code Sentinel
**Focus:** Code quality, API connections, schema validation

**Tier Agents:**
1. `connection_validator` - Checks all API connections (HubSpot, Stripe, Gemini, CallGear)
2. `schema_checker` - Validates database schema and critical tables
3. `type_validator` - Validates data types in critical fields

**Memory Output:** API connection status, schema validation results, type issues

### Super-Agent 2: Data Guardian
**Focus:** Data integrity, memory sync, cross-checking previous agents

**Tier Agents:**
1. `cross_checker` - Validates Super-Agent 1's findings by re-checking
2. `memory_syncer` - Syncs all agent memory to Supabase
3. `data_integrity_validator` - Checks for orphaned records, duplicates

**Memory Output:** Cross-check results, synced memory keys, integrity issues

### Super-Agent 3: Deploy Master
**Focus:** Deployment readiness, error analysis, self-improvement, recovery

**Tier Agents:**
1. `error_analyzer` - Analyzes errors from all previous agents
2. `self_improvement_executor` - Executes improvements and logs patterns
3. `deployment_validator` - Final deployment readiness check
4. `recovery_agent` - Runs if deployment fails, creates backups

**Memory Output:** Error patterns, executed improvements, deployment status

## Key Features

### Sequential Execution with Cross-Checking
Each super-agent runs sequentially, with each subsequent agent validating the previous agent's work:

```
Agent 1 → validates → Schema, APIs, Types
Agent 2 → cross-checks → Agent 1's findings, syncs memory
Agent 3 → validates all → deployment readiness, triggers recovery if needed
```

### Self-Improvement Loop
When deployment fails:
1. Error patterns are analyzed
2. Improvements are logged to `agent_patterns`
3. All agents re-run with new context
4. Up to 3 retry attempts

### LangSmith Tracing
Every agent and tier-agent run is traced to LangSmith:
- Run IDs for debugging
- Performance metrics
- Error tracking
- Parent-child relationships

## API Endpoints

### Run Full Orchestration
```bash
POST /super-agent-orchestrator
{
  "action": "run"
}
```

**Response:**
```json
{
  "success": true,
  "run_id": "uuid",
  "duration_ms": 5234,
  "deployment_status": "success",
  "super_agents": [
    {
      "id": "super_agent_1",
      "name": "Code Sentinel",
      "status": "success",
      "tier_agents": [
        { "name": "connection_validator", "status": "success" },
        { "name": "schema_checker", "status": "success" },
        { "name": "type_validator", "status": "success" }
      ],
      "improvements": []
    }
    // ... more agents
  ],
  "api_connections": {
    "supabase": { "status": "connected", "latency_ms": 45 },
    "hubspot": { "status": "connected", "latency_ms": 234 },
    "stripe": { "status": "connected", "latency_ms": 189 },
    "gemini": { "status": "connected", "latency_ms": 123 }
  },
  "final_report": "Orchestration successful. All 3 super-agents completed. 10 tier agents executed.",
  "langsmith_run_id": "run-uuid"
}
```

### Check Connections Only
```bash
POST /super-agent-orchestrator
{
  "action": "check_connections"
}
```

### Get Last Run Status
```bash
POST /super-agent-orchestrator
{
  "action": "status"
}
```

## Frontend Integration

Use the `useSuperAgentOrchestrator` hook:

```tsx
import { useSuperAgentOrchestrator } from "@/hooks/useSuperAgentOrchestrator";

function OrchestratorPanel() {
  const {
    isLoading,
    error,
    result,
    runOrchestration,
    checkConnections,
    getSummaryStats
  } = useSuperAgentOrchestrator();

  const handleRun = async () => {
    const result = await runOrchestration();
    console.log("Orchestration complete:", result);
  };

  const stats = getSummaryStats();

  return (
    <div>
      <button onClick={handleRun} disabled={isLoading}>
        {isLoading ? "Running..." : "Run Orchestration"}
      </button>

      {result && (
        <div>
          <p>Status: {result.deployment_status}</p>
          <p>Duration: {stats?.durationSeconds}s</p>
          <p>Successful Tiers: {stats?.successfulTiers}/{stats?.totalTierAgents}</p>
          <p>Connected APIs: {stats?.connectedApis}/{stats?.totalApis}</p>
        </div>
      )}
    </div>
  );
}
```

## Configuration

### Environment Variables
```bash
# LangSmith (required for tracing)
LANGSMITH_API_KEY=lsv2_sk_...

# API Keys for connection checking
HUBSPOT_API_KEY=...
STRIPE_SECRET_KEY=...
GEMINI_API_KEY=...
CALLGEAR_API_KEY=...
```

### Supabase Tables Required
- `agent_context` - Agent memory storage
- `agent_patterns` - Self-improvement patterns
- `sync_logs` - Orchestration run logs
- `proactive_insights` - Recovery alerts
- `contacts`, `leads`, `deals`, `client_health_scores` - Data validation

## Deployment

Deploy the Edge Function:
```bash
supabase functions deploy super-agent-orchestrator --no-verify-jwt
```

Set secrets:
```bash
supabase secrets set LANGSMITH_API_KEY=lsv2_sk_...
```

## Monitoring

View runs in LangSmith:
1. Go to https://smith.langchain.com
2. Navigate to project "super-agent-orchestrator"
3. View traces, errors, and performance metrics

View in Supabase:
```sql
-- Last orchestration runs
SELECT * FROM sync_logs
WHERE platform = 'super-agent-orchestrator'
ORDER BY started_at DESC LIMIT 10;

-- Agent memory
SELECT * FROM agent_context
WHERE agent_type = 'super_orchestrator'
ORDER BY created_at DESC;

-- Self-improvement patterns
SELECT * FROM agent_patterns
WHERE pattern_name LIKE 'improvement_%'
ORDER BY last_used_at DESC;
```

## Error Recovery

The system includes automatic recovery:

1. **Tier Agent Failure** - Other tiers continue, status logged
2. **Super-Agent Failure** - Next agent sees failure, adjusts strategy
3. **Deployment Failure** - Recovery agent creates backup, logs insight
4. **Full Retry** - If deployment fails, entire flow retries (max 3x)

Each retry learns from previous failures via the `agent_patterns` table.
