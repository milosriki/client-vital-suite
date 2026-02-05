import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";

// CORRECT CallGear API endpoints:
// - Data API: https://dataapi.callgear.com/v2.0 (JSON-RPC for reports)
// - Call API: https://callapi.callgear.com/v4.0 (REST for call management)
const CALLGEAR_API_ENDPOINT = "https://callapi.callgear.com/v4.0";

interface CoachParams {
  call_session_id: string;
  coach_sip_uri?: string;
  mode?: "listen" | "whisper" | "barge";
  target_leg_id?: string;
}

interface AttachCoachRequest {
  action: "attach_coach";
  call_session_id: string;
  coach_sip_uri: string;
  mode: "listen" | "whisper" | "barge";
  target_leg_id: string;
}

interface DetachCoachRequest {
  action: "detach_coach";
  call_session_id: string;
}

interface ChangeModeRequest {
  action: "change_mode";
  call_session_id: string;
  mode: "listen" | "whisper" | "barge";
}

type SupervisorRequest =
  | AttachCoachRequest
  | DetachCoachRequest
  | ChangeModeRequest;

// Removed local corsHeaders definition in favor of shared one

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get API key from environment
    const apiKey = Deno.env.get("CALLGEAR_API_KEY");
    if (!apiKey) {
      console.error("CALLGEAR_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse request body
    const requestData: SupervisorRequest = await req.json();
    const { action } = requestData;

    // Validate action
    if (
      !action ||
      !["attach_coach", "detach_coach", "change_mode"].includes(action)
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Invalid action. Must be: attach_coach, detach_coach, or change_mode",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build JSON-RPC payload based on action
    let rpcParams: CoachParams;

    switch (action) {
      case "attach_coach": {
        const { call_session_id, coach_sip_uri, mode, target_leg_id } =
          requestData as AttachCoachRequest;

        // Validate required fields
        if (!call_session_id || !coach_sip_uri || !mode || !target_leg_id) {
          return new Response(
            JSON.stringify({
              error:
                "Missing required fields for attach_coach: call_session_id, coach_sip_uri, mode, target_leg_id",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        // Validate mode
        if (!["listen", "whisper", "barge"].includes(mode)) {
          return new Response(
            JSON.stringify({
              error: "Invalid mode. Must be: listen, whisper, or barge",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        rpcParams = {
          call_session_id,
          coach_sip_uri,
          mode,
          target_leg_id,
        };
        break;
      }

      case "detach_coach": {
        const { call_session_id } = requestData as DetachCoachRequest;

        if (!call_session_id) {
          return new Response(
            JSON.stringify({
              error: "Missing required field: call_session_id",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        rpcParams = { call_session_id };
        break;
      }

      case "change_mode": {
        const { call_session_id, mode } = requestData as ChangeModeRequest;

        if (!call_session_id || !mode) {
          return new Response(
            JSON.stringify({
              error:
                "Missing required fields for change_mode: call_session_id, mode",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        // Validate mode
        if (!["listen", "whisper", "barge"].includes(mode)) {
          return new Response(
            JSON.stringify({
              error: "Invalid mode. Must be: listen, whisper, or barge",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        rpcParams = {
          call_session_id,
          mode,
        };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Build JSON-RPC 2.0 envelope
    const rpcPayload = {
      jsonrpc: "2.0",
      method: "add.coach",
      params: rpcParams,
      id: `req_${Date.now()}`,
    };

    console.log(
      "CallGear Supervisor Request:",
      JSON.stringify({ action, params: rpcParams }),
    );

    // Call CallGear API
    const callgearResponse = await fetch(CALLGEAR_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(rpcPayload),
    });

    // Parse response
    const responseData = await callgearResponse.json();

    // Check for JSON-RPC error
    if (responseData.error) {
      console.error("CallGear API Error:", responseData.error);
      return new Response(
        JSON.stringify({
          error: "CallGear API error",
          details: responseData.error,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check HTTP status
    if (!callgearResponse.ok) {
      console.error(
        "CallGear HTTP Error:",
        callgearResponse.status,
        responseData,
      );
      return new Response(
        JSON.stringify({
          error: "CallGear request failed",
          status: callgearResponse.status,
          details: responseData,
        }),
        {
          status: callgearResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("CallGear Supervisor Success:", JSON.stringify(responseData));

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        action,
        result: responseData.result,
        metadata: {
          timestamp: new Date().toISOString(),
          request_id: rpcPayload.id,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    return handleError(error, "callgear-supervisor", {
      errorCode: ErrorCode.INTERNAL_ERROR,
      context: { function: "callgear-supervisor" },
    });
  }
});
