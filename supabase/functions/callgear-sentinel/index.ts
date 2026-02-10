import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
/**
 * CallGear Sentinel - Real-time Impersonation Detection
 * 
 * Monitors CallGear webhooks for suspicious call patterns:
 * - Long calls on sensitive lines (>10 mins)
 * - Suspicious caller numbers
 * - Keyword detection in transcripts (Password, Reset, Bank)
 * - Auto-triggers AI coach to listen in
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// CORRECT CallGear API endpoints:
// - Data API: https://dataapi.callgear.com/v2.0 (JSON-RPC for reports)
// - Call API: https://callapi.callgear.com/v4.0 (REST for call management)
const CALLGEAR_API_ENDPOINT = "https://callapi.callgear.com/v4.0";
const CALLGEAR_API_KEY = Deno.env.get("CALLGEAR_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Suspicious keywords that trigger alerts
const SUSPICIOUS_KEYWORDS = [
  "password", "reset", "bank", "account number", "routing number",
  "social security", "ssn", "credit card", "card number", "cvv",
  "pin", "security code", "verification code", "two factor",
  "2fa", "authenticator", "recovery code"
];

// Known suspicious numbers (can be loaded from database)
const SUSPICIOUS_NUMBERS = (Deno.env.get("SUSPICIOUS_PHONE_NUMBERS") || "").split(",").filter(Boolean);

// Sensitive lines that need monitoring
const SENSITIVE_LINES = (Deno.env.get("SENSITIVE_PHONE_LINES") || "").split(",").filter(Boolean);

interface CallGearWebhook {
  event_type: string;
  call_session_id: string;
  caller_number: string;
  called_number: string;
  duration?: number;
  transcript?: string;
  status?: string;
  employee_name?: string;
  started_at?: string;
}

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const webhook: CallGearWebhook = await req.json();

    console.log(`[CALLGEAR-SENTINEL] Received webhook: ${webhook.event_type} for call ${webhook.call_session_id}`);

    const alerts: any[] = [];
    let shouldListen = false;

    // ====== CHECK 1: Suspicious Caller Number ======
    if (SUSPICIOUS_NUMBERS.includes(webhook.caller_number)) {
      alerts.push({
        type: "SUSPICIOUS_CALLER",
        severity: "critical",
        message: `Call from blacklisted number: ${webhook.caller_number}`,
        details: {
          callerNumber: webhook.caller_number,
          callSessionId: webhook.call_session_id,
          timestamp: webhook.started_at || new Date().toISOString()
        }
      });
      shouldListen = true;
    }

    // ====== CHECK 2: Long Call on Sensitive Line ======
    if (webhook.duration && webhook.duration > 600 && SENSITIVE_LINES.includes(webhook.called_number)) {
      alerts.push({
        type: "LONG_CALL_SENSITIVE_LINE",
        severity: "high",
        message: `Call duration ${webhook.duration}s on sensitive line ${webhook.called_number}`,
        details: {
          duration: webhook.duration,
          calledNumber: webhook.called_number,
          callerNumber: webhook.caller_number,
          callSessionId: webhook.call_session_id
        }
      });
      shouldListen = true;
    }

    // ====== CHECK 3: Keyword Detection in Transcript ======
    if (webhook.transcript) {
      const transcriptLower = webhook.transcript.toLowerCase();
      const foundKeywords = SUSPICIOUS_KEYWORDS.filter(keyword => 
        transcriptLower.includes(keyword.toLowerCase())
      );

      if (foundKeywords.length > 0) {
        alerts.push({
          type: "SUSPICIOUS_KEYWORDS_DETECTED",
          severity: "critical",
          message: `Suspicious keywords detected: ${foundKeywords.join(", ")}`,
          details: {
            keywords: foundKeywords,
            callerNumber: webhook.caller_number,
            calledNumber: webhook.called_number,
            callSessionId: webhook.call_session_id,
            transcriptSnippet: webhook.transcript.substring(0, 500)
          }
        });
        shouldListen = true;
      }
    }

    // ====== CHECK 4: Unusual Call Pattern ======
    // Check for multiple calls from same number in short time
    if (webhook.event_type === "call_session.created") {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("call_records")
        .select("id", { count: "exact", head: true })
        .eq("caller_number", webhook.caller_number)
        .gte("started_at", oneHourAgo);

      if (count && count > 5) {
        alerts.push({
          type: "UNUSUAL_CALL_PATTERN",
          severity: "medium",
          message: `${count} calls from ${webhook.caller_number} in the last hour`,
          details: {
            callerNumber: webhook.caller_number,
            callCount: count,
            timeWindow: "1 hour"
          }
        });
      }
    }

    // ====== AUTO-TRIGGER AI COACH TO LISTEN ======
    if (shouldListen && CALLGEAR_API_KEY && webhook.call_session_id) {
      try {
        const coachSipUri = Deno.env.get("AI_COACH_SIP_URI") || "sip:ai-coach@callgear.com";
        
        const response = await fetch(CALLGEAR_API_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${CALLGEAR_API_KEY}`,
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "add.coach",
            params: {
              call_session_id: webhook.call_session_id,
              coach_sip_uri: coachSipUri,
              mode: "listen", // Silent monitoring
              target_leg_id: "both" // Monitor both sides
            },
            id: `sentinel_${Date.now()}`
          })
        });

        if (response.ok) {
          console.log(`[CALLGEAR-SENTINEL] AI coach attached to call ${webhook.call_session_id}`);
        }
      } catch (error: unknown) {
        console.error(`[CALLGEAR-SENTINEL] Failed to attach AI coach:`, error);
      }
    }

    // ====== SEND SMS ALERT IF CRITICAL ======
    const criticalAlerts = alerts.filter(a => a.severity === "critical");
    if (criticalAlerts.length > 0) {
      const smsWebhookUrl = Deno.env.get("SMS_ALERT_WEBHOOK_URL");
      if (smsWebhookUrl) {
        try {
          await fetch(smsWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: `🚨 CRITICAL: ${criticalAlerts.length} security alert(s) detected on call ${webhook.call_session_id}`,
              alerts: criticalAlerts.map(a => a.message)
            })
          });
        } catch (error: unknown) {
          console.error(`[CALLGEAR-SENTINEL] Failed to send SMS alert:`, error);
        }
      }
    }

    // ====== STORE ALERTS IN DATABASE ======
    if (alerts.length > 0) {
      try {
        const { error: insertError } = await supabase.from("security_alerts").insert({
          source: "callgear_sentinel",
          alert_type: alerts[0].type,
          severity: alerts[0].severity,
          message: alerts[0].message,
          details: alerts[0].details,
          call_session_id: webhook.call_session_id,
          caller_number: webhook.caller_number,
          called_number: webhook.called_number,
          created_at: new Date().toISOString()
        });
        if (insertError) console.error("Failed to store alert:", insertError);
        else console.log("Alert stored successfully");
      } catch (err: unknown) {
        console.error("Failed to store alert:", err);
      }
    }

    return apiSuccess({
        success: true,
        alertsDetected: alerts.length,
        alerts,
        aiCoachAttached: shouldListen,
        timestamp: new Date().toISOString()
      });

  } catch (error: unknown) {
    console.error("[CALLGEAR-SENTINEL] Error:", error);
    return apiError("INTERNAL_ERROR", JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), 500);
  }
});
