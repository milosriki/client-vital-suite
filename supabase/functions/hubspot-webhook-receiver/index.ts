import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";

import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify HubSpot Signature (Security Best Practice)
    // For now, we trust the obscure URL, but in prod we check X-HubSpot-Signature

    const events = await req.json();
    console.log(`[HubSpot Webhook] Received ${events.length} events`);

    for (const event of events) {
      const { subscriptionType, objectId, propertyName, propertyValue } = event;
      console.log(`Processing ${subscriptionType} for object ${objectId}`);

      // 1. Deal Events
      if (subscriptionType === "deal.creation") {
        await supabase.functions.invoke("sync-single-deal", {
          body: { dealId: objectId },
        });
      }

      // 2. Contact Events (New Lead)
      if (
        subscriptionType === "contact.creation" ||
        subscriptionType === "contact.propertyChange"
      ) {
        console.log(`Triggering sync for contact ${objectId}`);
        await supabase.functions.invoke("sync-single-contact", {
          body: { objectId },
        });
      }

      // 3. Call Creation (The "Smart Sync" for Calls)
      // Note: User must subscribe to "Call creation" in HubSpot Webhooks
      if (
        subscriptionType === "call.creation" ||
        (subscriptionType === "object.creation" &&
          (event as any).objectType === "CALL")
      ) {
        console.log(`Triggering sync for CALL ${objectId}`);
        await supabase.functions.invoke("sync-single-call", {
          body: { objectId },
        });
      }

      // 4. Association Change (Linker)
      if (subscriptionType === "deal.associationChange") {
        const { toObjectId } = event;
        console.log(
          `Association changed: Deal ${objectId} <-> Object ${toObjectId}`,
        );
        await supabase.rpc("manual_link_deal_contact", {
          p_deal_id: objectId.toString(),
          p_contact_id: toObjectId.toString(),
        });
      }

      // 5. Stage Change
      if (
        propertyName === "dealstage" &&
        (propertyValue === "closedwon" || propertyValue === "closed_won")
      ) {
        console.log("💰 DEAL WON! Triggering celebration...");
      }

      // 6. WhatsApp/Conversation Messages - COMPLETE FLOW
      if (
        subscriptionType === "conversation.newMessage" ||
        subscriptionType === "conversation.creation"
      ) {
        console.log(`💬 New WhatsApp Message in Thread ${objectId}`);

        const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");

        if (!HUBSPOT_API_KEY) {
          console.error("❌ HUBSPOT_API_KEY not configured");
          return;
        }

        try {
          // STEP 1: Fetch the actual message from HubSpot
          const messagesUrl = `https://api.hubapi.com/conversations/v3/conversations/threads/${objectId}/messages`;
          console.log(`📥 Fetching messages from thread ${objectId}`);

          const msgResponse = await fetch(messagesUrl, {
            headers: {
              Authorization: `Bearer ${HUBSPOT_API_KEY}`,
              "Content-Type": "application/json",
            },
          });

          if (!msgResponse.ok) {
            console.error(`❌ Failed to fetch messages: ${msgResponse.status}`);
            return;
          }

          const messagesData = await msgResponse.json();
          const latestMessage = messagesData.results?.[0];

          if (!latestMessage || !latestMessage.text) {
            console.warn("⚠️ No message text found");
            return;
          }

          const userMessage = latestMessage.text;
          console.log(`📝 User message: "${userMessage.slice(0, 100)}..."`);

          // STEP 2: Build conversation context for psychology engine
          const conversationContext = {
            source: "whatsapp",
            platform: "whatsapp",
            threadId: objectId,
            subscriptionType,
            messageCount: messagesData.results?.length || 1,
            // Add metadata for psychology patterns
            timestamp: new Date().toISOString(),
          };

          // STEP 3: Get AI response with psychology prompts
          console.log(`🧠 Processing with AI (psychology mode)`);
          const { data: aiResponse, error: aiError } =
            await supabase.functions.invoke("agent-manager", {
              body: {
                query: userMessage,
                context: conversationContext,
              },
            });

          if (aiError) {
            console.error("❌ AI processing error:", aiError);
            return;
          }

          if (!aiResponse?.response) {
            console.error("❌ No AI response generated");
            return;
          }

          const aiMessageText = aiResponse.response;
          console.log(
            `✅ AI response generated: "${aiMessageText.slice(0, 100)}..."`,
          );

          // STEP 4: Send response back to customer via HubSpot
          console.log(`📤 Sending response to WhatsApp`);
          const { data: sendResult, error: sendError } =
            await supabase.functions.invoke("send-hubspot-message", {
              body: {
                threadId: objectId,
                message: aiMessageText,
              },
            });

          if (sendError) {
            console.error("❌ Message sending error:", sendError);
            return;
          }

          console.log(`✅ Message delivered successfully!`, sendResult);
        } catch (whatsappError: any) {
          console.error("❌ WhatsApp flow error:", whatsappError);

          // Log error but don't crash the webhook
          await supabase
            .from("error_log")
            .insert({
              function_name: "hubspot-webhook-receiver",
              error_message: whatsappError.message || "Unknown error",
              context: {
                threadId: objectId,
                subscriptionType,
              },
            })
            .catch((logError: any) => {
              console.error("Failed to log error:", logError);
            });
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleError(error, "hubspot-webhook-receiver", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  }
});
