import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Calendly Webhook Receiver - syncs appointments to Supabase
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[Calendly Webhook] Received request");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    console.log("[Calendly Webhook] Payload:", JSON.stringify(body).slice(0, 500));

    // Calendly webhook structure
    const event = body.event || body;
    const eventType = event.event_type || event.type;
    const invitee = event.invitee || event.payload?.invitee;
    const eventDetails = event.event || event.payload?.event;

    if (!invitee || !eventDetails) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing invitee or event data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract appointment data
    const appointmentData = {
      title: eventDetails.name || "Consultation",
      description: invitee.questions_and_answers?.map((q: any) => `${q.question}: ${q.answer}`).join("\n") || null,
      start_time: invitee.event_start_time || invitee.start_time,
      end_time: invitee.event_end_time || invitee.end_time,
      status: mapCalendlyStatus(eventType, invitee.status),
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
      throw appointmentError;
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

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed Calendly ${eventType} event`,
        appointment_id: appointmentData.hubspot_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Calendly Webhook] Fatal error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
