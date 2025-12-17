// CallGear Live Monitor - Real-time call monitoring Edge Function
// Implements Supervisor Workplace functionality using CallGear's list.calls API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORRECT CallGear API URLs:
// - Data API: https://dataapi.callgear.com/v2.0 (JSON-RPC for reports)
// - Call API: https://callapi.callgear.com/v4.0 (REST for call management)
const CALLGEAR_API_URL = Deno.env.get("CALLGEAR_API_URL") || "https://dataapi.callgear.com/v2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params: Record<string, any>;
  id: number;
}

interface JsonRpcResponse {
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

interface ActiveCall {
  call_id: string;
  state: string; // ringing, talking, hold
  caller: string;
  agent: string;
  duration: number;
  started_at: string;
}

interface EmployeeStatus {
  employee_id: string;
  name: string;
  status: string; // online, offline, busy
  active_calls: number;
}

interface QueueStats {
  calls_waiting: number;
  average_wait_time: number;
  agents_available: number;
  total_agents: number;
}

async function makeCallGearRequest(
  apiKey: string,
  method: string,
  params: Record<string, any> = {}
): Promise<JsonRpcResponse> {
  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    method,
    params: {
      access_token: apiKey,  // CORRECT: use access_token not auth_token
      ...params,
    },
    id: Date.now(),
  };

  const response = await fetch(CALLGEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`CallGear API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function listActiveCalls(apiKey: string): Promise<ActiveCall[]> {
  // Use get.calls_report with filter for recent calls
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);
  
  const response = await makeCallGearRequest(apiKey, "get.calls_report", {
    date_from: oneHourAgo.toISOString().replace('T', ' ').slice(0, 19),
    date_till: now.toISOString().replace('T', ' ').slice(0, 19),
    limit: 100
  });

  if (response.error) {
    throw new Error(`CallGear API error: ${response.error.message}`);
  }

  const calls = response.result?.calls || [];

  return calls.map((call: any) => ({
    call_id: call.id || call.call_id || "unknown",
    state: call.state || call.status || "unknown",
    caller: call.caller_number || call.from || "unknown",
    agent: call.employee_name || call.employee || call.agent || "unassigned",
    duration: call.duration || 0,
    started_at: call.start_time || call.created_at || new Date().toISOString(),
  }));
}

async function getEmployeeStatus(apiKey: string): Promise<EmployeeStatus[]> {
  // First, get active calls to determine who's busy
  const activeCalls = await listActiveCalls(apiKey);

  // Get employee list
  const employeeResponse = await makeCallGearRequest(apiKey, "list.employees", {});

  if (employeeResponse.error) {
    throw new Error(`CallGear API error: ${employeeResponse.error.message}`);
  }

  const employees = employeeResponse.result?.employees || [];

  // Count active calls per employee
  const employeeCallCounts = new Map<string, number>();
  activeCalls.forEach((call) => {
    const agent = call.agent;
    if (agent && agent !== "unassigned") {
      employeeCallCounts.set(agent, (employeeCallCounts.get(agent) || 0) + 1);
    }
  });

  return employees.map((emp: any) => {
    const activeCallCount = employeeCallCounts.get(emp.name || emp.id) || 0;
    let status = "offline";

    if (emp.online || emp.is_online) {
      status = activeCallCount > 0 ? "busy" : "online";
    }

    return {
      employee_id: emp.id || emp.employee_id || "unknown",
      name: emp.name || emp.full_name || "Unknown Employee",
      status,
      active_calls: activeCallCount,
    };
  });
}

async function getQueueStats(apiKey: string): Promise<QueueStats> {
  // Get all active calls
  const allCallsResponse = await makeCallGearRequest(apiKey, "list.calls", {
    status: "active",
  });

  if (allCallsResponse.error) {
    throw new Error(`CallGear API error: ${allCallsResponse.error.message}`);
  }

  const calls = allCallsResponse.result?.calls || [];

  // Get employee status to count available agents
  const employees = await getEmployeeStatus(apiKey);
  const agentsAvailable = employees.filter((emp) => emp.status === "online").length;
  const totalAgents = employees.length;

  // Filter calls that are waiting (ringing state, not yet answered)
  const waitingCalls = calls.filter(
    (call: any) => call.state === "ringing" || call.status === "waiting" || call.status === "queued"
  );

  const callsWaiting = waitingCalls.length;

  // Calculate average wait time for waiting calls
  let totalWaitTime = 0;
  waitingCalls.forEach((call: any) => {
    const duration = call.duration || call.wait_time || 0;
    totalWaitTime += duration;
  });

  const averageWaitTime = callsWaiting > 0 ? Math.round(totalWaitTime / callsWaiting) : 0;

  return {
    calls_waiting: callsWaiting,
    average_wait_time: averageWaitTime,
    agents_available: agentsAvailable,
    total_agents: totalAgents,
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get API key from environment
    const apiKey = Deno.env.get("CALLGEAR_API_KEY");
    if (!apiKey) {
      throw new Error("CALLGEAR_API_KEY environment variable is not set");
    }

    // Parse request body
    const { action, params = {} } = await req.json();

    if (!action) {
      return new Response(
        JSON.stringify({
          error: "Missing 'action' parameter. Valid actions: list_active_calls, get_employee_status, get_queue_stats",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let result: any;

    switch (action) {
      case "list_active_calls": {
        const calls = await listActiveCalls(apiKey);
        result = {
          calls,
          summary: {
            total_active: calls.length,
            ringing: calls.filter((c) => c.state === "ringing").length,
            talking: calls.filter((c) => c.state === "talking").length,
            hold: calls.filter((c) => c.state === "hold").length,
          },
        };
        break;
      }

      case "get_employee_status": {
        const employees = await getEmployeeStatus(apiKey);
        result = {
          employees,
          summary: {
            total: employees.length,
            online: employees.filter((e) => e.status === "online").length,
            busy: employees.filter((e) => e.status === "busy").length,
            offline: employees.filter((e) => e.status === "offline").length,
          },
        };
        break;
      }

      case "get_queue_stats": {
        const stats = await getQueueStats(apiKey);
        result = stats;
        break;
      }

      case "get_all": {
        // Convenience action to get all monitoring data at once (efficient for polling)
        const [calls, employees, queueStats] = await Promise.all([
          listActiveCalls(apiKey),
          getEmployeeStatus(apiKey),
          getQueueStats(apiKey),
        ]);

        result = {
          active_calls: {
            calls,
            summary: {
              total_active: calls.length,
              ringing: calls.filter((c) => c.state === "ringing").length,
              talking: calls.filter((c) => c.state === "talking").length,
              hold: calls.filter((c) => c.state === "hold").length,
            },
          },
          employees: {
            employees,
            summary: {
              total: employees.length,
              online: employees.filter((e) => e.status === "online").length,
              busy: employees.filter((e) => e.status === "busy").length,
              offline: employees.filter((e) => e.status === "offline").length,
            },
          },
          queue_stats: queueStats,
          timestamp: new Date().toISOString(),
        };
        break;
      }

      default:
        return new Response(
          JSON.stringify({
            error: `Unknown action: ${action}. Valid actions: list_active_calls, get_employee_status, get_queue_stats, get_all`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        data: result,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in callgear-live-monitor:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
