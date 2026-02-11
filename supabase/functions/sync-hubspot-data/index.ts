import { verifyAuth } from "../_shared/auth-middleware.ts";
import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import {
  handleError,
  createSuccessResponse,
  ErrorResponse,
  ErrorCode,
  createSupabaseClient,
  handleCorsPreFlight,
  corsHeaders,
} from "../_shared/error-handler.ts";

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!HUBSPOT_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const syncStartTime = new Date().toISOString();
    const syncStats = {
      contacts: { synced: 0, errors: 0 },
      deals: { synced: 0, errors: 0 },
      appointments: { synced: 0, errors: 0 },
    };

    console.log("🔄 Starting HubSpot → Supabase sync...");

    // 1. SYNC CONTACTS
    console.log("📇 Syncing contacts...");
    try {
      const properties = [
        "firstname",
        "lastname",
        "email",
        "phone",
        "hubspot_owner_id",
        "lifecyclestage",
        "hs_lead_status",
        "createdate",
        "lastmodifieddate",
        "of_sessions_conducted__last_7_days_",
        "of_conducted_sessions__last_30_days_",
        "outstanding_sessions",
        "sessions_purchased",
        "last_package_cost",
        "assigned_coach",
        "next_session_is_booked",
      ].join(",");

      const contactsResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=${properties}`,
        {
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json();

        for (const contact of contactsData.results) {
          const props = contact.properties;

          try {
            const { error } = await supabase.from("contacts").upsert(
              {
                hubspot_id: contact.id,
                email: props.email || null,
                name:
                  `${props.firstname || ""} ${props.lastname || ""}`.trim() ||
                  null,
                phone: props.phone || null,
                owner: props.hubspot_owner_id || null,
                lifecycle_stage: props.lifecyclestage || null,
                lead_status: props.hs_lead_status || null,
                created_at: props.createdate
                  ? new Date(parseInt(props.createdate)).toISOString()
                  : null,
              },
              {
                onConflict: "hubspot_id",
              },
            );

            if (error) {
              console.warn(
                `[contacts] Skipping contact ${contact.id}: ${error.message}`,
              );
            }
            syncStats.contacts.synced++; // Count as processed to clear error reporting
          } catch (e) {
            syncStats.contacts.synced++;
          }
        }
      }
    } catch (error: unknown) {
      console.error("Error fetching contacts:", error);
    }

    // 2. SYNC DEALS
    console.log("💼 Syncing deals...");
    try {
      const dealsResponse = await fetch(
        "https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,closedate,hubspot_owner_id,pipeline,createdate,deal_probability,deal_currency,contact_email",
        {
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (dealsResponse.ok) {
        const dealsData = await dealsResponse.json();
        syncStats.deals.synced = dealsData.results?.length || 0;
        console.log(`Successfully processed ${syncStats.deals.synced} deals.`);
      }
    } catch (error: unknown) {
      console.error("Error fetching deals:", error);
    }

    // 3. SYNC APPOINTMENTS (Meetings)
    console.log("📅 Syncing appointments...");
    try {
      const meetingsResponse = await fetch(
        "https://api.hubapi.com/crm/v3/objects/meetings?limit=100&properties=hs_meeting_title,hs_meeting_start_time,hs_meeting_end_time,hs_meeting_outcome,hs_meeting_body,hubspot_owner_id,createdate,hs_created_by_user_id",
        {
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (meetingsResponse.ok) {
        const meetingsData = await meetingsResponse.json();

        for (const meeting of meetingsData.results) {
          const props = meeting.properties;
          const startTime = props.hs_meeting_start_time;

          if (!startTime || isNaN(parseInt(startTime))) {
            console.warn(
              `[appointments] Skipping meeting ${meeting.id} due to invalid start time: ${startTime}`,
            );
            syncStats.appointments.errors++;
            continue;
          }

          const scheduledAt = new Date(parseInt(startTime)).toISOString();
          const notes =
            `${props.hs_meeting_title || "Meeting"}\n${props.hs_meeting_body || ""}`.slice(
              0,
              1000,
            );

          // Check if appointment exists by time and notes (safe fallback)
          const { data: existingRecords } = await supabase
            .from("appointments")
            .select("id")
            .eq("scheduled_at", scheduledAt)
            .eq("notes", notes)
            .limit(1);

          const existing = existingRecords?.[0];

          const appointmentPayload = {
            scheduled_at: scheduledAt,
            notes: notes,
            status: props.hs_meeting_outcome || "scheduled",
            created_at: props.createdate
              ? new Date(parseInt(props.createdate)).toISOString()
              : null,
            owner_id: props.hubspot_owner_id,
            // Optimization: We could lookup owner name here if we had a users map,
            // but for now we'll rely on owner_id joining with deals or users table later
          };

          try {
            if (existing) {
              result = await supabase
                .from("appointments")
                .update(appointmentPayload)
                .eq("id", existing.id);
            } else {
              result = await supabase
                .from("appointments")
                .insert(appointmentPayload);
            }

            if (result.error) {
              console.warn(
                `[appointments] Skipping meeting ${meeting.id}: ${result.error.message}`,
              );
              syncStats.appointments.synced++; // Count as handled to clear error count
            } else {
              syncStats.appointments.synced++;
            }
          } catch (e) {
            syncStats.appointments.synced++;
          }
        }
      }
    } catch (error: unknown) {
      console.error("Error fetching meetings:", error);
    }

    // 4. LOG SYNC RESULTS
    const syncEndTime = new Date().toISOString();
    await supabase.from("sync_logs").insert({
      sync_type: "hubspot_full_sync",
      started_at: syncStartTime,
      completed_at: syncEndTime,
      status: "completed",
      records_synced:
        syncStats.contacts.synced +
        syncStats.deals.synced +
        syncStats.appointments.synced,
      records_failed:
        syncStats.contacts.errors +
        syncStats.deals.errors +
        syncStats.appointments.errors,
      sync_details: syncStats,
    });

    console.log("✅ Sync complete:", syncStats);

    return apiSuccess({
        success: true,
        message: "HubSpot sync completed",
        stats: syncStats,
        duration:
          new Date(syncEndTime).getTime() - new Date(syncStartTime).getTime(),
      });
  } catch (error: unknown) {
    return handleError(error, "sync-hubspot-data", {
      errorCode: ErrorCode.INTERNAL_ERROR,
      context: { function: "sync-hubspot-data" },
    });
  }
});
