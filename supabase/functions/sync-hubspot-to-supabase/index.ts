import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import { HubSpotManager } from "../_shared/hubspot-manager.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Batch size for processing - smaller batches prevent CPU timeout
const BATCH_SIZE = 100;
const MAX_RECORDS_PER_SYNC = 1000; // Process 1000 at a time, call again for more

serve(async (req) => {
  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  const startTime = Date.now();

  try {
    const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!HUBSPOT_API_KEY) {
      throw new Error("HUBSPOT_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json().catch(() => ({}));
    const {
      clear_fake_data = false,
      sync_type = "all",
      incremental = true,
      cursor = null, // Resume cursor for pagination
      batch_mode = true, // Process in batches
    } = body;

    console.log(
      `Starting sync: type=${sync_type}, incremental=${incremental}, cursor=${cursor || "none"}`,
    );

    const results = {
      contacts_synced: 0,
      leads_synced: 0,
      deals_synced: 0,
      calls_synced: 0,
      errors: [] as string[],
      mode: incremental ? "incremental" : "full",
      next_cursor: null as string | null,
      has_more: false,
      processing_time_ms: 0,
    };

    // Get last sync timestamp for incremental sync
    let lastSyncTime: string | null = null;
    if (incremental && !cursor) {
      const { data: lastSync } = await supabase
        .from("sync_logs")
        .select("completed_at")
        .eq("platform", "hubspot")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1);

      if (lastSync?.[0]?.completed_at) {
        lastSyncTime = lastSync[0].completed_at;
        console.log(`Incremental sync from: ${lastSyncTime}`);
      } else {
        // First sync - only get last 7 days to start
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        lastSyncTime = sevenDaysAgo.toISOString();
        console.log(`First sync - fetching from: ${lastSyncTime}`);
      }
    }

    // Clear fake/test data if requested
    // Patterns match detectTestData.ts: @example.com, @email.com, @test.com, phone 555-0, deals with test/fake
    if (clear_fake_data && !cursor) {
      console.log("Clearing fake data...");

      // Clear leads - all test email patterns + test phone numbers
      await supabase
        .from("leads")
        .delete()
        .or(
          "email.ilike.%@example.com,email.ilike.%@email.com,email.ilike.%@test.com,phone.ilike.%555-0%",
        );

      // Clear contacts - all test email patterns (matches detectTestData.ts)
      await supabase
        .from("contacts")
        .delete()
        .or(
          "email.ilike.%@example.com,email.ilike.%@email.com,email.ilike.%@test.com",
        );

      // Clear enhanced_leads - all test email patterns
      await supabase
        .from("enhanced_leads")
        .delete()
        .or(
          "email.ilike.%@example.com,email.ilike.%@email.com,email.ilike.%@test.com",
        );

      // Clear fake deals (test/fake names)
      // NOTE: Removed hubspot_deal_id IS NULL check - could delete legitimate manual deals
      await supabase.from("deals").delete().ilike("deal_name", "%test%");
      await supabase.from("deals").delete().ilike("deal_name", "%fake%");

      console.log("Fake data cleared");
    }

    // Fetch staff for UUID resolution
    const { data: staffList } = await supabase
      .from("staff")
      .select("id, full_name, hubspot_owner_id");

    const staffByHubSpotId: Record<string, string> = {};
    const staffByName: Record<string, string> = {};

    staffList?.forEach((s) => {
      if (s.hubspot_owner_id) staffByHubSpotId[s.hubspot_owner_id] = s.id;
      if (s.full_name) staffByName[s.full_name.toLowerCase()] = s.id;
    });

    // Fetch owners for mapping (cache this)
    let ownerMap: Record<string, string> = {};
    try {
      const ownersResponse = await fetch(
        "https://api.hubapi.com/crm/v3/owners",
        {
          headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` },
        },
      );
      if (ownersResponse.ok) {
        const ownersData = await ownersResponse.json();
        ownerMap = Object.fromEntries(
          ownersData.results.map((o: any) => [
            o.id,
            `${o.firstName} ${o.lastName}`,
          ]),
        );
      }
    } catch (e) {
      console.warn("Failed to fetch owners, continuing without names");
    }

    // Optimized batch fetching with cursor support
    async function fetchBatchHubSpot(
      objectType: string,
      properties: string[],
      afterCursor?: string,
      filterAfter?: string,
    ): Promise<{ results: any[]; nextCursor: string | null }> {
      const filterGroups = filterAfter
        ? [
            {
              filters: [
                {
                  propertyName: "hs_lastmodifieddate",
                  operator: "GTE",
                  value: new Date(filterAfter).getTime().toString(),
                },
              ],
            },
          ]
        : [];

      const fetchResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/${objectType}/search`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filterGroups,
            properties,
            sorts: [
              { propertyName: "hs_lastmodifieddate", direction: "DESCENDING" },
            ],
            limit: BATCH_SIZE,
            after: afterCursor || undefined,
          }),
        },
      );

      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        throw new Error(`HubSpot API error for ${objectType}: ${errorText}`);
      }

      const jsonData = await fetchResponse.json();
      return {
        results: jsonData.results || [],
        nextCursor: jsonData.paging?.next?.after || null,
      };
    }

    // Process contacts in batches
    if (sync_type === "all" || sync_type === "contacts") {
      try {
        let processedCount = 0;
        let currentCursor = cursor;

        while (processedCount < MAX_RECORDS_PER_SYNC) {
          const { results: contacts, nextCursor } = await fetchBatchHubSpot(
            "contacts",
            [
              "firstname",
              "lastname",
              "email",
              "phone",
              "mobilephone",
              "hubspot_owner_id",
              "lifecyclestage",
              "hs_lead_status",
              "createdate",
              "lastmodifieddate",
              "city",
              "hs_object_id",
              "jobtitle",
              "hs_analytics_source",
              "hs_analytics_source_data_1",
              "hs_analytics_first_touch_converting_campaign",
              "hs_analytics_last_touch_converting_campaign",
              // UTM Parameters (Critical for Facebook/Google attribution)
              "utm_source",
              "utm_medium",
              "utm_campaign",
              "utm_content",
              "utm_term",
              "hs_analytics_first_url",
              "hs_analytics_last_url",
              "num_contacted_notes",
              "custom_lifecycle_stage",
              "first_conversion_date",
              "num_form_submissions",
              "num_unique_forms_submitted",
              "recent_conversion_event_name",
              "recent_conversion_date",
              "hubspot_team_id",
              "hs_sa_first_engagement_descr",
              "hs_date_entered_lead",
              "contact_unworked",
              "hs_is_unworked",
              "hs_last_sales_activity_date",
              "hs_email_domain",
              // Company Information
              "company",
              "company_name",
              "company_size",
              "industry",
              "website",
              "domain",
              // Deal & Revenue
              "num_associated_deals",
              "total_revenue",
              "hs_analytics_num_visits",
              "hs_analytics_num_page_views",
              "hs_analytics_num_event_completions",
              // Custom Properties (PTD-specific)
              "assigned_coach",
              "assessment_scheduled",
              "assessment_date",
              "package_type",
              "sessions_purchased",
              "outstanding_sessions",
              "coach_notes",
              "preferred_location",
              "fitness_goals",
              // Session Activity Fields (for Health Score Calculation)
              "of_sessions_conducted__last_7_days_",
              "of_conducted_sessions__last_30_days_",
              "of_sessions_conducted__last_90_days_",
              "last_paid_session_date",
              "next_session_is_booked",
              "of_future_booked_sessions",
              "last_package_cost",
              // Engagement Scores
              "hs_analytics_score",
              "hs_social_facebook_clicks",
              "hs_social_twitter_clicks",
              "hs_social_linkedin_clicks",
              "num_notes",
              "num_meetings",
              "num_emails",
              "num_emails_sent",
              "num_emails_opened",
              "num_emails_clicked",
              "notes_last_contacted",
              "notes_last_contacted_date",
              "hs_last_meeting_booked_date",
              "hs_next_activity_date",
              // Communication Preferences
              "hs_email_opt_out",
              "hs_marketing_opt_out",
              "preferred_contact_method",
              "timezone",
              "language",
              // Social Media
              "twitterhandle",
              "linkedinbio",
              "linkedinconnections",
              "twitterfollowers",
              // Analytics
              "hs_analytics_first_visit",
              "hs_analytics_last_visit",
              // AnyTrack Tracking IDs
              "atclid",
              "satid",
            ],
            currentCursor || undefined,
            incremental ? lastSyncTime || undefined : undefined,
          );

          if (contacts.length === 0) break;

          // Batch upsert contacts
          const contactsToUpsert = contacts
            .filter((c: any) => c.properties?.email)
            .map((contact: any) => {
              const props = contact.properties;
              const ownerId = props.hubspot_owner_id || "unassigned";
              const ownerName = props.hubspot_owner_id
                ? ownerMap[props.hubspot_owner_id] || "Unassigned / Admin"
                : "Unassigned / Admin";

              // Resolve UUIDs
              const setterUuid = props.hubspot_owner_id
                ? staffByHubSpotId[props.hubspot_owner_id]
                : null;
              const coachUuid = props.assigned_coach
                ? staffByName[props.assigned_coach.toLowerCase()]
                : null;

              // Get associated deal IDs from associations
              const dealIds =
                contact.associations?.deals?.results?.map((d: any) => d.id) ||
                [];

              return {
                hubspot_contact_id: contact.id,
                email: props.email,
                first_name: props.firstname,
                last_name: props.lastname,
                phone: props.phone || props.mobilephone,
                // AnyTrack IDs for CAPI alignment
                facebook_id: props.atclid || null,
                google_id: props.satid || null,
                owner_id: ownerId,
                owner_name: ownerName,
                setter_uuid: setterUuid,
                coach_uuid: coachUuid,
                lifecycle_stage: props.lifecyclestage,
                status: props.hs_lead_status || "active",
                city: props.city,
                location: props.city,
                neighborhood: props.city,
                job_title: props.jobtitle,
                latest_traffic_source: props.hs_analytics_source,
                latest_traffic_source_2: props.hs_analytics_source_data_1,
                // UTM Parameters - Critical for Facebook/Google attribution
                first_touch_source:
                  props.hs_analytics_first_touch_converting_campaign ||
                  props.utm_source ||
                  props.hs_analytics_source,
                last_touch_source:
                  props.hs_analytics_last_touch_converting_campaign || null,
                utm_source: props.utm_source || null,
                utm_medium: props.utm_medium || null,
                utm_campaign: props.utm_campaign || null,
                utm_content: props.utm_content || null,
                utm_term: props.utm_term || null,
                first_page_seen: props.hs_analytics_first_url || null,
                last_page_seen: props.hs_analytics_last_url || null,
                call_attempt_count: parseInt(props.num_contacted_notes) || 0,
                custom_lifecycle_stage: props.custom_lifecycle_stage,
                lead_status: props.hs_lead_status,
                first_conversion_date: props.first_conversion_date || null,
                num_form_submissions: parseInt(props.num_form_submissions) || 0,
                num_unique_forms_submitted:
                  parseInt(props.num_unique_forms_submitted) || 0,
                recent_conversion: props.recent_conversion_event_name,
                recent_conversion_date: props.recent_conversion_date || null,
                hubspot_team: props.hubspot_team_id,
                sla_first_touch: props.hs_sa_first_engagement_descr,
                time_of_entry: props.hs_date_entered_lead || null,
                contact_unworked:
                  props.hs_is_unworked === "true" ||
                  props.contact_unworked === "true",
                last_activity_date: props.hs_last_sales_activity_date || null,
                email_domain: props.hs_email_domain,
                // Company Information
                company_name: props.company || props.company_name || null,
                company_id: props.company_id || null,
                company_size: props.company_size || null,
                industry: props.industry || null,
                website: props.website || null,
                company_domain: props.domain || null,
                // Deal & Revenue
                associated_deal_ids: dealIds.length > 0 ? dealIds : null,
                total_deal_value: parseFloat(props.total_revenue) || 0,
                num_associated_deals:
                  parseInt(props.num_associated_deals) || dealIds.length,
                // Custom Properties (PTD-specific)
                assigned_coach: props.assigned_coach || null,
                assessment_scheduled:
                  props.assessment_scheduled === "true" ||
                  props.assessment_scheduled === true ||
                  false,
                assessment_date: props.assessment_date || null,
                package_type: props.package_type || null,
                sessions_purchased: parseInt(props.sessions_purchased) || 0,
                outstanding_sessions: parseInt(props.outstanding_sessions) || 0,
                coach_notes: props.coach_notes || null,
                preferred_location: props.preferred_location || null,
                fitness_goals: props.fitness_goals || null,
                // Session Activity Fields (for Health Score Calculation)
                sessions_last_7d:
                  parseInt(props.of_sessions_conducted__last_7_days_) || 0,
                sessions_last_30d:
                  parseInt(props.of_conducted_sessions__last_30_days_) || 0,
                sessions_last_90d:
                  parseInt(props.of_sessions_conducted__last_90_days_) || 0,
                last_paid_session_date: props.last_paid_session_date || null,
                next_session_is_booked:
                  props.next_session_is_booked === "Y" ||
                  props.next_session_is_booked === "Yes" ||
                  props.next_session_is_booked === "true" ||
                  false,
                future_booked_sessions:
                  parseInt(props.of_future_booked_sessions) || 0,
                last_package_cost: parseFloat(props.last_package_cost) || 0,
                // Engagement Scores
                analytics_score: parseInt(props.hs_analytics_score) || 0,
                facebook_clicks: parseInt(props.hs_social_facebook_clicks) || 0,
                twitter_clicks: parseInt(props.hs_social_twitter_clicks) || 0,
                linkedin_clicks: parseInt(props.hs_social_linkedin_clicks) || 0,
                num_notes: parseInt(props.num_notes) || 0,
                num_meetings: parseInt(props.num_meetings) || 0,
                num_emails: parseInt(props.num_emails) || 0,
                num_emails_sent: parseInt(props.num_emails_sent) || 0,
                num_emails_opened: parseInt(props.num_emails_opened) || 0,
                num_emails_clicked: parseInt(props.num_emails_clicked) || 0,
                last_email_sent_date: props.notes_last_contacted_date || null,
                last_meeting_date: props.hs_last_meeting_booked_date || null,
                next_meeting_date: props.hs_next_activity_date || null,
                // Communication Preferences
                email_opt_out:
                  props.hs_email_opt_out === "true" ||
                  props.hs_email_opt_out === true ||
                  false,
                marketing_opt_out:
                  props.hs_marketing_opt_out === "true" ||
                  props.hs_marketing_opt_out === true ||
                  false,
                preferred_contact_method:
                  props.preferred_contact_method || null,
                timezone: props.timezone || null,
                language: props.language || null,
                // Social Media
                twitter_handle: props.twitterhandle || null,
                linkedin_bio: props.linkedinbio || null,
                linkedin_connections:
                  parseInt(props.linkedinconnections) || null,
                twitter_followers: parseInt(props.twitterfollowers) || null,
                // Analytics
                num_visits: parseInt(props.hs_analytics_num_visits) || 0,
                num_page_views:
                  parseInt(props.hs_analytics_num_page_views) || 0,
                num_event_completions:
                  parseInt(props.hs_analytics_num_event_completions) || 0,
                first_visit_date: props.hs_analytics_first_visit || null,
                last_visit_date: props.hs_analytics_last_visit || null,
                created_at: props.createdate,
                updated_at: props.lastmodifieddate || new Date().toISOString(),
              };
            });

          // Enrich contacts with Facebook ad attribution from attribution_events
          if (contactsToUpsert.length > 0) {
            const emails = contactsToUpsert.map((c: any) => c.email).filter(Boolean);
            if (emails.length > 0) {
              const { data: attrEvents } = await supabase
                .from("attribution_events")
                .select("email, fb_ad_id, fb_campaign_id, fb_adset_id, source, event_time")
                .in("email", emails)
                .order("event_time", { ascending: false });

              if (attrEvents?.length) {
                // Build map: email → latest attribution event (first occurrence = latest due to DESC order)
                const attrByEmail = new Map<string, typeof attrEvents[0]>();
                for (const ae of attrEvents) {
                  if (!attrByEmail.has(ae.email)) {
                    attrByEmail.set(ae.email, ae);
                  }
                }
                for (const contact of contactsToUpsert) {
                  const attr = attrByEmail.get(contact.email);
                  if (attr) {
                    (contact as any).attributed_ad_id = attr.fb_ad_id;
                    (contact as any).attributed_campaign_id = attr.fb_campaign_id;
                    (contact as any).attributed_adset_id = attr.fb_adset_id;
                    (contact as any).attribution_source = attr.source;
                  }
                }
              }
            }
          }

          if (contactsToUpsert.length > 0) {
            const { error: contactError } = await supabase
              .from("contacts")
              .upsert(contactsToUpsert, {
                onConflict: "hubspot_contact_id",
                ignoreDuplicates: false,
              });

            if (contactError) {
              results.errors.push(`Contacts batch: ${contactError.message}`);
            } else {
              results.contacts_synced += contactsToUpsert.length;
            }

            // Also sync to leads table (batch)
            const leadsToUpsert = contacts
              .filter((c: any) => c.properties?.email)
              .map((contact: any) => {
                const props = contact.properties;
                // Matthew and other Contact Owners are SETTERS
                const setterId = props.hubspot_owner_id || "unassigned";
                const setterName = props.hubspot_owner_id
                  ? ownerMap[props.hubspot_owner_id] || "Unassigned / Admin"
                  : "Unassigned / Admin";
                // Assigned Coach is the CLOSER
                const closerName = props.assigned_coach || null;

                // Resolve UUIDs
                const setterUuid = props.hubspot_owner_id
                  ? staffByHubSpotId[props.hubspot_owner_id]
                  : null;
                const coachUuid = props.assigned_coach
                  ? staffByName[props.assigned_coach.toLowerCase()]
                  : null;

                return {
                  hubspot_id: contact.id,
                  email: props.email,
                  first_name: props.firstname,
                  last_name: props.lastname,
                  phone: props.phone || props.mobilephone,
                  source: "hubspot",
                  status: mapHubspotStatusToLead(
                    props.lifecyclestage,
                    props.hs_lead_status,
                  ),
                  owner_id: setterId, // This is the Setter ID
                  assigned_coach: closerName, // This is the Closer
                  setter_uuid: setterUuid,
                  coach_uuid: coachUuid,
                  created_at: props.createdate,
                };
              });

            const { error: leadsError } = await supabase
              .from("leads")
              .upsert(leadsToUpsert, {
                onConflict: "hubspot_id",
                ignoreDuplicates: false,
              });

            if (leadsError) {
              console.error("Leads sync error:", leadsError.message);
              results.errors.push(`Leads batch: ${leadsError.message}`);
            } else {
              results.leads_synced += leadsToUpsert.length;
            }
          }

          processedCount += contacts.length;
          currentCursor = nextCursor;

          // Check if we should stop and save cursor for next call
          if (!nextCursor || processedCount >= MAX_RECORDS_PER_SYNC) {
            results.next_cursor = nextCursor;
            results.has_more = !!nextCursor;
            break;
          }

          console.log(`Processed ${processedCount} contacts, continuing...`);
        }
      } catch (err: any) {
        results.errors.push(`Contacts Sync Error: ${err.message}`);
      }
    }

    // Sync Deals (only if not resuming contacts)
    if ((sync_type === "all" || sync_type === "deals") && !cursor) {
      try {
        const { results: searchResults } = await fetchBatchHubSpot(
          "deals",
          [
            "dealname",
            "dealstage",
            "amount",
            "pipeline",
            "closedate",
            "hubspot_owner_id",
            "createdate",
          ],
          undefined,
          incremental ? lastSyncTime || undefined : undefined,
        );

        if (searchResults.length > 0) {
          // ENRICHMENT STEP: Fetch Associations via Separate Batch API
          // The deals/search endpoint doesn't give associations, and deals/batch/read often ignores it.
          // We use the dedicated Associations API: /crm/v3/associations/deals/contacts/batch/read
          const dealIds = searchResults.map((d: any) => ({ id: d.id }));

          const assocResponse = await fetch(
            "https://api.hubapi.com/crm/v3/associations/deals/contacts/batch/read",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${HUBSPOT_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ inputs: dealIds }),
            },
          );

          let associationResults: any[] = [];
          if (assocResponse.ok) {
            const assocData = await assocResponse.json();
            associationResults = assocData.results || [];
          } else {
          consconsole.warn("⚠️ Failed to fetch associations batch.");
          }

          // Map Deal ID -> Contact ID (HubSpot)
          const dealToContactHSId: Record<string, string> = {};
          associationResults.forEach((res: any) => {
            const dealId = res.from.id;
            const contactId = res.to?.[0]?.id; // Take first contact
            if (dealId && contactId) {
              dealToContactHSId[dealId] = contactId;
            }
          });

          //consOOKUP STEP: Resolve HubSpot Contact IDs to Supabase UUIDs
          const uniqueHSContactIds = Object.values(dealToContactHSId);

          let contactMap: Record<string, string> = {}; // HS_ID -> UUID

          if (uniqueHSContactIds.length > 0) {
            // Fetch Supabase UUIDs for these HubSpot Contacts
            const { data: contactMatches } = await supabase
              .from("contacts")
              .select("id, hubspot_contact_id")
              .in("hubspot_contact_id", uniqueHSContactIds);

            if (contactMatches) {
              contactMatches.forEach((c: any) => {
                contactMap[c.hubspot_contact_id] = c.id;
              });
            }
          }

          const dealsToUpsert = searchResults.map((deal: any) => {
            // Resolve Link: HubSpot contact ID → Supabase UUID
            const hsContactId = dealToContactHSId[deal.id];
            const resolvedUUID = hsContactId ? contactMap[hsContactId] : null;

            // Resolve deal owner name from owner map
            const dealOwnerId = deal.properties.hubspot_owner_id || null;
            const dealOwnerName = dealOwnerId
              ? ownerMap[dealOwnerId] || null
              : null;

            return HubSpotManager.mapDealFields(deal, resolvedUUID, dealOwnerName);
          });

          if (dealsToUpsert.length > 0) {
            const { error } = await supabase
              .from("deals")
              .upsert(dealsToUpsert, {
                onConflict: "hubspot_deal_id",
                ignoreDuplicates: false,
              });

            if (error) {
              results.errors.push(`Deals batch: ${error.message}`);
            } else {
              results.deals_synced = dealsToUpsert.length;
            }
          }
        }
      } catch (err: any) {
        results.errors.push(`Deals Sync Error: ${err.message}`);
      }
    }

    // Sync Calls (only if not resuming contacts) - includes Call Gear data
    if ((sync_type === "all" || sync_type === "calls") && !cursor) {
      try {
        const { results: calls } = await fetchBatchHubSpot(
          "calls",
          [
            // Standard HubSpot call properties
            "hs_call_title",
            "hs_call_status",
            "hs_call_duration",
            "hs_timestamp",
            "hs_call_to_number",
            "hs_call_from_number",
            "hubspot_owner_id",
            "hs_call_disposition",
            "hs_call_direction",
            "hs_call_body",
            "hs_call_recording_url",
            // Call Gear custom properties
            "full_talk_record_link",
            "total_talk_duration",
            "total_waiting_duration",
            "call_finish_date_and_time",
            "call_finish_reason",
            "called_phone_number",
            "postprocessing_time",
            "hs_activity_type",
          ],
          undefined,
          incremental ? lastSyncTime || undefined : undefined,
        );

        // Log first call properties to debug Call Gear data
        if (calls.length > 0) {
          console.log(
            "📞 Sample call properties:",
            JSON.stringify(calls[0].properties, null, 2),
          );
        }

        const callsToUpsert = calls.map((call: any) => {
          const props = call.properties;

          // Parse duration - Call Gear sends "3 minutes and 12 seconds" format
          let durationSeconds = parseInt(props.hs_call_duration) || 0;
          if (props.total_talk_duration) {
            const match = props.total_talk_duration.match(
              /(\d+)\s*minutes?\s*(?:and\s*)?(\d+)?\s*seconds?/i,
            );
            if (match) {
              durationSeconds =
                (parseInt(match[1]) || 0) * 60 + (parseInt(match[2]) || 0);
            }
          }

          // Get recording URL - prefer Call Gear's full_talk_record_link
          const recordingUrl =
            props.full_talk_record_link || props.hs_call_recording_url || null;

          // Map call direction
          const direction =
            props.hs_call_direction?.toLowerCase() ||
            (props.hs_call_from_number ? "outbound" : "inbound");

          return {
            provider_call_id: `hubspot_${call.id}`,
            caller_number:
              props.hs_call_from_number ||
              props.hs_call_to_number ||
              props.called_phone_number ||
              "Unknown",
            call_status: mapHubspotCallStatus(
              props.hs_call_status,
              props.hs_call_disposition,
            ),
            duration_seconds: durationSeconds,
            started_at: props.hs_timestamp,
            call_outcome: props.hs_call_disposition || props.call_finish_reason,
            call_direction: direction,
            recording_url: recordingUrl,
            transcription: props.hs_call_body || null, // HubSpot AI call notes
          };
        });

        if (callsToUpsert.length > 0) {
          const { error } = await supabase
            .from("call_records")
            .upsert(callsToUpsert, {
              onConflict: "provider_call_id",
              ignoreDuplicates: false,
            });

          if (error) {
            results.errors.push(`Calls batch: ${error.message}`);
          } else {
            results.calls_synced = callsToUpsert.length;
          }
        }
      } catch (err: any) {
        results.errors.push(`Calls Sync Error: ${err.message}`);
      }
    }

    results.processing_time_ms = Date.now() - startTime;

    // Log successful sync
    await supabase.from("sync_logs").insert({
      platform: "hubspot",
      sync_type: sync_type,
      status:
        results.errors.length > 0
          ? "completed_with_errors"
          : results.has_more
            ? "partial"
            : "completed",
      records_processed:
        results.contacts_synced + results.deals_synced + results.calls_synced,
      records_failed: results.errors.length,
      error_details:
        results.errors.length > 0
          ? { errors: results.errors, next_cursor: results.next_cursor }
          : null,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
    });

    console.log(
      `Sync completed in ${results.processing_time_ms}ms: ${results.contacts_synced} contacts, has_more=${results.has_more}`,
    );

    return apiSuccess({
      success: true,
      message: results.has_more
        ? `Synced ${results.contacts_synced} contacts, more available. Call again with cursor.`
        : `HubSpot ${results.mode} sync completed`,
      ...results,
      instructions: results.has_more
        ? 'Call this function again with { "cursor": "' +
          results.next_cursor +
          '" } to continue'
        : undefined,
    });
  } catch (error: unknown) {
    console.error("Sync error:", error);
    return apiError(
      "INTERNAL_ERROR",
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        processing_time_ms: Date.now() - startTime,
      }),
      500,
    );
  }
});

function mapHubspotStatusToLead(
  lifecycle: string | null,
  leadStatus: string | null,
):
  | "new"
  | "appointment_set"
  | "appointment_held"
  | "pitch_given"
  | "closed"
  | "no_show"
  | "follow_up"
  | "rescheduled" {
  // Map to valid lead_status enum values
  if (leadStatus === "CLOSED_WON" || lifecycle === "customer") return "closed";
  if (leadStatus === "APPOINTMENT_SCHEDULED" || leadStatus === "MEETING_BOOKED")
    return "appointment_set";
  if (leadStatus === "APPOINTMENT_HELD" || leadStatus === "MEETING_COMPLETED")
    return "appointment_held";
  if (
    leadStatus === "IN_PROGRESS" ||
    leadStatus === "CONTACTED" ||
    leadStatus === "OPEN"
  )
    return "follow_up";
  if (leadStatus === "NO_SHOW") return "no_show";
  if (leadStatus === "RESCHEDULED") return "rescheduled";
  if (lifecycle === "salesqualifiedlead" || lifecycle === "opportunity")
    return "pitch_given";
  if (
    lifecycle === "lead" ||
    lifecycle === "subscriber" ||
    lifecycle === "marketingqualifiedlead"
  )
    return "new";
  return "new";
}

function mapHubspotCallStatus(status: string, disposition: string): string {
  if (disposition === "CONNECTED") return "completed";
  if (disposition === "NO_ANSWER") return "missed";
  if (disposition === "BUSY") return "busy";
  if (disposition === "LEFT_VOICEMAIL") return "voicemail";
  if (status === "COMPLETED") return "completed";
  if (status === "MISSED") return "missed";
  return "initiated";
}
// Force deploy Thu Dec 11 23:41:12 PST 2025
