import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
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
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    // Validate request method
    if (req.method !== "POST") {
      return apiError("BAD_REQUEST", JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get API key from environment
    const apiKey = Deno.env.get("CALLGEAR_API_KEY");
    if (!apiKey) {
      console.error("CALLGEAR_API_KEY not configured");
      return apiError("INTERNAL_ERROR", JSON.stringify({ error: "Service configuration error" }), 500);
    }

    // Parse request body
    const requestData: SupervisorRequest = await req.json();
    const { action } = requestData;

    // Validate action
    if (
      !action ||
      !["attach_coach", "detach_coach", "change_mode"].includes(action)
    ) {
      return apiError("BAD_REQUEST", JSON.stringify({
          error:
            "Invalid action. Must be: attach_coach, detach_coach, or change_mode",
        }), 400);
    }

    // Build JSON-RPC payload based on action
    let rpcParams: CoachParams;

    switch (action) {
      case "attach_coach": {
        const { call_session_id, coach_sip_uri, mode, target_leg_id } =
          requestData as AttachCoachRequest;

        // Validate required fields
        if (!call_session_id || !coach_sip_uri || !mode || !target_leg_id) {
          return apiError("BAD_REQUEST", JSON.stringify({
              error:
                "Missing required fields for attach_coach: call_session_id, coach_sip_uri, mode, target_leg_id",
            }), 400);
        }

        // Validate mode
        if (!["listen", "whisper", "barge"].includes(mode)) {
          return apiError("BAD_REQUEST", JSON.stringify({
              error: "Invalid mode. Must be: listen, whisper, or barge",
            }), 400);
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
          return apiError("BAD_REQUEST", JSON.stringify({
              error: "Missing required field: call_session_id",
            }), 400);
        }

        rpcParams = { call_session_id };
        break;
      }

      case "change_mode": {
        const { call_session_id, mode } = requestData as ChangeModeRequest;

        if (!call_session_id || !mode) {
          return apiError("BAD_REQUEST", JSON.stringify({
              error:
                "Missing required fields for change_mode: call_session_id, mode",
            }), 400);
        }

        // Validate mode
        if (!["listen", "whisper", "barge"].includes(mode)) {
          return apiError("BAD_REQUEST", JSON.stringify({
              error: "Invalid mode. Must be: listen, whisper, or barge",
            }), 400);
        }

        rpcParams = {
          call_session_id,
          mode,
        };
        break;
      }

      default:
        return apiSuccess({ error: "Unknown action" });
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
      return apiError("INTERNAL_ERROR", JSON.stringify({
          error: "CallGear API error",
          details: responseData.error,
        }), 500);
    }

    // Check HTTP status
    if (!callgearResponse.ok) {
      console.error(
        "CallGear HTTP Error:",
        callgearResponse.status,
        responseData,
      );
      return apiSuccess({
          error: "CallGear request failed",
          status: callgearResponse.status,
          details: responseData,
        });
    }

    console.log("CallGear Supervisor Success:", JSON.stringify(responseData));

    // Return success response
    return apiSuccess({
        success: true,
        action,
        result: responseData.result,
        metadata: {
          timestamp: new Date().toISOString(),
          request_id: rpcPayload.id,
        },
      });
  } catch (error: unknown) {
    return handleError(error, "callgear-supervisor", {
      errorCode: ErrorCode.INTERNAL_ERROR,
      context: { function: "callgear-supervisor" },
    });
  }
});
