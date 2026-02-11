import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import {
  handleError,
  createSuccessResponse,
  handleCorsPreFlight,
  corsHeaders,
  ErrorCode,
  validateEnvVars,
  parseJsonSafely,
} from "../_shared/error-handler.ts";

// Calendly Webhook Receiver - syncs appointments to Supabase
serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  const FUNCTION_NAME = "calendly-webhook";

  if (req.method === "OPTIONS") {
    return handleCorsPreFlight();
  }

  let supabase = null;

  try {
    // Validate required environment variables
    const envValidation = validateEnvVars(
      ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
      FUNCTION_NAME
    );

    if (!envValidation.valid) {
      return handleError(
        new Error(`Missing required environment variables: ${envValidation.missing.join(", ")}`),
        FUNCTION_NAME,
        {
          errorCode: ErrorCode.MISSING_API_KEY,
          context: { missingVars: envValidation.missing },
        }
      );
    }

    console.log("[Calendly Webhook] Received request");

    supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse request body with error handling
    const parseResult = await parseJsonSafely(req, FUNCTION_NAME);
    if (!parseResult.success) {
      return handleError(
        parseResult.error,
        FUNCTION_NAME,
        {
          supabase,
          errorCode: ErrorCode.VALIDATION_ERROR,
          context: { parseError: parseResult.error.message },
        }
      );
    }

    const body = parseResult.data as Record<string, unknown>;
    console.log("[Calendly Webhook] Payload:", JSON.stringify(body).slice(0, 500));

    // Calendly webhook structure
    const event = (body.event || body) as Record<string, any>;
    const eventType = ((event.event_type || event.type) as string) || '';
    const invitee = (event.invitee || event.payload?.invitee) as Record<string, any>;
    const eventDetails = (event.event || event.payload?.event) as Record<string, any>;

    if (!invitee || !eventDetails) {
      return handleError(
        new Error("Missing invitee or event data"),
        FUNCTION_NAME,
        {
          supabase: supabase ?? undefined,
          errorCode: ErrorCode.VALIDATION_ERROR,
          context: { hasInvitee: !!invitee, hasEventDetails: !!eventDetails },
        }
      );
    }

    // Extract appointment data
    const appointmentData = {
      title: eventDetails.name || "Consultation",
      description: invitee.questions_and_answers?.map((q: any) => `${q.question}: ${q.answer}`).join("\n") || null,
      start_time: invitee.event_start_time || invitee.start_time,
      end_time: invitee.event_end_time || invitee.end_time,
      status: mapCalendlyStatus(eventType, invitee.status as string),
      contact_id: null as string | null,
      deal_id: null as string | null,
      assigned_to: eventDetails.host_email || null,
      location: eventDetails.location?.location || eventDetails.location || null,
      meeting_url: invitee.event_guest_urls?.guest_url || invitee.uri || null,
      hubspot_id: invitee.tracking?.utm_source || null,
      notes: JSON.stringify({
        calendly_event_uri: invitee.uri,
        calendly_event_type_uri: eventDetails.uri,
        calendly_invitee_uri: invitee.uri,
        cancel_reason: invitee.cancel_reason,
        cancel_url: invitee.cancel_url,
        reschedule_url: invitee.reschedule_url,
        questions: invitee.questions_and_answers,
      }),
      outcome: null as string | null,
      metadata: {
        calendly_event_type: eventDetails.type,
        calendly_invitee_email: invitee.email,
        calendly_invitee_name: invitee.name,
        calendly_invitee_phone: invitee.phone_number,
        calendly_created_at: invitee.created_at,
        calendly_updated_at: invitee.updated_at,
        utm_source: invitee.tracking?.utm_source,
        utm_medium: invitee.tracking?.utm_medium,
        utm_campaign: invitee.tracking?.utm_campaign,
        utm_content: invitee.tracking?.utm_content,
        utm_term: invitee.tracking?.utm_term,
      },
    };

    // Find or create contact by email
    if (invitee.email) {
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("email", invitee.email)
        .single();

      if (existingContact) {
        appointmentData.contact_id = existingContact.id;
        
        // Update contact with appointment info
        await supabase
          .from("contacts")
          .update({
            last_activity_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingContact.id);
      } else {
        // Create new contact
        const { data: newContact } = await supabase
          .from("contacts")
          .insert({
            email: invitee.email,
            first_name: invitee.name?.split(" ")[0] || null,
            last_name: invitee.name?.split(" ").slice(1).join(" ") || null,
            phone: invitee.phone_number || null,
            first_touch_source: invitee.tracking?.utm_source || "calendly",
            first_touch_time: new Date().toISOString(),
            latest_traffic_source: invitee.tracking?.utm_source || "calendly",
            total_events: 1,
          })
          .select()
          .single();

        if (newContact) {
          appointmentData.contact_id = newContact.id;
        }
      }
    }

    // Insert/update appointment
    const { error: appointmentError } = await supabase
      .from("appointments")
      .upsert(appointmentData, { 
        onConflict: "hubspot_id",
        ignoreDuplicates: false 
      });

    if (appointmentError) {
      console.error("[Calendly Webhook] Appointment insert error:", appointmentError);
      return handleError(
        appointmentError,
        FUNCTION_NAME,
        {
          supabase,
          errorCode: ErrorCode.DATABASE_ERROR,
          context: { operation: "insert_appointment", eventType },
        }
      );
    }

    // Create attribution event for Calendly
    if (appointmentData.contact_id && invitee.email) {
      const attributionData = {
        event_id: `calendly_${invitee.uri?.split("/").pop() || Date.now()}`,
        event_name: mapCalendlyEventName(eventType),
        event_time: appointmentData.start_time,
        email: invitee.email,
        first_name: invitee.name?.split(" ")[0] || null,
        last_name: invitee.name?.split(" ").slice(1).join(" ") || null,
        value: 0,
        currency: "AED",
        source: invitee.tracking?.utm_source || "calendly",
        medium: invitee.tracking?.utm_medium || "direct",
        campaign: invitee.tracking?.utm_campaign || null,
        utm_source: invitee.tracking?.utm_source || null,
        utm_medium: invitee.tracking?.utm_medium || null,
        utm_campaign: invitee.tracking?.utm_campaign || null,
        platform: "calendly",
      };

      await supabase
        .from("attribution_events")
        .upsert(attributionData, { onConflict: "event_id" });
    }

    console.log(`[Calendly Webhook] Processed ${eventType} appointment: ${invitee.email}`);

    const successResponse = createSuccessResponse({
      message: `Processed Calendly ${eventType} event`,
      appointment_id: appointmentData.hubspot_id,
      event_type: eventType,
    });

    return apiSuccess(successResponse);

  } catch (error: unknown) {
    // Determine appropriate error code
    let errorCode = ErrorCode.INTERNAL_ERROR;

    if (error instanceof Error) {
      if (error.message?.includes("database") || error.message?.includes("insert")) {
        errorCode = ErrorCode.DATABASE_ERROR;
      } else if (error.message?.includes("JSON") || error.message?.includes("parse")) {
        errorCode = ErrorCode.VALIDATION_ERROR;
      }
    }

    return handleError(
      error as Error,
      FUNCTION_NAME,
      {
        supabase: supabase ?? undefined,
        errorCode,
        context: { method: req.method },
      }
    );
  }
});

// Map Calendly event type to appointment status
function mapCalendlyStatus(eventType: string, inviteeStatus?: string): string {
  if (eventType.includes("cancel") || inviteeStatus === "canceled") return "cancelled";
  if (eventType.includes("no_show") || inviteeStatus === "no_show") return "no_show";
  if (eventType.includes("complete") || inviteeStatus === "completed") return "completed";
  return "scheduled";
}

// Map Calendly event type to attribution event name
function mapCalendlyEventName(eventType: string): string {
  if (eventType.includes("cancel")) return "AppointmentCancelled";
  if (eventType.includes("no_show")) return "NoShow";
  if (eventType.includes("complete")) return "AppointmentCompleted";
  return "Schedule";
}
