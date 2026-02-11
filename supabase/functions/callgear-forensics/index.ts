import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { traceStart, traceEnd } from "../_shared/langsmith-tracing.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";

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
  is_lost?: boolean;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
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
    { action, days },
  );

  try {
    const CALLGEAR_API_KEY = Deno.env.get("CALLGEAR_API_KEY");
    if (!CALLGEAR_API_KEY) {
      throw new Error("CALLGEAR_API_KEY is not configured");
    }

    console.log(`[CALLGEAR-FORENSICS] Action: ${action}, Days: ${days}`);

    // Helper to fetch calls from CallGear API
    async function fetchCalls(days: number): Promise<CallGearCall[]> {
      const dateTill = new Date().toISOString().split("T")[0] + " 23:59:59";
      const dateFrom =
        new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0] + " 00:00:00";

      const response = await fetch("https://dataapi.callgear.com/v2.0", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "get.calls_report",
          params: {
            access_token: CALLGEAR_API_KEY,
            date_from: dateFrom,
            date_till: dateTill,
            fields: [
              "id",
              "start_time",
              "talk_duration",
              "finish_reason",
              "direction",
              "is_lost",
              "contact_phone_number",
              "employees",
            ],
          },
          id: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`CallGear API Error: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(JSON.stringify(data.error));

      return (
        data.result?.calls?.map((c: any) => ({
          id: c.id?.toString(),
          start_time: c.start_time,
          duration: c.talk_duration || 0,
          status: c.finish_reason,
          type: c.direction,
          is_lost: c.is_lost === true || c.is_lost === 1,
          contact_number: c.contact_phone_number,
          employee_name: Array.isArray(c.employees)
            ? c.employees[0]?.employee_name
            : c.employees,
        })) || []
      );
    }

    if (action === "analyze-calls") {
      const calls = await fetchCalls(days);
      const anomalies = [];

      const missedCalls = calls.filter((c) => c.is_lost).length;
      const shortCalls = calls.filter(
        (c) => !c.is_lost && c.duration > 0 && c.duration < 10,
      ).length;

      if (missedCalls > calls.length * 0.3) {
        anomalies.push({
          type: "CRITICAL_ABANDONMENT",
          severity: "high",
          message: `Extremely high missed call rate: ${Math.round((missedCalls / calls.length) * 100)}%`,
        });
      }

      if (shortCalls > 5) {
        anomalies.push({
          type: "GHOST_CALL_SIGNATURE",
          severity: "medium",
          message: `${shortCalls} calls under 10 seconds detected (potential "Ghost Protocol").`,
        });
      }

      return apiSuccess({
          success: true,
          anomalies,
          summary: {
            totalCalls: calls.length,
            missedCalls,
            shortCalls,
            avgDuration:
              calls.length > 0
                ? Math.round(
                    calls.reduce((acc, c) => acc + c.duration, 0) /
                      calls.length,
                  )
                : 0,
          },
          timestamp: new Date().toISOString(),
        });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error(`[CALLGEAR-FORENSICS] Error:`, error);
    await traceEnd(traceRun, {}, error.message);
    return handleError(error, "callgear-forensics", {
      supabase,
      errorCode: ErrorCode.EXTERNAL_API_ERROR,
      context: { action, days },
    });
  } finally {
    await traceEnd(traceRun, {});
  }
});
