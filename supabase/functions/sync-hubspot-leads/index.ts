import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import {
  handleError,
  ErrorCode,
  corsHeaders,
} from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiValidationError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { validateOrThrow } from "../_shared/data-contracts.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const HUBSPOT_ACCESS_TOKEN = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
    if (!HUBSPOT_ACCESS_TOKEN) {
      throw new Error("Missing HUBSPOT_ACCESS_TOKEN");
    }

    console.log("Starting HubSpot Leads Sync...");

    // 1. Fetch Contacts from HubSpot
    // We request specific properties including the custom 'call_status'
    const properties = [
      "email",
      "firstname",
      "lastname",
      "phone",
      "company",
      "call_status", // The "Hitesh Mistry" fix - prioritize this
      "hs_lead_status",
      "hubspot_owner_id",
      "createdate",
      "lastmodifieddate",
      "lifecyclestage",
    ];

    const searchUrl = "https://api.hubapi.com/crm/v3/objects/contacts/search";
    const body = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "lastmodifieddate",
              operator: "GTE",
              value: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
            },
          ],
        },
      ],
      properties,
      limit: 100,
      sorts: [
        {
          propertyName: "lastmodifieddate",
          direction: "DESCENDING",
        },
      ],
    };

    const response = await fetch(searchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HubSpot API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const contacts = data.results || [];
    console.log(`Fetched ${contacts.length} contacts from HubSpot.`);

    const upsertData = contacts.map((contact: any) => {
      const props = contact.properties;

      // --- SMART STATUS LOGIC ---
      // Prioritize call_status (real agent input) over hs_lead_status
      const rawStatus = props.call_status || props.hs_lead_status || "NEW";
      let normalizedStatus = "NEW";

      const statusMap: Record<string, string> = {
        connected: "CONNECTED",
        completed: "CONNECTED",
        busy: "ATTEMPTED",
        no_answer: "ATTEMPTED",
        left_voicemail: "LEFT_VOICEMAIL",
        bad_timing: "BAD_TIMING",
        wrong_number: "WRONG_NUMBER",
        not_interested: "DISQUALIFIED",
        qualified: "QUALIFIED",
      };

      // Normalize to uppercase for matching
      const lookup = rawStatus.toLowerCase().replace(/ /g, "_");
      if (statusMap[lookup]) {
        normalizedStatus = statusMap[lookup];
      } else if (props.hs_lead_status === "OPEN") {
        normalizedStatus = "NEW";
      }

      return {
        hubspot_id: contact.id,
        email: props.email,
        first_name: props.firstname,
        last_name: props.lastname,
        phone: props.phone,
        company: props.company,
        status: normalizedStatus, // The calculated smart status
        raw_status: rawStatus, // Keep original for debugging
        hubspot_owner_id: props.hubspot_owner_id,
        lifecycle_stage: props.lifecyclestage || "lead",
        last_contacted: props.lastmodifieddate,
        updated_at: new Date().toISOString(),
      };
    });

    if (upsertData.length > 0) {
      const { error } = await supabase
        .from("sales_leads") // We'll need to ensure this table exists or use a generic contacts table
        .upsert(upsertData, { onConflict: "hubspot_id" });

      if (error) throw error;
    }

    return apiSuccess({
        success: true,
        processed: upsertData.length,
        message: "Sync complete",
      });
  } catch (error: unknown) {
    // Create a temporary client for error logging if not already created
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    return handleError(error, "sync-hubspot-leads", {
      supabase,
      errorCode: ErrorCode.EXTERNAL_API_ERROR,
    });
  }
});
