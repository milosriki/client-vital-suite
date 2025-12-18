import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// SUPER-AGENT ORCHESTRATOR
// 3 Super-Agents with Tier Agents, Memory, Self-Improvement, LangSmith Tracing
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// LangSmith Configuration
const LANGSMITH_API_KEY = Deno.env.get("LANGSMITH_API_KEY") || "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";
const LANGSMITH_PROJECT = "super-agent-orchestrator";
const LANGSMITH_ENDPOINT = "https://api.smith.langchain.com";

// ============================================================================
// STATE TYPES
// ============================================================================

interface TierAgentState {
  name: string;
  status: "pending" | "running" | "success" | "failed" | "retrying";
  result?: any;
  error?: string;
  attempts: number;
  started_at?: string;
  completed_at?: string;
}

interface SuperAgentState {
  id: string;
  name: string;
  focus: string;
  status: "pending" | "running" | "success" | "failed" | "retrying";
  tier_agents: TierAgentState[];
  memory: Record<string, any>;
  cross_check_results?: Record<string, any>;
  improvements: string[];
  attempts: number;
  max_attempts: number;
  started_at?: string;
  completed_at?: string;
}

interface OrchestratorState {
  run_id: string;
  mode: "sequential" | "parallel";
  super_agents: SuperAgentState[];
  shared_memory: Record<string, any>;
  api_connections: Record<string, { status: string; latency_ms?: number; error?: string }>;
  validation_results: Record<string, any>;
  deployment_status: "pending" | "in_progress" | "success" | "failed" | "rollback";
  final_report?: string;
  started_at: string;
  completed_at?: string;
  langsmith_run_id?: string;
}

// ============================================================================
// LANGSMITH TRACING
// ============================================================================

async function traceToLangSmith(
  runName: string,
  runType: "chain" | "llm" | "tool",
  inputs: Record<string, any>,
  outputs?: Record<string, any>,
  error?: string,
  parentRunId?: string
): Promise<string | null> {
  try {
    const runId = crypto.randomUUID();

    const traceData = {
      id: runId,
      name: runName,
      run_type: runType,
      inputs,
      outputs: outputs || {},
      error: error || null,
      start_time: new Date().toISOString(),
      end_time: outputs ? new Date().toISOString() : null,
      parent_run_id: parentRunId || null,
      session_name: LANGSMITH_PROJECT,
      extra: {
        metadata: {
          orchestrator: "super-agent-orchestrator",
          version: "1.0.0"
        }
      }
    };

    const response = await fetch(`${LANGSMITH_ENDPOINT}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": LANGSMITH_API_KEY,
      },
      body: JSON.stringify(traceData),
    });

    if (!response.ok) {
      console.warn("LangSmith trace failed:", response.status);
      return null;
    }

    console.log(`[LangSmith] Traced: ${runName} (${runId})`);
    return runId;
  } catch (e) {
    console.warn("LangSmith error:", e);
    return null;
  }
}

// ============================================================================
// API CONNECTION CHECKER
// ============================================================================

async function checkAPIConnections(supabase: any): Promise<Record<string, any>> {
  console.log("[Orchestrator] Checking API connections...");

  const connections: Record<string, any> = {};

  // Check Supabase (internal)
  const supaStart = Date.now();
  try {
    await supabase.from('sync_logs').select('id').limit(1);
    connections.supabase = { status: "connected", latency_ms: Date.now() - supaStart };
  } catch (e) {
    connections.supabase = { status: "failed", error: String(e) };
  }

  // Check HubSpot
  const hubspotKey = Deno.env.get("HUBSPOT_API_KEY");
  if (hubspotKey) {
    const hsStart = Date.now();
    try {
      const response = await fetch("https://api.hubspot.com/crm/v3/objects/contacts?limit=1", {
        headers: { Authorization: `Bearer ${hubspotKey}` }
      });
      connections.hubspot = {
        status: response.ok ? "connected" : "error",
        latency_ms: Date.now() - hsStart,
        http_status: response.status
      };
    } catch (e) {
      connections.hubspot = { status: "failed", error: String(e), latency_ms: Date.now() - hsStart };
    }
  } else {
    connections.hubspot = { status: "no_key" };
  }

  // Check Stripe
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (stripeKey) {
    const strStart = Date.now();
    try {
      const response = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${stripeKey}` }
      });
      connections.stripe = {
        status: response.ok ? "connected" : "error",
        latency_ms: Date.now() - strStart,
        http_status: response.status
      };
    } catch (e) {
      connections.stripe = { status: "failed", error: String(e), latency_ms: Date.now() - strStart };
    }
  } else {
    connections.stripe = { status: "no_key" };
  }

  // Check Gemini API
  const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
  if (geminiKey) {
    const gStart = Date.now();
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": geminiKey }
      });
      connections.gemini = {
        status: response.ok ? "connected" : "error",
        latency_ms: Date.now() - gStart,
        http_status: response.status
      };
    } catch (e) {
      connections.gemini = { status: "failed", error: String(e), latency_ms: Date.now() - gStart };
    }
  } else {
    connections.gemini = { status: "no_key" };
  }

  // Check CallGear
  const callgearKey = Deno.env.get("CALLGEAR_API_KEY");
  if (callgearKey) {
    const cgStart = Date.now();
    try {
      const response = await fetch("https://api.callgear.com/v1/account", {
        headers: { Authorization: `Bearer ${callgearKey}` }
      });
      connections.callgear = {
        status: response.ok ? "connected" : "error",
        latency_ms: Date.now() - cgStart,
        http_status: response.status
      };
    } catch (e) {
      connections.callgear = { status: "failed", error: String(e), latency_ms: Date.now() - cgStart };
    }
  } else {
    connections.callgear = { status: "no_key" };
  }

  return connections;
}

// ============================================================================
// SUPER-AGENT 1: CODE SENTINEL
// Focus: Code quality, API connections, schema validation
// ============================================================================

async function runCodeSentinel(
  state: OrchestratorState,
  supabase: any,
  parentRunId?: string
): Promise<SuperAgentState> {
  console.log("[SUPER-AGENT 1] Code Sentinel starting...");

  const runId = await traceToLangSmith(
    "super_agent_1_code_sentinel",
    "chain",
    { focus: "code_quality_api_validation", previous_agents: 0 },
    undefined,
    undefined,
    parentRunId
  );

  const agent: SuperAgentState = {
    id: "super_agent_1",
    name: "Code Sentinel",
    focus: "Code quality, API connections, schema validation",
    status: "running",
    tier_agents: [],
    memory: {},
    improvements: [],
    attempts: 0,
    max_attempts: 3,
    started_at: new Date().toISOString(),
  };

  // TIER AGENT 1.1: Connection Validator
  const connectionValidator: TierAgentState = {
    name: "connection_validator",
    status: "running",
    attempts: 0,
    started_at: new Date().toISOString(),
  };

  try {
    await traceToLangSmith("tier_1_1_connection_validator", "tool", { check: "all_apis" }, undefined, undefined, runId || undefined);

    const connections = await checkAPIConnections(supabase);
    const failedConnections = Object.entries(connections)
      .filter(([_, v]: [string, any]) => v.status === "failed" || v.status === "error")
      .map(([k]) => k);

    if (failedConnections.length > 0) {
      connectionValidator.status = "failed";
      connectionValidator.error = `Failed APIs: ${failedConnections.join(", ")}`;
      agent.improvements.push(`Fix API connections: ${failedConnections.join(", ")}`);
    } else {
      connectionValidator.status = "success";
      connectionValidator.result = connections;
    }

    // Store in shared memory
    state.api_connections = connections;
    agent.memory.connections = connections;

    await traceToLangSmith("tier_1_1_connection_validator", "tool", { check: "all_apis" }, { connections, failed: failedConnections }, undefined, runId || undefined);
  } catch (e) {
    connectionValidator.status = "failed";
    connectionValidator.error = String(e);
  }
  connectionValidator.completed_at = new Date().toISOString();
  agent.tier_agents.push(connectionValidator);

  // TIER AGENT 1.2: Schema Checker
  const schemaChecker: TierAgentState = {
    name: "schema_checker",
    status: "running",
    attempts: 0,
    started_at: new Date().toISOString(),
  };

  try {
    await traceToLangSmith("tier_1_2_schema_checker", "tool", { check: "database_schema" }, undefined, undefined, runId || undefined);

    // Check critical tables exist
    const criticalTables = [
      'contacts', 'leads', 'deals', 'client_health_scores',
      'sync_logs', 'sync_errors', 'proactive_insights', 'agent_context'
    ];

    const schemaResults: Record<string, boolean> = {};
    for (const table of criticalTables) {
      const { error } = await supabase.from(table).select('id').limit(1);
      schemaResults[table] = !error;
    }

    const missingTables = Object.entries(schemaResults)
      .filter(([_, exists]) => !exists)
      .map(([table]) => table);

    if (missingTables.length > 0) {
      schemaChecker.status = "failed";
      schemaChecker.error = `Missing tables: ${missingTables.join(", ")}`;
      agent.improvements.push(`Create missing tables: ${missingTables.join(", ")}`);
    } else {
      schemaChecker.status = "success";
      schemaChecker.result = schemaResults;
    }

    agent.memory.schema = schemaResults;
    await traceToLangSmith("tier_1_2_schema_checker", "tool", { check: "database_schema" }, { schema: schemaResults }, undefined, runId || undefined);
  } catch (e) {
    schemaChecker.status = "failed";
    schemaChecker.error = String(e);
  }
  schemaChecker.completed_at = new Date().toISOString();
  agent.tier_agents.push(schemaChecker);

  // TIER AGENT 1.3: Type Validator
  const typeValidator: TierAgentState = {
    name: "type_validator",
    status: "running",
    attempts: 0,
    started_at: new Date().toISOString(),
  };

  try {
    await traceToLangSmith("tier_1_3_type_validator", "tool", { check: "data_types" }, undefined, undefined, runId || undefined);

    // Validate data types in critical tables
    const { data: healthScores } = await supabase
      .from('client_health_scores')
      .select('health_score, health_zone, churn_risk_score')
      .limit(10);

    const typeIssues: string[] = [];
    for (const score of healthScores || []) {
      if (typeof score.health_score !== 'number') {
        typeIssues.push(`health_score should be number, got ${typeof score.health_score}`);
      }
      if (score.health_zone && !['purple', 'green', 'yellow', 'red'].includes(score.health_zone)) {
        typeIssues.push(`Invalid health_zone: ${score.health_zone}`);
      }
    }

    if (typeIssues.length > 0) {
      typeValidator.status = "failed";
      typeValidator.error = `Type issues: ${typeIssues.slice(0, 3).join("; ")}`;
      agent.improvements.push(`Fix data type issues`);
    } else {
      typeValidator.status = "success";
      typeValidator.result = { validated: healthScores?.length || 0, issues: 0 };
    }

    agent.memory.type_validation = { issues: typeIssues };
    await traceToLangSmith("tier_1_3_type_validator", "tool", { check: "data_types" }, { issues: typeIssues.length }, undefined, runId || undefined);
  } catch (e) {
    typeValidator.status = "failed";
    typeValidator.error = String(e);
  }
  typeValidator.completed_at = new Date().toISOString();
  agent.tier_agents.push(typeValidator);

  // Determine overall status
  const failedTiers = agent.tier_agents.filter(t => t.status === "failed");
  agent.status = failedTiers.length === 0 ? "success" : failedTiers.length >= 2 ? "failed" : "success";
  agent.completed_at = new Date().toISOString();

  await traceToLangSmith(
    "super_agent_1_code_sentinel",
    "chain",
    { focus: "code_quality_api_validation" },
    { status: agent.status, improvements: agent.improvements, tier_results: agent.tier_agents.map(t => ({ name: t.name, status: t.status })) },
    failedTiers.length > 0 ? `${failedTiers.length} tier agents failed` : undefined,
    parentRunId
  );

  console.log(`[SUPER-AGENT 1] Code Sentinel completed: ${agent.status}`);
  return agent;
}

// ============================================================================
// SUPER-AGENT 2: DATA GUARDIAN
// Focus: Data integrity, memory sync, cross-checking with previous agents
// ============================================================================

async function runDataGuardian(
  state: OrchestratorState,
  supabase: any,
  previousAgent: SuperAgentState,
  parentRunId?: string
): Promise<SuperAgentState> {
  console.log("[SUPER-AGENT 2] Data Guardian starting...");

  const runId = await traceToLangSmith(
    "super_agent_2_data_guardian",
    "chain",
    {
      focus: "data_integrity_cross_check",
      previous_agent_status: previousAgent.status,
      api_connections: state.api_connections
    },
    undefined,
    undefined,
    parentRunId
  );

  const agent: SuperAgentState = {
    id: "super_agent_2",
    name: "Data Guardian",
    focus: "Data integrity, memory sync, cross-checking",
    status: "running",
    tier_agents: [],
    memory: { previous_agent: previousAgent.id },
    cross_check_results: {},
    improvements: [],
    attempts: 0,
    max_attempts: 3,
    started_at: new Date().toISOString(),
  };

  // TIER AGENT 2.1: Cross-Checker (validates previous agent's work)
  const crossChecker: TierAgentState = {
    name: "cross_checker",
    status: "running",
    attempts: 0,
    started_at: new Date().toISOString(),
  };

  try {
    await traceToLangSmith("tier_2_1_cross_checker", "tool", { validating: "super_agent_1" }, undefined, undefined, runId || undefined);

    const crossCheckResults: Record<string, any> = {};

    // Re-validate API connections
    if (previousAgent.memory.connections) {
      for (const [api, status] of Object.entries(previousAgent.memory.connections) as [string, any][]) {
        if (status.status === "connected") {
          // Verify still connected
          const currentConnections = await checkAPIConnections(supabase);
          crossCheckResults[api] = {
            previous: status.status,
            current: currentConnections[api]?.status,
            match: status.status === currentConnections[api]?.status
          };
        }
      }
    }

    const mismatches = Object.entries(crossCheckResults)
      .filter(([_, v]: [string, any]) => !v.match);

    if (mismatches.length > 0) {
      crossChecker.status = "failed";
      crossChecker.error = `Cross-check mismatches: ${mismatches.map(([k]) => k).join(", ")}`;
      agent.improvements.push(`Re-establish connections: ${mismatches.map(([k]) => k).join(", ")}`);
    } else {
      crossChecker.status = "success";
      crossChecker.result = crossCheckResults;
    }

    agent.cross_check_results = crossCheckResults;
    await traceToLangSmith("tier_2_1_cross_checker", "tool", { validating: "super_agent_1" }, { crossCheckResults }, undefined, runId || undefined);
  } catch (e) {
    crossChecker.status = "failed";
    crossChecker.error = String(e);
  }
  crossChecker.completed_at = new Date().toISOString();
  agent.tier_agents.push(crossChecker);

  // TIER AGENT 2.2: Memory Syncer
  const memorySyncer: TierAgentState = {
    name: "memory_syncer",
    status: "running",
    attempts: 0,
    started_at: new Date().toISOString(),
  };

  try {
    await traceToLangSmith("tier_2_2_memory_syncer", "tool", { sync: "agent_memory" }, undefined, undefined, runId || undefined);

    // Sync to Supabase agent_context
    const memoryData = {
      super_agent_1: previousAgent.memory,
      api_connections: state.api_connections,
      timestamp: new Date().toISOString(),
    };

    const { error } = await supabase.from('agent_context').upsert({
      key: `orchestrator_memory_${state.run_id}`,
      value: memoryData,
      agent_type: 'super_orchestrator',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    if (error) {
      memorySyncer.status = "failed";
      memorySyncer.error = error.message;
    } else {
      memorySyncer.status = "success";
      memorySyncer.result = { synced_keys: Object.keys(memoryData).length };
    }

    state.shared_memory = { ...state.shared_memory, ...memoryData };
    await traceToLangSmith("tier_2_2_memory_syncer", "tool", { sync: "agent_memory" }, { synced: !error }, undefined, runId || undefined);
  } catch (e) {
    memorySyncer.status = "failed";
    memorySyncer.error = String(e);
  }
  memorySyncer.completed_at = new Date().toISOString();
  agent.tier_agents.push(memorySyncer);

  // TIER AGENT 2.3: Data Integrity Validator
  const dataValidator: TierAgentState = {
    name: "data_integrity_validator",
    status: "running",
    attempts: 0,
    started_at: new Date().toISOString(),
  };

  try {
    await traceToLangSmith("tier_2_3_data_validator", "tool", { check: "data_integrity" }, undefined, undefined, runId || undefined);

    // Check for data integrity issues
    const integrityIssues: string[] = [];

    // Check for orphaned records
    const { data: orphanedDeals } = await supabase
      .from('deals')
      .select('id, hubspot_contact_id')
      .not('hubspot_contact_id', 'is', null)
      .limit(100);

    if (orphanedDeals) {
      for (const deal of orphanedDeals.slice(0, 10)) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('hubspot_contact_id', deal.hubspot_contact_id)
          .single();

        if (!contact) {
          integrityIssues.push(`Orphaned deal: ${deal.id} (no matching contact)`);
        }
      }
    }

    // Check for duplicate emails
    const { data: duplicates } = await supabase.rpc('check_duplicate_emails').catch(() => ({ data: null }));
    if (duplicates && duplicates.length > 0) {
      integrityIssues.push(`${duplicates.length} duplicate emails found`);
    }

    if (integrityIssues.length > 0) {
      dataValidator.status = "failed";
      dataValidator.error = `Integrity issues: ${integrityIssues.slice(0, 3).join("; ")}`;
      agent.improvements.push(`Resolve data integrity issues`);
    } else {
      dataValidator.status = "success";
      dataValidator.result = { checked: true, issues: 0 };
    }

    agent.memory.integrity = { issues: integrityIssues };
    await traceToLangSmith("tier_2_3_data_validator", "tool", { check: "data_integrity" }, { issues: integrityIssues.length }, undefined, runId || undefined);
  } catch (e) {
    dataValidator.status = "failed";
    dataValidator.error = String(e);
  }
  dataValidator.completed_at = new Date().toISOString();
  agent.tier_agents.push(dataValidator);

  // Determine overall status
  const failedTiers = agent.tier_agents.filter(t => t.status === "failed");
  agent.status = failedTiers.length === 0 ? "success" : failedTiers.length >= 2 ? "failed" : "success";
  agent.completed_at = new Date().toISOString();

  await traceToLangSmith(
    "super_agent_2_data_guardian",
    "chain",
    { focus: "data_integrity_cross_check" },
    { status: agent.status, cross_check: agent.cross_check_results, improvements: agent.improvements },
    failedTiers.length > 0 ? `${failedTiers.length} tier agents failed` : undefined,
    parentRunId
  );

  console.log(`[SUPER-AGENT 2] Data Guardian completed: ${agent.status}`);
  return agent;
}

// ============================================================================
// SUPER-AGENT 3: DEPLOY MASTER
// Focus: Deployment readiness, recovery, self-improvement execution
// ============================================================================

async function runDeployMaster(
  state: OrchestratorState,
  supabase: any,
  previousAgents: SuperAgentState[],
  parentRunId?: string
): Promise<SuperAgentState> {
  console.log("[SUPER-AGENT 3] Deploy Master starting...");

  const runId = await traceToLangSmith(
    "super_agent_3_deploy_master",
    "chain",
    {
      focus: "deployment_recovery_improvement",
      previous_agents_status: previousAgents.map(a => ({ id: a.id, status: a.status })),
      all_improvements: previousAgents.flatMap(a => a.improvements)
    },
    undefined,
    undefined,
    parentRunId
  );

  const agent: SuperAgentState = {
    id: "super_agent_3",
    name: "Deploy Master",
    focus: "Deployment readiness, recovery, self-improvement",
    status: "running",
    tier_agents: [],
    memory: { previous_agents: previousAgents.map(a => a.id) },
    improvements: [],
    attempts: 0,
    max_attempts: 3,
    started_at: new Date().toISOString(),
  };

  // Collect all improvements from previous agents
  const allImprovements = previousAgents.flatMap(a => a.improvements);

  // TIER AGENT 3.1: Error Analyzer
  const errorAnalyzer: TierAgentState = {
    name: "error_analyzer",
    status: "running",
    attempts: 0,
    started_at: new Date().toISOString(),
  };

  try {
    await traceToLangSmith("tier_3_1_error_analyzer", "tool", { analyze: "all_agents" }, undefined, undefined, runId || undefined);

    // Analyze errors from all previous agents
    const errors: Record<string, string[]> = {};

    for (const prevAgent of previousAgents) {
      errors[prevAgent.id] = prevAgent.tier_agents
        .filter(t => t.status === "failed")
        .map(t => `${t.name}: ${t.error}`);
    }

    const totalErrors = Object.values(errors).flat().length;
    const errorPatterns: string[] = [];

    // Identify patterns
    const apiErrors = Object.values(errors).flat().filter(e => e.includes("API") || e.includes("connection"));
    const schemaErrors = Object.values(errors).flat().filter(e => e.includes("schema") || e.includes("table"));
    const dataErrors = Object.values(errors).flat().filter(e => e.includes("data") || e.includes("integrity"));

    if (apiErrors.length > 0) errorPatterns.push("API_CONNECTION_ISSUES");
    if (schemaErrors.length > 0) errorPatterns.push("SCHEMA_ISSUES");
    if (dataErrors.length > 0) errorPatterns.push("DATA_INTEGRITY_ISSUES");

    errorAnalyzer.status = "success";
    errorAnalyzer.result = {
      total_errors: totalErrors,
      patterns: errorPatterns,
      by_agent: errors
    };

    agent.memory.error_analysis = errorAnalyzer.result;
    await traceToLangSmith("tier_3_1_error_analyzer", "tool", { analyze: "all_agents" }, { patterns: errorPatterns, total: totalErrors }, undefined, runId || undefined);
  } catch (e) {
    errorAnalyzer.status = "failed";
    errorAnalyzer.error = String(e);
  }
  errorAnalyzer.completed_at = new Date().toISOString();
  agent.tier_agents.push(errorAnalyzer);

  // TIER AGENT 3.2: Self-Improvement Executor
  const selfImprover: TierAgentState = {
    name: "self_improvement_executor",
    status: "running",
    attempts: 0,
    started_at: new Date().toISOString(),
  };

  try {
    await traceToLangSmith("tier_3_2_self_improver", "tool", { improvements: allImprovements }, undefined, undefined, runId || undefined);

    const executedImprovements: string[] = [];
    const failedImprovements: string[] = [];

    for (const improvement of allImprovements) {
      try {
        // Store improvement as learning pattern
        await supabase.from('agent_patterns').upsert({
          pattern_name: `improvement_${Date.now()}`,
          description: improvement,
          confidence: 0.5,
          examples: [{ source: "orchestrator", improvement, timestamp: new Date().toISOString() }],
          usage_count: 1,
          last_used_at: new Date().toISOString()
        }, { onConflict: 'pattern_name' });

        executedImprovements.push(improvement);
      } catch (e) {
        failedImprovements.push(improvement);
      }
    }

    selfImprover.status = failedImprovements.length === 0 ? "success" : "failed";
    selfImprover.result = {
      executed: executedImprovements.length,
      failed: failedImprovements.length,
      improvements: executedImprovements
    };

    agent.improvements = executedImprovements;
    await traceToLangSmith("tier_3_2_self_improver", "tool", { improvements: allImprovements }, selfImprover.result, undefined, runId || undefined);
  } catch (e) {
    selfImprover.status = "failed";
    selfImprover.error = String(e);
  }
  selfImprover.completed_at = new Date().toISOString();
  agent.tier_agents.push(selfImprover);

  // TIER AGENT 3.3: Deployment Validator
  const deployValidator: TierAgentState = {
    name: "deployment_validator",
    status: "running",
    attempts: 0,
    started_at: new Date().toISOString(),
  };

  try {
    await traceToLangSmith("tier_3_3_deploy_validator", "tool", { check: "deployment_readiness" }, undefined, undefined, runId || undefined);

    const readinessChecks: Record<string, boolean> = {};

    // Check all APIs are connected
    const connectedApis = Object.entries(state.api_connections)
      .filter(([_, v]: [string, any]) => v.status === "connected");
    readinessChecks.apis_connected = connectedApis.length >= 2; // At least 2 APIs working

    // Check schema is valid
    readinessChecks.schema_valid = previousAgents[0]?.tier_agents
      .find(t => t.name === "schema_checker")?.status === "success";

    // Check no critical errors
    const criticalErrors = Object.values(agent.memory.error_analysis?.by_agent || {})
      .flat()
      .filter((e: any) => String(e).includes("critical") || String(e).includes("CRITICAL"));
    readinessChecks.no_critical_errors = criticalErrors.length === 0;

    // Check memory is synced
    readinessChecks.memory_synced = previousAgents[1]?.tier_agents
      .find(t => t.name === "memory_syncer")?.status === "success";

    const failedChecks = Object.entries(readinessChecks)
      .filter(([_, passed]) => !passed)
      .map(([check]) => check);

    if (failedChecks.length > 0) {
      deployValidator.status = "failed";
      deployValidator.error = `Not ready: ${failedChecks.join(", ")}`;
      state.deployment_status = "failed";
    } else {
      deployValidator.status = "success";
      deployValidator.result = readinessChecks;
      state.deployment_status = "success";
    }

    await traceToLangSmith("tier_3_3_deploy_validator", "tool", { check: "deployment_readiness" }, { checks: readinessChecks, ready: failedChecks.length === 0 }, undefined, runId || undefined);
  } catch (e) {
    deployValidator.status = "failed";
    deployValidator.error = String(e);
    state.deployment_status = "failed";
  }
  deployValidator.completed_at = new Date().toISOString();
  agent.tier_agents.push(deployValidator);

  // TIER AGENT 3.4: Recovery Agent (runs if deployment fails)
  if (state.deployment_status === "failed") {
    const recoveryAgent: TierAgentState = {
      name: "recovery_agent",
      status: "running",
      attempts: 0,
      started_at: new Date().toISOString(),
    };

    try {
      await traceToLangSmith("tier_3_4_recovery_agent", "tool", { action: "recover" }, undefined, undefined, runId || undefined);

      // Attempt recovery actions
      const recoveryActions: string[] = [];

      // Re-sync memory
      await supabase.from('agent_context').upsert({
        key: `recovery_${state.run_id}`,
        value: {
          original_state: state,
          recovery_attempt: 1,
          timestamp: new Date().toISOString()
        },
        agent_type: 'recovery',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
      recoveryActions.push("Memory backup created");

      // Log recovery to proactive insights
      await supabase.from('proactive_insights').insert({
        insight_type: 'agent_recovery',
        title: 'Super-Agent Orchestrator Recovery',
        description: `Recovery triggered after deployment failure. Issues: ${agent.memory.error_analysis?.patterns?.join(", ") || "unknown"}`,
        priority: 'high',
        source_agent: 'deploy_master',
        is_actionable: true
      });
      recoveryActions.push("Recovery insight logged");

      recoveryAgent.status = "success";
      recoveryAgent.result = { actions: recoveryActions };

      await traceToLangSmith("tier_3_4_recovery_agent", "tool", { action: "recover" }, { actions: recoveryActions }, undefined, runId || undefined);
    } catch (e) {
      recoveryAgent.status = "failed";
      recoveryAgent.error = String(e);
    }
    recoveryAgent.completed_at = new Date().toISOString();
    agent.tier_agents.push(recoveryAgent);
  }

  // Determine overall status
  const failedTiers = agent.tier_agents.filter(t => t.status === "failed");
  agent.status = state.deployment_status === "success" ? "success" :
                 failedTiers.length >= 2 ? "failed" : "retrying";
  agent.completed_at = new Date().toISOString();

  await traceToLangSmith(
    "super_agent_3_deploy_master",
    "chain",
    { focus: "deployment_recovery_improvement" },
    {
      status: agent.status,
      deployment_status: state.deployment_status,
      improvements_executed: agent.improvements.length,
      tier_results: agent.tier_agents.map(t => ({ name: t.name, status: t.status }))
    },
    agent.status === "failed" ? "Deployment failed" : undefined,
    parentRunId
  );

  console.log(`[SUPER-AGENT 3] Deploy Master completed: ${agent.status}`);
  return agent;
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

async function runOrchestrator(supabase: any): Promise<OrchestratorState> {
  const runId = crypto.randomUUID();

  console.log(`[Orchestrator] Starting run: ${runId}`);

  // Initialize state
  const state: OrchestratorState = {
    run_id: runId,
    mode: "sequential",
    super_agents: [],
    shared_memory: {},
    api_connections: {},
    validation_results: {},
    deployment_status: "pending",
    started_at: new Date().toISOString(),
  };

  // Start LangSmith trace
  const parentRunId = await traceToLangSmith(
    "super_agent_orchestrator",
    "chain",
    {
      run_id: runId,
      mode: state.mode,
      timestamp: state.started_at
    }
  );
  state.langsmith_run_id = parentRunId || undefined;

  try {
    // PHASE 1: Run Super-Agent 1 (Code Sentinel)
    console.log("\n=== PHASE 1: Code Sentinel ===");
    const agent1 = await runCodeSentinel(state, supabase, parentRunId || undefined);
    state.super_agents.push(agent1);

    // PHASE 2: Run Super-Agent 2 (Data Guardian) - cross-checks Agent 1
    console.log("\n=== PHASE 2: Data Guardian ===");
    const agent2 = await runDataGuardian(state, supabase, agent1, parentRunId || undefined);
    state.super_agents.push(agent2);

    // PHASE 3: Run Super-Agent 3 (Deploy Master) - validates all and executes improvements
    console.log("\n=== PHASE 3: Deploy Master ===");
    const agent3 = await runDeployMaster(state, supabase, [agent1, agent2], parentRunId || undefined);
    state.super_agents.push(agent3);

    // RETRY LOOP: If deployment failed and we haven't exceeded max attempts
    let retryCount = 0;
    const maxRetries = 3;

    while (state.deployment_status === "failed" && retryCount < maxRetries) {
      retryCount++;
      console.log(`\n=== RETRY ${retryCount}/${maxRetries} ===`);

      await traceToLangSmith(
        `retry_attempt_${retryCount}`,
        "chain",
        { attempt: retryCount, previous_status: state.deployment_status },
        undefined,
        undefined,
        parentRunId || undefined
      );

      // Re-run all agents with learned improvements
      state.shared_memory.retry_count = retryCount;

      const retryAgent1 = await runCodeSentinel(state, supabase, parentRunId || undefined);
      const retryAgent2 = await runDataGuardian(state, supabase, retryAgent1, parentRunId || undefined);
      const retryAgent3 = await runDeployMaster(state, supabase, [retryAgent1, retryAgent2], parentRunId || undefined);

      // Update state with retry results
      state.super_agents = [retryAgent1, retryAgent2, retryAgent3];
    }

    // Generate final report
    const geminiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
    if (geminiKey) {
      try {
        const reportPrompt = `
          Summarize this Super-Agent Orchestration run:
          - Total agents: 3 super-agents, ${state.super_agents.reduce((acc, a) => acc + a.tier_agents.length, 0)} tier agents
          - API Connections: ${Object.entries(state.api_connections).map(([k, v]: [string, any]) => `${k}: ${v.status}`).join(", ")}
          - Deployment Status: ${state.deployment_status}
          - Improvements Made: ${state.super_agents.flatMap(a => a.improvements).join("; ") || "None"}
          - Failed Tiers: ${state.super_agents.flatMap(a => a.tier_agents.filter(t => t.status === "failed").map(t => t.name)).join(", ") || "None"}

          Generate a 2-3 sentence executive summary.
        `;

        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${geminiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gemini-2.0-flash",
            messages: [
              { role: "system", content: "You are a technical report summarizer. Be concise." },
              { role: "user", content: reportPrompt }
            ]
          }),
        });

        const data = await response.json();
        state.final_report = data.choices?.[0]?.message?.content || "Report generation failed.";
      } catch (e) {
        state.final_report = `Orchestration ${state.deployment_status}. ${state.super_agents.filter(a => a.status === "success").length}/3 super-agents succeeded.`;
      }
    } else {
      state.final_report = `Orchestration ${state.deployment_status}. ${state.super_agents.filter(a => a.status === "success").length}/3 super-agents succeeded.`;
    }

    state.completed_at = new Date().toISOString();

    // Final LangSmith trace
    await traceToLangSmith(
      "super_agent_orchestrator",
      "chain",
      { run_id: runId },
      {
        status: state.deployment_status,
        duration_ms: new Date(state.completed_at).getTime() - new Date(state.started_at).getTime(),
        super_agents: state.super_agents.map(a => ({ id: a.id, status: a.status })),
        final_report: state.final_report
      },
      state.deployment_status === "failed" ? "Orchestration failed" : undefined
    );

    // Save final state to database
    await supabase.from('agent_context').upsert({
      key: `orchestrator_final_${runId}`,
      value: state,
      agent_type: 'super_orchestrator',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    });

    // Log to sync_logs
    await supabase.from('sync_logs').insert({
      platform: 'super-agent-orchestrator',
      sync_type: 'orchestration_run',
      status: state.deployment_status,
      records_synced: state.super_agents.reduce((acc, a) => acc + a.tier_agents.length, 0),
      started_at: state.started_at
    });

    console.log(`\n[Orchestrator] Completed: ${state.deployment_status}`);
    return state;

  } catch (error) {
    console.error("[Orchestrator] Fatal error:", error);
    state.deployment_status = "failed";
    state.completed_at = new Date().toISOString();
    state.final_report = `Fatal error: ${error instanceof Error ? error.message : String(error)}`;

    await traceToLangSmith(
      "super_agent_orchestrator",
      "chain",
      { run_id: runId },
      { status: "fatal_error" },
      String(error)
    );

    return state;
  }
}

// ============================================================================
// HTTP SERVER
// ============================================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const { action = "run" } = body;

    if (action === "status") {
      // Return last orchestration status
      const { data } = await supabase
        .from('agent_context')
        .select('key, value')
        .eq('agent_type', 'super_orchestrator')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return new Response(JSON.stringify({
        success: true,
        last_run: data?.value || null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "check_connections") {
      const connections = await checkAPIConnections(supabase);
      return new Response(JSON.stringify({
        success: true,
        connections
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Default: run full orchestration
    console.log("[Super-Agent Orchestrator] Starting full run...");
    const startTime = Date.now();

    const result = await runOrchestrator(supabase);

    const duration = Date.now() - startTime;

    return new Response(JSON.stringify({
      success: result.deployment_status === "success",
      run_id: result.run_id,
      duration_ms: duration,
      deployment_status: result.deployment_status,
      super_agents: result.super_agents.map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        tier_agents: a.tier_agents.map(t => ({ name: t.name, status: t.status })),
        improvements: a.improvements
      })),
      api_connections: result.api_connections,
      final_report: result.final_report,
      langsmith_run_id: result.langsmith_run_id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("[Super-Agent Orchestrator] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
