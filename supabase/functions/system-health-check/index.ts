import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FunctionCheck {
  name: string;
  status: "ok" | "error" | "warning" | "not_configured";
  responseTime?: number;
  message?: string;
  requiredSecrets?: string[];
  missingSecrets?: string[];
}

interface SystemHealthReport {
  timestamp: string;
  overall: "healthy" | "degraded" | "critical";
  functions: FunctionCheck[];
  secrets: { configured: string[]; missing: string[] };
  database: { connected: boolean; latency?: number };
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    failed: number;
  };
}

// All edge functions to check
const EDGE_FUNCTIONS = [
  { name: "business-intelligence", secrets: ["GOOGLE_GEMINI_API_KEY"], critical: true },
  { name: "stripe-dashboard-data", secrets: ["STRIPE_SECRET_KEY"], critical: true },
  { name: "stripe-forensics", secrets: ["STRIPE_SECRET_KEY"], critical: true },
  { name: "stripe-payouts-ai", secrets: ["STRIPE_SECRET_KEY", "GOOGLE_GEMINI_API_KEY"], critical: false },
  { name: "stripe-payout-controls", secrets: ["STRIPE_SECRET_KEY"], critical: true },
  { name: "stripe-treasury", secrets: ["STRIPE_SECRET_KEY"], critical: false },
  { name: "hubspot-sync", secrets: ["HUBSPOT_API_KEY"], critical: true },
  { name: "fetch-hubspot-live", secrets: ["HUBSPOT_API_KEY"], critical: true },
  { name: "meta-capi", secrets: ["FB_ACCESS_TOKEN", "FB_PIXEL_ID"], critical: false },
  { name: "daily-summary-briefing", secrets: [], critical: false },
  { name: "ptd-24x7-monitor", secrets: [], critical: true },
  { name: "generate-lead-replies", secrets: ["GOOGLE_GEMINI_API_KEY"], critical: false },
  { name: "run-intelligence-suite", secrets: ["GOOGLE_GEMINI_API_KEY"], critical: false },
  { name: "client-health-calculator", secrets: [], critical: true },
  { name: "coach-performance-report", secrets: [], critical: false },
  { name: "proactive-insights-generator", secrets: ["GOOGLE_GEMINI_API_KEY"], critical: false },
  { name: "smart-agent", secrets: ["GOOGLE_GEMINI_API_KEY"], critical: false },
  { name: "agent-orchestrator", secrets: ["GOOGLE_GEMINI_API_KEY"], critical: false },
];

// Required secrets for full functionality
const ALL_REQUIRED_SECRETS = [
  "STRIPE_SECRET_KEY",
  "HUBSPOT_API_KEY",
  "GOOGLE_GEMINI_API_KEY",
  "FB_ACCESS_TOKEN",
  "FB_PIXEL_ID",
  "LOVABLE_API_KEY",
  "N8N_API_KEY",
  "STAPE_CAPIG_API_KEY",
];

async function checkFunction(
  supabaseUrl: string,
  functionName: string,
  anonKey: string
): Promise<{ status: "ok" | "error"; responseTime: number; message?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(
      `${supabaseUrl}/functions/v1/${functionName}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ healthCheck: true }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    const responseTime = Date.now() - start;
    
    // 200, 400, 401, 403 all mean function is deployed and running
    if (response.status < 500) {
      return { status: "ok", responseTime };
    }
    
    return { 
      status: "error", 
      responseTime,
      message: `HTTP ${response.status}` 
    };
  } catch (error: unknown) {
    return { 
      status: "error", 
      responseTime: Date.now() - start,
      message: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}

function checkSecrets(): { configured: string[]; missing: string[] } {
  const configured: string[] = [];
  const missing: string[] = [];
  
  for (const secret of ALL_REQUIRED_SECRETS) {
    if (Deno.env.get(secret)) {
      configured.push(secret);
    } else {
      missing.push(secret);
    }
  }
  
  return { configured, missing };
}

async function checkDatabase(supabaseUrl: string, serviceKey: string): Promise<{ connected: boolean; latency?: number; tables?: Record<string, number> }> {
  const start = Date.now();
  try {
    const supabase = createClient(supabaseUrl, serviceKey);
    
    const tables = ["client_health_scores", "contacts", "deals", "intervention_log", "agent_memory"];
    const tableCounts: Record<string, number> = {};
    
    for (const table of tables) {
      const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
      if (!error) {
        tableCounts[table] = count ?? 0;
      }
    }
    
    const latency = Date.now() - start;
    return { connected: true, latency, tables: tableCounts };
  } catch {
    return { connected: false };
  }
}

serve(async (req) => {
  // Health check endpoint — public access for monitoring (verify_jwt=false)
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    console.log("[SYSTEM-HEALTH] Starting comprehensive health check...");

    // Check secrets first (fast)
    const secrets = checkSecrets();
    console.log(`[SYSTEM-HEALTH] Secrets: ${secrets.configured.length} configured, ${secrets.missing.length} missing`);

    // Check database
    const database = await checkDatabase(supabaseUrl, supabaseServiceKey);
    console.log(`[SYSTEM-HEALTH] Database: ${database.connected ? "connected" : "disconnected"}`);

    // Check each function (parallel for speed)
    const functionChecks: FunctionCheck[] = [];
    const checkPromises = EDGE_FUNCTIONS.map(async (func) => {
      const missingSecrets = func.secrets.filter(s => !Deno.env.get(s));
      
      if (missingSecrets.length > 0) {
        return {
          name: func.name,
          status: "not_configured" as const,
          requiredSecrets: func.secrets,
          missingSecrets,
          message: `Missing: ${missingSecrets.join(", ")}`,
        };
      }
      
      const result = await checkFunction(supabaseUrl, func.name, supabaseAnonKey);
      return {
        name: func.name,
        status: result.status,
        responseTime: result.responseTime,
        message: result.message,
        requiredSecrets: func.secrets,
      };
    });
    
    const results = await Promise.all(checkPromises);
    functionChecks.push(...results);

    // Calculate summary
    const summary = {
      total: functionChecks.length,
      healthy: functionChecks.filter(f => f.status === "ok").length,
      degraded: functionChecks.filter(f => f.status === "warning" || f.status === "not_configured").length,
      failed: functionChecks.filter(f => f.status === "error").length,
    };

    // Determine overall health
    let overall: "healthy" | "degraded" | "critical" = "healthy";
    const criticalFailed = EDGE_FUNCTIONS
      .filter(f => f.critical)
      .some(f => functionChecks.find(fc => fc.name === f.name)?.status === "error");
    
    if (criticalFailed || !database.connected) {
      overall = "critical";
    } else if (summary.degraded > 0 || summary.failed > 0) {
      overall = "degraded";
    }

    const report: SystemHealthReport = {
      timestamp: new Date().toISOString(),
      overall,
      functions: functionChecks,
      secrets,
      database,
      summary,
    };

    console.log(`[SYSTEM-HEALTH] Complete: ${overall.toUpperCase()} - ${summary.healthy}/${summary.total} functions healthy`);

    return apiSuccess(report);
  } catch (error: unknown) {
    console.error("[SYSTEM-HEALTH] Error:", error);
    return apiError("INTERNAL_ERROR", JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 500);
  }
});
