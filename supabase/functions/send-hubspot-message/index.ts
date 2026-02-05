import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import {
  handleError,
  logError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";

/**
 * SEND HUBSPOT MESSAGE
 *
 * Sends AI-generated messages back to HubSpot conversations (WhatsApp)
 *
 * Usage:
 * POST /send-hubspot-message
 * Body: {
 *   threadId: "123456789",
 *   message: "Thanks for reaching out! How can I help you today?",
 *   senderActorId: "optional-actor-id" // Defaults to bot
 * }
 */

interface SendMessageRequest {
  threadId: string;
  message: string;
  senderActorId?: string;
}

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!HUBSPOT_API_KEY) {
    console.error("❌ HUBSPOT_API_KEY not configured");
    return new Response(
      JSON.stringify({ error: "HubSpot API key not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ Supabase credentials missing");
    return new Response(
      JSON.stringify({ error: "Database configuration error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body: SendMessageRequest = await req.json();
    const { threadId, message, senderActorId } = body;

    if (!threadId || !message) {
      return new Response(
        JSON.stringify({ error: "threadId and message are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`📤 Sending message to thread ${threadId}`);

    // HubSpot Conversations API endpoint
    const url = `https://api.hubapi.com/conversations/v3/conversations/threads/${threadId}/messages`;

    const payload = {
      type: "MESSAGE",
      text: message,
      ...(senderActorId && { senderActorId }),
    };

    // Attempt to send message with retry logic
    let attempts = 0;
    const maxAttempts = 3;
    let lastError: Error | null = null;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();
          const duration = Date.now() - startTime;

          console.log(`✅ Message sent successfully in ${duration}ms`);

          // Log successful delivery
          await supabase
            .from("message_delivery_log")
            .insert({
              thread_id: threadId,
              message_preview: message.slice(0, 100),
              status: "delivered",
              delivery_time_ms: duration,
              attempts,
            })
            .catch((err) => {
              console.warn("Failed to log delivery:", err);
            });

          return new Response(
            JSON.stringify({
              success: true,
              messageId: result.id,
              threadId,
              duration_ms: duration,
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        // Handle HTTP errors
        const errorText = await response.text();
        console.error(
          `❌ HubSpot API error (attempt ${attempts}/${maxAttempts}):`,
          response.status,
          errorText,
        );

        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(
            `HubSpot API client error: ${response.status} - ${errorText}`,
          );
        }

        lastError = new Error(
          `HubSpot API error: ${response.status} - ${errorText}`,
        );

        // Wait before retry (exponential backoff)
        if (attempts < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      } catch (error: any) {
        console.error(
          `❌ Network error (attempt ${attempts}/${maxAttempts}):`,
          error,
        );
        lastError = error;

        if (attempts < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed - log and fallback
    console.error(`❌ Failed to send message after ${maxAttempts} attempts`);

    await supabase
      .from("message_delivery_log")
      .insert({
        thread_id: threadId,
        message_preview: message.slice(0, 100),
        status: "failed",
        error_message: lastError?.message || "Unknown error",
        attempts: maxAttempts,
      })
      .catch((err) => {
        console.warn("Failed to log error:", err);
      });

    // Fallback: Create a note in HubSpot instead
    try {
      console.log("📝 Attempting fallback: creating note instead...");

      // This requires finding the contact/deal associated with the thread
      // For now, we'll just log the failure
      await logError(
        supabase,
        "send-hubspot-message",
        lastError || new Error("Message delivery failed"),
        ErrorCode.EXTERNAL_API_ERROR,
        {
          threadId,
          message: message.slice(0, 200),
          attempts: maxAttempts,
        },
      );
    } catch (fallbackError) {
      console.error("Fallback also failed:", fallbackError);
    }

    return new Response(
      JSON.stringify({
        error: "Failed to send message",
        details: lastError?.message || "Unknown error",
        attempts: maxAttempts,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("❌ Send message error:", error);

    return handleError(error, "send-hubspot-message", {
      supabase,
      errorCode: ErrorCode.EXTERNAL_API_ERROR,
      context: { function: "send-hubspot-message" },
    });
  }
});
