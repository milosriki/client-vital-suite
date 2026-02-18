import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { HubSpotSyncManager } from "../_shared/hubspot-sync-manager.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Map CallGear finish_reason to call_status
function mapCallStatus(finishReason: string, isLost: boolean): string {
  if (isLost) return "missed";

  switch (finishReason?.toLowerCase()) {
    case "answered":
    case "completed":
      return "completed";
    case "no_answer":
    case "busy":
    case "cancel":
      return "missed";
    case "failed":
      return "failed";
    default:
      return "unknown";
  }
}

// Map CallGear finish_reason to call_outcome
function mapCallOutcome(finishReason: string, isLost: boolean): string {
  if (isLost) return "no_answer";

  switch (finishReason?.toLowerCase()) {
    case "answered":
    case "completed":
      return "answered";
    case "no_answer":
      return "no_answer";
    case "busy":
      return "busy";
    case "cancel":
      return "cancelled";
    case "failed":
      return "failed";
    default:
      return finishReason || "unknown";
  }
}

// Helper to sync call to HubSpot
async function syncCallToHubSpot(
  manager: HubSpotSyncManager,
  call: any,
): Promise<string | null> {
  // 1. Find Contact
  const phone = call.caller_number;
  if (!phone || phone === "unknown") return null;

  // Clean phone number for search (strip + and spaces)
  const cleanPhone = phone.replace(/[^\d]/g, "");

  // Search for contact
  const searchResult = await manager.fetchHubSpot("contacts", {
    filterGroups: [
      {
        filters: [
          {
            propertyName: "phone",
            operator: "CONTAINS_TOKEN",
            value: cleanPhone,
          },
        ],
      },
      {
        filters: [
          {
            propertyName: "mobilephone",
            operator: "CONTAINS_TOKEN",
            value: cleanPhone,
          },
        ],
      },
      {
        filters: [
          { propertyName: "hs_object_id", operator: "EQ", value: cleanPhone },
        ],
      }, // Fallback if phone is ID (rare)
    ],
    limit: 1,
  });

  const contactId = searchResult.results[0]?.id;

  if (!contactId) {
    console.log(`No HubSpot contact found for phone ${phone}`);
    return null;
  }

  // 1.5 Check if Contact is Unassigned - If so, Assign to Caller
  if (call.hubspot_owner_id) {
    try {
      // Fetch current owner
      const contactResponse = await manager.fetchHubSpot("contacts", {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "hs_object_id",
                operator: "EQ",
                value: contactId,
              },
            ],
          },
        ],
        properties: ["hubspot_owner_id"],
        limit: 1,
      });

      const currentOwner =
        contactResponse.results[0]?.properties?.hubspot_owner_id;

      // If unassigned, assign to the person who took the call
      if (!currentOwner) {
        console.log(
          `[Lead Assignment] Contact ${contactId} is unassigned. Assigning to caller ${call.hubspot_owner_id}`,
        );

        await fetch(
          `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${Deno.env.get("HUBSPOT_ACCESS_TOKEN")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              properties: { hubspot_owner_id: call.hubspot_owner_id },
            }),
          },
        );
      }
    } catch (assignError) {
      console.error(
        `[Lead Assignment] Failed to assign contact ${contactId}:`,
        assignError,
      );
    }
  }

  // 2. Create Call Object
  const properties = {
    hs_call_title: `Call from ${phone}`,
    hs_call_status:
      call.call_status === "completed"
        ? "COMPLETED"
        : call.call_status === "missed"
          ? "MISSED"
          : "BUSY",
    hs_call_duration: Math.round(
      (call.duration_seconds || 0) * 1000,
    ).toString(), // ms
    hs_timestamp: new Date(call.started_at || Date.now()).getTime().toString(),
    hs_call_body: `Call outcome: ${call.call_outcome}. Recording: ${call.recording_url || "None"}`,
    hs_call_from_number: call.caller_number,
    hubspot_owner_id: call.hubspot_owner_id,
    hs_call_recording_url: call.recording_url,
    hs_call_direction:
      call.call_direction === "inbound" ? "INBOUND" : "OUTBOUND",
  };

  // 3. Create Engagement
  const endpoint = `https://api.hubapi.com/crm/v3/objects/calls`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("HUBSPOT_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties,
      associations: [
        {
          to: { id: contactId },
          types: [
            { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 194 },
          ], // 194 is call_to_contact
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    // Ignore if it's just a duplicate (conflict)
    if (response.status === 409) return null;
    throw new Error(`HubSpot Call Create Error: ${text}`);
  }

  const data = await response.json();
  return data.id;
}

function normalizeUAEPhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.substring(2);
  if (cleaned.startsWith('0') && !cleaned.startsWith('00')) cleaned = '+971' + cleaned.substring(1);
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned;
  return cleaned;
}

function parsePtdOutcome(tags: any[], isLost: boolean, finishReason: string): string {
  if (tags && Array.isArray(tags) && tags.length > 0) {
    const tagStr = tags.map((t: any) => (typeof t === 'string' ? t : t.name || t.tag_name || '')).join(' ').toLowerCase();
    if (tagStr.includes('not processed')) return 'Not Processed';
    if (tagStr.includes('processed')) return 'Processed';
    if (tagStr.includes('not_interested') || tagStr.includes('not interested')) return 'Not Interested';
    if (tagStr.includes('interested')) return 'Interested';
    if (tagStr.includes('booked') || tagStr.includes('appointment')) return 'Assessment Booked';
    if (tagStr.includes('callback') || tagStr.includes('call back')) return 'Callback Requested';
    if (tagStr.includes('wrong')) return 'Wrong Number';
  }
  if (isLost) return 'Lost Call';
  const fr = (finishReason || '').toLowerCase();
  if (fr === 'answered' || fr === 'completed') return 'Completed - No Tag';
  return 'Unknown';
}

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const HUBSPOT_ACCESS_TOKEN = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
    const hubspotManager = HUBSPOT_ACCESS_TOKEN
      ? new HubSpotSyncManager(supabase, HUBSPOT_ACCESS_TOKEN)
      : null;

    const CALLGEAR_API_KEY = Deno.env.get("CALLGEAR_API_KEY");
    if (!CALLGEAR_API_KEY) {
      throw new Error("CALLGEAR_API_KEY not set");
    }

    const {
      date_from,
      date_to,
      limit = 1000,
    } = await req.json().catch(() => ({}));

    // Default to last 30 days if no date range provided
    // Use Dubai timezone for date calculations
    const getDubaiDate = (d: Date) => {
      return d.toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
    };

    const now = new Date();
    // COST OPTIMIZATION: Default to 1 day instead of 30 days to prevent "retry storms"
    // If we fetch 30 days every 10 mins, we retry failed calls thousands of times.
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const toDate = date_to || getDubaiDate(now);
    const fromDate = date_from || getDubaiDate(oneDayAgo);

    console.log(`Fetching CallGear data from ${fromDate} to ${toDate}`);

    // CallGear Data API - CORRECT endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch("https://dataapi.callgear.com/v2.0", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "get.calls_report",
        params: {
          access_token: CALLGEAR_API_KEY,
          date_from: `${fromDate} 00:00:00`,
          date_till: `${toDate} 23:59:59`,
          limit: limit,
          // Request specific fields for call data
          fields: [
            "id",
            "start_time",
            "finish_time",
            "talk_duration",
            "total_duration",
            "contact_phone_number",
            "virtual_phone_number",
            "employees",
            "finish_reason",
            "direction",
            "is_lost",
            "call_records",
            "tags",
            "comment"
          ],
        },
        id: 1,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`CallGear API error: ${response.status} ${text}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`CallGear API error: ${JSON.stringify(data.error)}`);
    }

    // Fetch staff mapping from Supabase
    const { data: staffData } = await supabase
      .from("staff")
      .select("name, hubspot_owner_id")
      .not("hubspot_owner_id", "is", null);

    // Employee Mapping Configuration — complete HubSpot owner IDs
    const OWNER_MAPPING: Record<string, string> = {
      "Yehia": "78722672",
      "James": "80616467",
      "Mazen": "82655976",
      "Matthew": "452974662",
      "Tea": "48899890",
      "Milos": "48877837",
      "Marko Antic": "49635184",
      "Marko Katanic": "83968361",
      "Marko Savicevic": "527299598",
      "Philips": "85674007",
      "Sanja": "79521059",
      "Rhanilyn": "78112417",
      "Anil": "77782374",
      "Rebecca": "87154383",
      "Ashal": "87925091",
      "Marija": "498087079",
      "Andre": "81100166",
      "Nevena": "48899839",
      "Filip": "51592904",
    };

    // Merge database staff into mapping
    if (staffData) {
      staffData.forEach((staff: any) => {
        const staffName = staff.name;
        if (staffName && staff.hubspot_owner_id) {
          const firstName = staffName.split(" ")[0];
          if (firstName) {
            OWNER_MAPPING[firstName] = staff.hubspot_owner_id;
          }
          OWNER_MAPPING[staffName] = staff.hubspot_owner_id;
        }
      });
    }

    const getHubSpotOwnerId = (employees: any): { ownerId: string | null; ownerName: string | null } => {
      if (!employees) return { ownerId: null, ownerName: null };

      const employeeList = Array.isArray(employees) ? employees : [employees];

      for (const emp of employeeList) {
        const name =
          typeof emp === "string"
            ? emp
            : emp.name || emp.full_name || emp.employee_name;

        if (!name) continue;

        const nameLower = name.toLowerCase();

        // Priority 1: Full-name exact match
        for (const [key, id] of Object.entries(OWNER_MAPPING)) {
          if (key.includes(" ") && nameLower === key.toLowerCase()) {
            return { ownerId: id, ownerName: key };
          }
        }

        // Priority 2: Full-name contains match (for "Marko Antic" in "Marko Antic - Sales")
        for (const [key, id] of Object.entries(OWNER_MAPPING)) {
          if (key.includes(" ") && nameLower.includes(key.toLowerCase())) {
            return { ownerId: id, ownerName: key };
          }
        }

        // Priority 3: First-name partial match (skip multi-word keys to avoid "Marko" matching wrong Marko)
        for (const [key, id] of Object.entries(OWNER_MAPPING)) {
          if (!key.includes(" ") && nameLower.includes(key.toLowerCase())) {
            return { ownerId: id, ownerName: key };
          }
        }
      }
      return { ownerId: null, ownerName: null };
    };

    const calls = data.result?.data || data.result?.calls || [];
    console.log(`Received ${calls.length} calls from CallGear`);

    // Map CallGear data to call_records schema and upsert
    const mappedCalls = calls.map((call: any) => {
      const isLost = call.is_lost === true || call.is_lost === 1;
      const talkDuration = call.talk_duration || 0;
      const totalDuration = call.total_duration || talkDuration;
      const { ownerId, ownerName } = getHubSpotOwnerId(call.employees);
      const rawPhone = call.contact_phone_number || "unknown";
      const callerNumber = rawPhone !== "unknown" ? normalizeUAEPhone(rawPhone) : "unknown";
      const ptdOutcome = parsePtdOutcome(call.tags, isLost, call.finish_reason);

      return {
        provider_call_id: call.id?.toString() || null,
        call_status: mapCallStatus(call.finish_reason, isLost),
        call_direction: call.direction === "in" ? "inbound" : "outbound",
        call_outcome: mapCallOutcome(call.finish_reason, isLost),
        caller_number: callerNumber,
        started_at: call.start_time || null,
        ended_at: call.finish_time || null,
        duration_seconds: totalDuration,
        recording_url: call.call_records?.[0]?.file || null,
        caller_city: call.city || null,
        caller_country: call.country || null,
        caller_state: call.region || null,
        hubspot_owner_id: ownerId,
        owner_name: ownerName,
        is_lost: isLost,
        ptd_outcome: ptdOutcome,
        call_type: null as string | null, // will be set after duplicate check below
        transcription_status: call.call_records?.[0] ? "available" : null,
        keywords: call.tags ? call.tags : null,
        ai_summary: call.comment || null,
      };
    });

    // Upsert calls into database (update if provider_call_id exists, insert if new)
    let insertedCount = 0;
    let updatedCount = 0;
    const errors: any[] = [];

    for (const callData of mappedCalls) {
      const call = callData;

      if (!call.provider_call_id) {
        errors.push({ call, error: "Missing provider_call_id" });
        continue;
      }

      // Determine call_type: discovery vs follow_up
      if (call.caller_number && call.caller_number !== "unknown") {
        const { count } = await supabase
          .from("call_records")
          .select("id", { count: "exact", head: true })
          .eq("caller_number", call.caller_number)
          .neq("provider_call_id", call.provider_call_id);
        call.call_type = (count && count > 0) ? "follow_up" : "discovery";
      }

      // Check if call already exists
      const { data: existing } = await supabase
        .from("call_records")
        .select("id, hubspot_engagement_id")
        .eq("provider_call_id", call.provider_call_id)
        .single();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from("call_records")
          .update({
            ...call,
            updated_at: new Date().toISOString(),
          })
          .eq("provider_call_id", call.provider_call_id);

        if (error) {
          errors.push({ call, error: error.message });
        } else {
          updatedCount++;
        }

        // Sync ALL calls (including lost/missed) to HubSpot
        // COST OPTIMIZATION: Only retry if call is recent (< 2 hours old)
        // This prevents infinite retries for calls that permanently fail (e.g. data errors)
        const callTime = new Date(call.started_at || new Date()).getTime();
        const isRecent = Date.now() - callTime < 2 * 60 * 60 * 1000;

        if (hubspotManager && !existing.hubspot_engagement_id && isRecent) {
          try {
            const hubspotId = await syncCallToHubSpot(hubspotManager, callData);
            if (hubspotId) {
              await supabase
                .from("call_records")
                .update({ hubspot_engagement_id: hubspotId })
                .eq("id", existing.id);
              console.log(
                `Synced call ${call.provider_call_id} to HubSpot: ${hubspotId}`,
              );
            }
          } catch (hsError) {
            console.error(
              `Failed to sync call ${call.provider_call_id} to HubSpot:`,
              hsError,
            );
          }
        }
      } else {
        // Insert new record
        const { data: inserted, error } = await supabase
          .from("call_records")
          .insert(call)
          .select("id")
          .single();

        if (error) {
          errors.push({ call, error: error.message });
        } else {
          insertedCount++;

          // Sync to HubSpot if new and manager available
          // Sync ALL calls (including lost/missed) to HubSpot
          if (hubspotManager && inserted) {
            try {
              const hubspotId = await syncCallToHubSpot(
                hubspotManager,
                callData,
              );
              if (hubspotId) {
                await supabase
                  .from("call_records")
                  .update({ hubspot_engagement_id: hubspotId })
                  .eq("id", inserted.id);
                console.log(
                  `Synced new call ${call.provider_call_id} to HubSpot: ${hubspotId}`,
                );
              }
            } catch (hsError) {
              console.error(
                `Failed to sync new call ${call.provider_call_id} to HubSpot:`,
                hsError,
              );
            }
          }
        }
      }
    }

    console.log(
      `Processed ${mappedCalls.length} calls: ${insertedCount} inserted, ${updatedCount} updated, ${errors.length} errors`,
    );

    // Return summary
    return apiSuccess({
        success: true,
        summary: {
          total_fetched: calls.length,
          inserted: insertedCount,
          updated: updatedCount,
          errors: errors.length,
        },
        errors: errors.length > 0 ? errors : undefined,
        date_range: {
          from: fromDate,
          to: toDate,
        },
      });
  } catch (error: unknown) {
    console.error("Error:", error);
    return apiError("INTERNAL_ERROR", JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }), 500);
  }
});
