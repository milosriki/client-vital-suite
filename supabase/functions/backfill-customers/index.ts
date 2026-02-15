import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";
import { HUBSPOT_PROPERTIES } from "../_shared/hubspot-sync-manager.ts";
import { HubSpotManager } from "../_shared/hubspot-manager.ts";

/**
 * Backfill Customers — Contacts-First Batch Processing
 *
 * Searches HubSpot for lifecycle_stage=customer contacts (most recent first),
 * maps all 66 properties, bulk upserts to Supabase, then finds their deals
 * via Batch Associations API and links them.
 *
 * Usage:
 *   POST /functions/v1/backfill-customers
 *   Body: { "limit": 300 }   <- how many customers to backfill (default 300)
 *
 * API Budget: 3-6 HubSpot calls for 300 customers + their deals
 */
serve(async (req) => {
  try { verifyAuth(req); } catch { throw new UnauthorizedError(); }
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    const HUBSPOT_TOKEN = Deno.env.get("HUBSPOT_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!HUBSPOT_TOKEN) throw new Error("HUBSPOT_ACCESS_TOKEN not configured");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json().catch(() => ({}));
    const targetLimit = body.limit ?? 300;

    console.log(`[Backfill-Customers] Starting — target: ${targetLimit} customers`);

    // ========================================================================
    // PHASE 1: Search HubSpot for customers (lifecycle_stage=customer)
    // ========================================================================
    const allCustomers: any[] = [];
    let afterCursor: string | undefined;
    let pageNum = 0;

    while (allCustomers.length < targetLimit) {
      pageNum++;
      const pageSize = Math.min(200, targetLimit - allCustomers.length);

      const searchBody: Record<string, unknown> = {
        filterGroups: [{
          filters: [{
            propertyName: "lifecyclestage",
            operator: "EQ",
            value: "customer",
          }],
        }],
        properties: HUBSPOT_PROPERTIES.CONTACTS,
        sorts: [{ propertyName: "lastmodifieddate", direction: "DESCENDING" }],
        limit: pageSize,
      };
      if (afterCursor) {
        searchBody.after = afterCursor;
      }

      console.log(`[Backfill-Customers] Fetching page ${pageNum} (${pageSize} contacts)...`);

      const searchRes = await fetch(
        "https://api.hubapi.com/crm/v3/objects/contacts/search",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HUBSPOT_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(searchBody),
        },
      );

      if (!searchRes.ok) {
        const errText = await searchRes.text();
        throw new Error(`HubSpot Search API ${searchRes.status}: ${errText}`);
      }

      const searchData = await searchRes.json();
      const results = searchData.results || [];
      allCustomers.push(...results);

      console.log(`[Backfill-Customers] Page ${pageNum}: ${results.length} contacts (total: ${allCustomers.length})`);

      if (searchData.paging?.next?.after && allCustomers.length < targetLimit) {
        afterCursor = searchData.paging.next.after;
      } else {
        break;
      }
    }

    if (allCustomers.length === 0) {
      return apiSuccess({ message: "No customers found in HubSpot", synced: 0 });
    }

    console.log(`[Backfill-Customers] Fetched ${allCustomers.length} customers from HubSpot`);

    // ========================================================================
    // PHASE 2: Map all contacts using sync-single-contact mapping logic
    // ========================================================================
    const nullIfAbsent = (v: unknown) => v === null || v === undefined ? undefined : v;
    const toNum = (v: unknown) => {
      if (v === null || v === undefined) return undefined;
      const n = Number(v);
      return isNaN(n) ? undefined : n;
    };

    const mappedContacts = allCustomers.map((contact) => {
      const p = contact.properties;
      const contactData: Record<string, unknown> = {
        hubspot_contact_id: String(contact.id),
        email: nullIfAbsent(p.email),
        first_name: nullIfAbsent(p.firstname),
        last_name: nullIfAbsent(p.lastname),
        phone: nullIfAbsent(p.phone) ?? nullIfAbsent(p.mobilephone),
        job_title: nullIfAbsent(p.jobtitle),
        city: nullIfAbsent(p.city),
        lifecycle_stage: nullIfAbsent(p.lifecyclestage),
        lead_status: nullIfAbsent(p.hs_lead_status),
        owner_id: nullIfAbsent(p.hubspot_owner_id),
        created_at: p.createdate ? new Date(p.createdate).toISOString() : new Date().toISOString(),
        updated_at: p.lastmodifieddate ? new Date(p.lastmodifieddate).toISOString() : new Date().toISOString(),
        // Attribution & Traffic
        first_touch_source: nullIfAbsent(p.hs_analytics_source),
        latest_traffic_source: nullIfAbsent(p.hs_analytics_source_data_1),
        utm_source: nullIfAbsent(p.utm_source),
        utm_medium: nullIfAbsent(p.utm_medium),
        utm_campaign: nullIfAbsent(p.utm_campaign),
        utm_content: nullIfAbsent(p.utm_content),
        utm_term: nullIfAbsent(p.utm_term),
        first_page_seen: nullIfAbsent(p.hs_analytics_first_url),
        last_page_seen: nullIfAbsent(p.hs_analytics_last_url),
        // Lead Management
        custom_lifecycle_stage: nullIfAbsent(p.custom_lifecycle_stage),
        first_conversion_date: nullIfAbsent(p.first_conversion_date),
        num_form_submissions: toNum(p.num_form_submissions),
        num_unique_forms_submitted: toNum(p.num_unique_forms_submitted),
        recent_conversion: nullIfAbsent(p.recent_conversion_event_name),
        recent_conversion_date: nullIfAbsent(p.recent_conversion_date),
        hubspot_team: nullIfAbsent(p.hubspot_team_id),
        contact_unworked: p.contact_unworked === 'true' || p.hs_is_unworked === 'true' || false,
        last_activity_date: nullIfAbsent(p.hs_last_sales_activity_date),
        email_domain: nullIfAbsent(p.hs_email_domain),
        // Company
        company_name: nullIfAbsent(p.company) ?? nullIfAbsent(p.company_name),
        company_size: nullIfAbsent(p.company_size),
        industry: nullIfAbsent(p.industry),
        website: nullIfAbsent(p.website),
        company_domain: nullIfAbsent(p.domain),
        // Deal & Revenue
        num_associated_deals: toNum(p.num_associated_deals),
        total_value: toNum(p.total_revenue),
        // Analytics
        num_visits: toNum(p.hs_analytics_num_visits),
        num_page_views: toNum(p.hs_analytics_num_page_views),
        num_event_completions: toNum(p.hs_analytics_num_event_completions),
        analytics_score: toNum(p.hs_analytics_score),
        first_visit_date: nullIfAbsent(p.hs_analytics_first_visit),
        last_visit_date: nullIfAbsent(p.hs_analytics_last_visit),
        // Social Engagement
        facebook_clicks: toNum(p.hs_social_facebook_clicks),
        twitter_clicks: toNum(p.hs_social_twitter_clicks),
        linkedin_clicks: toNum(p.hs_social_linkedin_clicks),
        // Activity Metrics
        num_notes: toNum(p.num_notes),
        num_meetings: toNum(p.num_meetings),
        num_emails: toNum(p.num_emails),
        num_emails_sent: toNum(p.num_emails_sent),
        num_emails_opened: toNum(p.num_emails_opened),
        num_emails_clicked: toNum(p.num_emails_clicked),
        last_meeting_date: nullIfAbsent(p.hs_last_meeting_booked_date),
        next_meeting_date: nullIfAbsent(p.hs_next_activity_date),
        // Communication Preferences
        email_opt_out: p.hs_email_opt_out === 'true',
        marketing_opt_out: p.hs_marketing_opt_out === 'true',
        preferred_contact_method: nullIfAbsent(p.preferred_contact_method),
        timezone: nullIfAbsent(p.timezone),
        language: nullIfAbsent(p.language),
        // Social Media
        twitter_handle: nullIfAbsent(p.twitterhandle),
        linkedin_bio: nullIfAbsent(p.linkedinbio),
        linkedin_connections: toNum(p.linkedinconnections),
        twitter_followers: toNum(p.twitterfollowers),
        // PTD Custom Properties
        assigned_coach: nullIfAbsent(p.assigned_coach),
        assessment_scheduled: p.assessment_scheduled === 'true',
        assessment_date: nullIfAbsent(p.assessment_date),
        package_type: nullIfAbsent(p.package_type),
        sessions_purchased: toNum(p.sessions_purchased),
        outstanding_sessions: toNum(p.outstanding_sessions),
        coach_notes: nullIfAbsent(p.coach_notes),
        preferred_location: nullIfAbsent(p.preferred_location),
        fitness_goals: nullIfAbsent(p.fitness_goals),
        // Session Activity
        sessions_last_7d: toNum(p['of_sessions_conducted__last_7_days_']),
        sessions_last_30d: toNum(p['of_conducted_sessions__last_30_days_']),
        sessions_last_90d: toNum(p['of_sessions_conducted__last_90_days_']),
        next_session_is_booked: p.next_session_is_booked === 'true',
        future_booked_sessions: toNum(p['of_future_booked_sessions']),
        last_package_cost: toNum(p.last_package_cost),
        // Metadata
        last_updated_source: 'backfill-customers',
      };

      // Filter out undefined (field not in response), keep null/0/""/false
      const cleaned = Object.fromEntries(
        Object.entries(contactData).filter(([_, v]) => v !== undefined)
      );
      cleaned.hubspot_contact_id = String(contact.id);
      return cleaned;
    });

    // Bulk upsert contacts in batches of 100
    let contactsSynced = 0;
    let contactErrors = 0;
    for (let i = 0; i < mappedContacts.length; i += 100) {
      const batch = mappedContacts.slice(i, i + 100);
      const { error: upsertError } = await supabase
        .from("contacts")
        .upsert(batch, { onConflict: "hubspot_contact_id" });

      if (upsertError) {
        console.error(`[Backfill-Customers] Upsert batch error:`, upsertError);
        contactErrors += batch.length;
      } else {
        contactsSynced += batch.length;
        console.log(`[Backfill-Customers] Upserted contacts ${i + 1}-${i + batch.length}`);
      }
    }

    console.log(`[Backfill-Customers] Phase 1 complete: ${contactsSynced} synced, ${contactErrors} errors`);

    // ========================================================================
    // PHASE 3: Find customer deals via Batch Associations API
    // ========================================================================
    const hsContactIds = allCustomers.map((c) => String(c.id));

    console.log(`[Backfill-Customers] Fetching associations for ${hsContactIds.length} contacts...`);

    const assocResponse = await fetch(
      "https://api.hubapi.com/crm/v4/associations/contacts/deals/batch/read",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HUBSPOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: hsContactIds.map((id) => ({ id })),
        }),
      },
    );

    if (!assocResponse.ok) {
      const errText = await assocResponse.text();
      console.error(`[Backfill-Customers] Associations API error: ${errText}`);
      return apiSuccess({
        contacts_synced: contactsSynced,
        contact_errors: contactErrors,
        associations_error: `HubSpot API ${assocResponse.status}`,
        deals_linked: 0,
      });
    }

    const assocData = await assocResponse.json();
    const assocResults = assocData.results || [];

    // Build contact→deals map (one contact can have many deals)
    const contactToDealIds = new Map<string, string[]>();
    const allDealHsIds = new Set<string>();

    for (const result of assocResults) {
      const contactHsId = String(result.from?.id);
      const dealIds = (result.to || []).map((t: any) => String(t.toObjectId));
      if (dealIds.length > 0) {
        contactToDealIds.set(contactHsId, dealIds);
        dealIds.forEach((id: string) => allDealHsIds.add(id));
      }
    }

    console.log(`[Backfill-Customers] ${contactToDealIds.size} contacts have deals, ${allDealHsIds.size} unique deals found`);

    if (allDealHsIds.size === 0) {
      return apiSuccess({
        contacts_synced: contactsSynced,
        contact_errors: contactErrors,
        deals_found: 0,
        deals_linked: 0,
        message: "No deal associations found for these customers",
      });
    }

    // ========================================================================
    // PHASE 4: Check which deals exist in Supabase, fetch missing from HubSpot
    // ========================================================================
    const dealIdArray = [...allDealHsIds];

    // Check existing deals in Supabase
    const { data: existingDeals } = await supabase
      .from("deals")
      .select("id, hubspot_deal_id, contact_id")
      .in("hubspot_deal_id", dealIdArray);

    const existingDealMap = new Map<string, { id: string; contact_id: string | null }>();
    for (const d of existingDeals || []) {
      existingDealMap.set(d.hubspot_deal_id, { id: d.id, contact_id: d.contact_id });
    }

    const missingDealIds = dealIdArray.filter((id) => !existingDealMap.has(id));
    console.log(`[Backfill-Customers] ${existingDealMap.size} deals exist in Supabase, ${missingDealIds.length} missing`);

    // Resolve HubSpot contact IDs to Supabase UUIDs
    const { data: supabaseContacts } = await supabase
      .from("contacts")
      .select("id, hubspot_contact_id")
      .in("hubspot_contact_id", hsContactIds);

    const hsToSupabaseContact = new Map<string, string>();
    for (const c of supabaseContacts || []) {
      hsToSupabaseContact.set(c.hubspot_contact_id, c.id);
    }

    // Fetch owners for deal mapping
    const ownerMap: Record<string, string> = {};
    try {
      const ownersRes = await fetch("https://api.hubapi.com/crm/v3/owners", {
        headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}` },
      });
      if (ownersRes.ok) {
        const ownersData = await ownersRes.json();
        for (const o of ownersData.results || []) {
          ownerMap[o.id] = `${o.firstName} ${o.lastName}`;
        }
      }
    } catch (e) {
      console.warn("[Backfill-Customers] Owner fetch failed, continuing", e);
    }

    // Fetch missing deals from HubSpot (batch read, 100 per request)
    let dealsSynced = 0;
    let dealsLinked = 0;

    if (missingDealIds.length > 0) {
      for (let i = 0; i < missingDealIds.length; i += 100) {
        const batch = missingDealIds.slice(i, i + 100);

        const batchRes = await fetch(
          "https://api.hubapi.com/crm/v3/objects/deals/batch/read",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${HUBSPOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              properties: [...HUBSPOT_PROPERTIES.DEALS, "description", "failure_reason"],
              inputs: batch.map((id) => ({ id })),
            }),
          },
        );

        if (!batchRes.ok) {
          console.error(`[Backfill-Customers] Deal batch read error: ${await batchRes.text()}`);
          continue;
        }

        const batchData = await batchRes.json();
        const deals = batchData.results || [];

        // Map and upsert deals with contact_id
        const dealsToUpsert = deals.map((d: any) => {
          // Find which contact owns this deal
          let contactId: string | null = null;
          for (const [hsContactId, dealIds] of contactToDealIds.entries()) {
            if (dealIds.includes(String(d.id))) {
              contactId = hsToSupabaseContact.get(hsContactId) || null;
              break;
            }
          }

          const dealOwnerId = d.properties.hubspot_owner_id || null;
          const dealOwnerName = dealOwnerId ? ownerMap[dealOwnerId] || null : null;

          return {
            ...HubSpotManager.mapDealFields(d, contactId, dealOwnerName),
            description: d.properties.description || null,
            lost_reason: d.properties.failure_reason || null,
          };
        });

        const { error: dealError } = await supabase
          .from("deals")
          .upsert(dealsToUpsert, { onConflict: "hubspot_deal_id" });

        if (dealError) {
          console.error("[Backfill-Customers] Deal upsert error:", dealError);
        } else {
          dealsSynced += dealsToUpsert.length;
          const linked = dealsToUpsert.filter((d: any) => d.contact_id).length;
          dealsLinked += linked;
          console.log(`[Backfill-Customers] Upserted ${dealsToUpsert.length} deals (${linked} linked)`);
        }
      }
    }

    // ========================================================================
    // PHASE 5: Link existing deals that are missing contact_id
    // ========================================================================
    let existingLinked = 0;
    for (const [hsDealId, existing] of existingDealMap.entries()) {
      if (existing.contact_id) continue; // Already linked

      // Find the contact for this deal
      for (const [hsContactId, dealIds] of contactToDealIds.entries()) {
        if (dealIds.includes(hsDealId)) {
          const supabaseContactId = hsToSupabaseContact.get(hsContactId);
          if (supabaseContactId) {
            const { error: linkError } = await supabase
              .from("deals")
              .update({ contact_id: supabaseContactId, updated_at: new Date().toISOString() })
              .eq("id", existing.id);

            if (!linkError) existingLinked++;
          }
          break;
        }
      }
    }

    dealsLinked += existingLinked;
    console.log(`[Backfill-Customers] Linked ${existingLinked} existing deals to contacts`);

    // ========================================================================
    // RESULTS
    // ========================================================================
    const result = {
      contacts_synced: contactsSynced,
      contact_errors: contactErrors,
      total_deals_found: allDealHsIds.size,
      new_deals_synced: dealsSynced,
      deals_linked: dealsLinked,
      existing_deals_linked: existingLinked,
      contacts_with_deals: contactToDealIds.size,
    };

    console.log(`[Backfill-Customers] Complete:`, JSON.stringify(result));
    return apiSuccess(result);

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Backfill-Customers] Error:", msg);
    return apiSuccess({ error: msg });
  }
});
