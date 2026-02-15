import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { verifyHubSpotSignature } from "../_shared/hubspot-verifier.ts";

import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limiter.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

serve(async (req) => {
  // Webhook endpoint — HubSpot signature verification handles security
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify HubSpot Signature (Security Best Practice)
    const HUBSPOT_CLIENT_SECRET = Deno.env.get("HUBSPOT_CLIENT_SECRET");
    const rawBody = await req.text();
    
    if (HUBSPOT_CLIENT_SECRET) {
      const isValid = await verifyHubSpotSignature(req, rawBody, HUBSPOT_CLIENT_SECRET);
      if (!isValid) {
        console.warn("⚠️ Invalid HubSpot Signature - Potential Spoofing Attempt");
        // Throwing error to reject the request
        return errorToResponse(new UnauthorizedError());
      }
    } else {
        console.warn("⚠️ HUBSPOT_CLIENT_SECRET not set - Signature verification skipped");
    }

    const events = JSON.parse(rawBody);
    console.log(`[HubSpot Webhook] Received ${events.length} events`);

    for (const event of events) {
      try {
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
          continue;
        }

        try {
          // STEP 1: Fetch thread metadata and messages
          const threadUrl = `https://api.hubapi.com/conversations/v3/conversations/threads/${objectId}`;
          const messagesUrl = `https://api.hubapi.com/conversations/v3/conversations/threads/${objectId}/messages`;
          
          console.log(`📥 Fetching data for thread ${objectId}`);

          const [threadRes, msgResponse] = await Promise.all([
            fetch(threadUrl, {
              headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` },
            }),
            fetch(messagesUrl, {
              headers: {
                Authorization: `Bearer ${HUBSPOT_API_KEY}`,
                "Content-Type": "application/json",
              },
            })
          ]);

          if (!msgResponse.ok) {
            console.error(`❌ Failed to fetch messages: ${msgResponse.status}`);
            continue;
          }

          const threadData = threadRes.ok ? await threadRes.json() : {};
          const messagesData = await msgResponse.json();
          
          // Get Contact ID if available
          let contactId = threadData.associatedContactId;
          
          // If no contact ID, try to find by phone number from the message sender
          if (!contactId && messagesData.results?.[0]?.sender?.id) {
            const senderId = messagesData.results[0].sender.id;
            console.log(`🔍 No Contact ID found, attempting lookup for sender: ${senderId}`);
            
            // In HubSpot Conversations, sender.id for WhatsApp is often the phone number or a platform ID
            // We can try to search for a contact with this phone/ID
            const searchUrl = `https://api.hubapi.com/crm/v3/objects/contacts/search`;
            const searchRes = await fetch(searchUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${HUBSPOT_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                filterGroups: [{
                  filters: [{
                    propertyName: "phone",
                    operator: "EQ",
                    value: senderId.replace("whatsapp:", "")
                  }]
                }]
              })
            });
            
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              if (searchData.total > 0) {
                contactId = searchData.results[0].id;
                console.log(`✅ Found contact via phone search: ${contactId}`);
              }
            }
          }

          console.log(`👤 Final Contact ID: ${contactId || "unknown"}`);

          const latestMessage = messagesData.results?.[0];

          if (!latestMessage || !latestMessage.text) {
            console.warn("⚠️ No message text found");
            continue;
          }

          const userMessage = latestMessage.text;
          const messageCount = messagesData.results?.length || 1;
          console.log(`📝 User message: "${userMessage.slice(0, 100)}..."`);

          // Respond 200 immediately to HubSpot to prevent timeouts/retries
          // then process in background
          const conversationContext = {
            source: "whatsapp",
            platform: "whatsapp",
            threadId: objectId,
            contactId: contactId,
            subscriptionType,
            messageCount,
            timestamp: new Date().toISOString(),
          };

          console.log(`🧠 Queueing AI processing for thread ${objectId}`);
          
          // Use EdgeRuntime.waitUntil for background processing
          (globalThis as any).EdgeRuntime?.waitUntil((async () => {
            try {
              const { data: aiResponse, error: aiError } =
                await supabase.functions.invoke("agent-manager", {
                  body: {
                    query: userMessage,
                    context: conversationContext,
                  },
                });

              if (aiError || !aiResponse?.response) {
                console.error("❌ AI processing failed in background:", aiError);
                return;
              }

              const aiMessageText = aiResponse.response;
              const messageParts = aiMessageText.split(/\n\n+/).filter(p => p.trim().length > 0);
              
              for (let i = 0; i < messageParts.length; i++) {
                if (i > 0) await new Promise(r => setTimeout(r, 1500));
                
                await supabase.functions.invoke("send-hubspot-message", {
                  body: { threadId: objectId, message: messageParts[i] },
                });
              }
              console.log(`✅ Background processing complete for thread ${objectId}`);
            } catch (err: unknown) {
              console.error("❌ Background flow error:", err);
            }
          })());

        } catch (whatsappError: any) {
          console.error("❌ WhatsApp setup error:", whatsappError);
        }
      }
      } catch (eventError: unknown) {
        console.error(`❌ Error processing event ${event.eventId || 'unknown'} (${event.subscriptionType}):`, eventError);
        // Continue processing remaining events — don't kill the batch
      }
    }

    return apiSuccess({ success: true, message: "Queued" });
  } catch (error: unknown) {
    return handleError(error, "hubspot-webhook-receiver", {
      supabase: createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ),
      errorCode: ErrorCode.INTERNAL_ERROR,
    });
  }
});
