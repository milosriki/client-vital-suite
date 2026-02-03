import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!HUBSPOT_API_KEY)
      throw new Error("HUBSPOT_ACCESS_TOKEN not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { objectId } = await req.json(); // Contact ID

    if (!objectId) throw new Error("objectId (Contact ID) is required");

    console.log(`[Sync-Single-Contact] Processing Contact ID: ${objectId}`);

    // Fetch Contact Properties
    const properties = [
      "email",
      "firstname",
      "lastname",
      "phone",
      "mobilephone",
      "lifecyclestage",
      "hubspot_owner_id",
      "createdate",
      "lastmodifieddate",
      "jobtitle",
      "city",
      "country",
    ];

    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/${objectId}?properties=${properties.join(",")}`,
      {
        headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` },
      },
    );

    if (!response.ok) {
      if (response.status === 404)
        return new Response(JSON.stringify({ message: "Contact not found" }));
      throw new Error(`HubSpot API Error: ${await response.text()}`);
    }

    const data = await response.json();
    const props = data.properties;

    // Upsert to Supabase
    const contactData = {
      hubspot_contact_id: objectId,
      email: props.email,
      first_name: props.firstname,
      last_name: props.lastname,
      phone: props.phone || props.mobilephone,
      lifecycle_stage: props.lifecyclestage,
      hubspot_owner_id: props.hubspot_owner_id,
      created_at: props.createdate
        ? new Date(props.createdate).toISOString()
        : new Date().toISOString(),
      updated_at: props.lastmodifieddate
        ? new Date(props.lastmodifieddate).toISOString()
        : new Date().toISOString(),
      // Extra fields usually stored in 'raw_data' or specific columns if they exist
      position: props.jobtitle,
      city: props.city,
      country: props.country,
    };

    const { error } = await supabase
      .from("contacts")
      .upsert(contactData, { onConflict: "hubspot_contact_id" });

    if (error) throw error;

    console.log(
      `[Sync-Single-Contact] Successfully synced contact ${props.email}`,
    );

    return new Response(
      JSON.stringify({ success: true, contact: contactData }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[Sync-Single-Contact] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
