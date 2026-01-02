import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { traceStart, traceEnd } from "../_shared/langsmith-tracing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CallGearCall {
  id: string;
  start_time: string;
  duration: number;
  status: string;
  type: string;
  employee_name?: string;
  virtual_number?: string;
  contact_number?: string;
  recording_url?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { action = "analyze-calls", days = 30 } = body;

  const traceRun = await traceStart(
    {
      name: `callgear-forensics:${action}`,
      runType: "chain",
      metadata: { action, days },
      tags: ["callgear", "forensics", action],
    },
    { action, days }
  );

  try {
    const CALLGEAR_API_KEY = Deno.env.get("CALLGEAR_API_KEY");
    if (!CALLGEAR_API_KEY) {
      throw new Error("CALLGEAR_API_KEY is not configured");
    }

    console.log(`[CALLGEAR-FORENSICS] Action: ${action}, Days: ${days}`);

    // Helper to fetch calls from CallGear API
    async function fetchCalls(days: number): Promise<CallGearCall[]> {
        // Placeholder for actual API call
        // In a real implementation, this would query CallGear's API
        // For now, we'll return mock data or an empty array if no API key
        // derived from existing callgear functions logic
        return []; 
    }

    if (action === "health-check") {
         return new Response(
            JSON.stringify({
              ok: true,
              timestamp: new Date().toISOString(),
              message: "CallGear Forensics Ready"
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
    }

    if (action === "analyze-calls") {
        // 1. Fetch calls
        // const calls = await fetchCalls(days);
        
        // 2. Analyze for anomalies (e.g., short calls, missed calls, high volume)
        const anomalies = [];
        
        // Mock anomaly for demonstration
        // anomalies.push({ type: "HIGH_MISSED_CALL_RATE", severity: "medium", message: "High rate of missed calls detected." });

        return new Response(
            JSON.stringify({
              anomalies,
              summary: {
                  totalCalls: 0,
                  missedCalls: 0,
                  avgDuration: 0
              },
              timestamp: new Date().toISOString()
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error(`[CALLGEAR-FORENSICS] Error:`, error);
    await traceEnd(traceRun, { error: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
      await traceEnd(traceRun);
  }
});
