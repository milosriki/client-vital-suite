import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { corsHeaders } from "../_shared/error-handler.ts";

/**
 * Master Sync Orchestrator
 * 
 * Runs all sync jobs in sequence:
 * 1. HubSpot contacts (last 30d modified)
 * 2. HubSpot deals (last 30d modified)
 * 3. Facebook ad insights (last 30d)
 * 4. Stripe backfill (last 30d)
 * 5. Attribution linking (time-match + URL extraction)
 * 6. Setter/closer/coach propagation
 * 
 * Trigger: Manual (refresh button) or daily cron
 * Auth: Accepts either Bearer JWT or X-Cron-Secret header for cron jobs
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HUBSPOT_TOKEN = Deno.env.get("HUBSPOT_ACCESS_TOKEN")!;
const PB_TOKEN = Deno.env.get("PIPEBOARD_API_KEY")!;
const PB_URL = "https://mcp.pipeboard.co/meta-ads-mcp";
const CRON_SECRET = Deno.env.get("MASTER_SYNC_CRON_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SyncStep {
  name: string;
  status: "pending" | "running" | "done" | "error" | "skipped";
  count?: number;
  error?: string;
  durationMs?: number;
}

function verifyCronOrAuth(req: Request) {
  // Allow cron with secret header
  const cronSecret = req.headers.get("X-Cron-Secret") || req.headers.get("x-cron-secret");
  if (cronSecret === CRON_SECRET) return;

  // Allow normal JWT auth
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (token && token.split(".").length === 3) return;

  throw new Error("Unauthorized");
}

async function hubspotFetch(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.hubapi.com${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`HubSpot ${endpoint}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function hubspotSearch(objectType: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${objectType}/search`, {
    method: "POST",
    headers: { Authorization: `Bearer ${HUBSPOT_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HubSpot search ${objectType}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function callPipeboard(tool: string, args: Record<string, unknown>) {
  const res = await fetch(PB_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${PB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "tools/call", id: Date.now(), params: { name: tool, arguments: args } }),
  });
  if (!res.ok) throw new Error(`Pipeboard ${tool}: ${res.status}`);
  const json = await res.json();
  return json.result?.content?.[0]?.text ? JSON.parse(json.result.content[0].text) : json.result;
}

// ─── Contact Properties ───
const CONTACT_PROPS = [
  "firstname", "lastname", "email", "phone", "lifecyclestage", "hubspot_owner_id",
  "call_status", "hs_lead_status", "createdate", "lastmodifieddate",
  "first_page_seen", "hs_analytics_first_url", "hs_analytics_first_referrer",
  "hs_analytics_last_referrer", "hs_latest_source", "hs_latest_source_data_1",
  "hs_latest_source_data_2", "ip_city", "ip_state", "ip_country", "ip_zipcode",
  "hs_google_click_id", "fbc", "fbp",
  "num_conversion_events", "num_unique_conversion_events",
  "of_sessions_conducted__last_7_days_", "of_conducted_sessions__last_30_days_",
  "outstanding_sessions", "sessions_purchased", "last_package_cost",
  "assigned_coach", "next_session_is_booked",
];

const DEAL_PROPS = [
  "dealname", "amount", "dealstage", "pipeline", "closedate", "createdate",
  "hubspot_owner_id", "hs_lastmodifieddate",
];

// ─── URL Attribution Extraction ───
function extractAttribution(url: string | null | undefined) {
  if (!url) return {};
  const result: Record<string, string> = {};
  try {
    // Extract hsa_* params (FB ads)
    const hsaCam = url.match(/hsa_cam=(\d+)/);
    const hsaGrp = url.match(/hsa_grp=(\d+)/);
    const hsaAd = url.match(/hsa_ad=(\d+)/);
    if (hsaCam) result.attributed_campaign_id = hsaCam[1];
    if (hsaGrp) result.attributed_adset_id = hsaGrp[1];
    if (hsaAd) result.attributed_ad_id = hsaAd[1];
    // Extract gclid (Google)
    const gclid = url.match(/gclid=([^&]+)/);
    if (gclid) result.gclid = gclid[1];
  } catch { /* ignore parse errors */ }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  const startTime = Date.now();
  const steps: SyncStep[] = [
    { name: "hubspot_contacts", status: "pending" },
    { name: "hubspot_deals", status: "pending" },
    { name: "facebook_insights", status: "pending" },
    { name: "stripe_backfill", status: "pending" },
    { name: "attribution_linking", status: "pending" },
    { name: "owner_propagation", status: "pending" },
  ];

  try {
    verifyCronOrAuth(req);
  } catch {
    return apiError("UNAUTHORIZED", "Missing or invalid authentication", 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Parse options from body
  const body = await req.json().catch(() => ({}));
  const skipSteps: string[] = body.skip || [];

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Sync HubSpot Contacts (last 30d modified)
  // ═══════════════════════════════════════════════════════════
  const contactStep = steps[0];
  if (skipSteps.includes("hubspot_contacts")) {
    contactStep.status = "skipped";
  } else {
    contactStep.status = "running";
    const stepStart = Date.now();
    try {
      const last30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
      let allContacts: any[] = [];
      let after: string | undefined;
      
      // Paginate through all modified contacts
      do {
        const searchBody: Record<string, unknown> = {
          filterGroups: [{
            filters: [{ propertyName: "lastmodifieddate", operator: "GTE", value: last30d }],
          }],
          properties: CONTACT_PROPS,
          limit: 100,
          ...(after ? { after } : {}),
        };
        const result = await hubspotSearch("contacts", searchBody);
        allContacts = allContacts.concat(result.results || []);
        after = result.paging?.next?.after;
        // Safety: cap at 5000 contacts per sync run
        if (allContacts.length >= 5000) break;
      } while (after);

      // Status normalization map
      const statusMap: Record<string, string> = {
        connected: "CONNECTED", completed: "CONNECTED", busy: "ATTEMPTED",
        no_answer: "ATTEMPTED", left_voicemail: "LEFT_VOICEMAIL",
        bad_timing: "BAD_TIMING", wrong_number: "WRONG_NUMBER",
        not_interested: "DISQUALIFIED", qualified: "QUALIFIED",
        new: "NEW", open: "NEW", attempted_to_contact: "ATTEMPTED",
      };

      const upsertData = allContacts.map((c: any) => {
        const p = c.properties;
        const rawStatus = p.call_status || p.hs_lead_status || "NEW";
        const lookup = rawStatus.toLowerCase().replace(/ /g, "_");
        const normalizedStatus = statusMap[lookup] || "NEW";

        // Attribution from URLs
        const firstPageAttr = extractAttribution(p.first_page_seen);
        const firstUrlAttr = extractAttribution(p.hs_analytics_first_url);
        const attr = { ...firstUrlAttr, ...firstPageAttr }; // first_page_seen takes priority

        return {
          hubspot_id: c.id,
          email: p.email,
          first_name: p.firstname,
          last_name: p.lastname,
          phone: p.phone,
          status: normalizedStatus,
          raw_status: rawStatus,
          hubspot_owner_id: p.hubspot_owner_id,
          lifecycle_stage: p.lifecyclestage || "lead",
          last_contacted: p.lastmodifieddate,
          created_at: p.createdate ? new Date(p.createdate).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString(),
          first_page_seen: p.first_page_seen,
          hs_analytics_first_url: p.hs_analytics_first_url,
          hs_analytics_first_referrer: p.hs_analytics_first_referrer,
          hs_analytics_last_referrer: p.hs_analytics_last_referrer,
          hs_latest_source: p.hs_latest_source,
          hs_latest_source_data_1: p.hs_latest_source_data_1,
          hs_latest_source_data_2: p.hs_latest_source_data_2,
          ip_city: p.ip_city,
          ip_state: p.ip_state,
          ip_country: p.ip_country,
          ip_zipcode: p.ip_zipcode,
          hs_google_click_id: p.hs_google_click_id,
          fbc: p.fbc,
          fbp: p.fbp,
          num_conversion_events: p.num_conversion_events ? Number(p.num_conversion_events) : null,
          num_unique_conversion_events: p.num_unique_conversion_events ? Number(p.num_unique_conversion_events) : null,
          sessions_7d: p.of_sessions_conducted__last_7_days_ ? Number(p.of_sessions_conducted__last_7_days_) : null,
          sessions_30d: p.of_conducted_sessions__last_30_days_ ? Number(p.of_conducted_sessions__last_30_days_) : null,
          outstanding_sessions: p.outstanding_sessions ? Number(p.outstanding_sessions) : null,
          sessions_purchased: p.sessions_purchased ? Number(p.sessions_purchased) : null,
          last_package_cost: p.last_package_cost ? Number(p.last_package_cost) : null,
          assigned_coach: p.assigned_coach,
          ...(attr.attributed_campaign_id ? { attributed_campaign_id: attr.attributed_campaign_id } : {}),
          ...(attr.attributed_adset_id ? { attributed_adset_id: attr.attributed_adset_id } : {}),
          ...(attr.attributed_ad_id ? { attributed_ad_id: attr.attributed_ad_id } : {}),
          ...(attr.gclid ? { gclid: attr.gclid } : {}),
        };
      });

      // Batch upsert in chunks of 500
      let upserted = 0;
      for (let i = 0; i < upsertData.length; i += 500) {
        const chunk = upsertData.slice(i, i + 500);
        const { error } = await supabase.from("contacts").upsert(chunk, { onConflict: "hubspot_id" });
        if (error) throw error;
        upserted += chunk.length;
      }

      contactStep.count = upserted;
      contactStep.status = "done";
      contactStep.durationMs = Date.now() - stepStart;
      console.log(`✅ Contacts: ${upserted} synced`);
    } catch (e: any) {
      contactStep.status = "error";
      contactStep.error = e.message;
      contactStep.durationMs = Date.now() - stepStart;
      console.error(`❌ Contacts sync error: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Sync HubSpot Deals (last 30d modified)
  // ═══════════════════════════════════════════════════════════
  const dealStep = steps[1];
  if (skipSteps.includes("hubspot_deals")) {
    dealStep.status = "skipped";
  } else {
    dealStep.status = "running";
    const stepStart = Date.now();
    try {
      const last30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
      let allDeals: any[] = [];
      let after: string | undefined;

      do {
        const searchBody: Record<string, unknown> = {
          filterGroups: [{
            filters: [{ propertyName: "hs_lastmodifieddate", operator: "GTE", value: last30d }],
          }],
          properties: DEAL_PROPS,
          limit: 100,
          ...(after ? { after } : {}),
        };
        const result = await hubspotSearch("deals", searchBody);
        allDeals = allDeals.concat(result.results || []);
        after = result.paging?.next?.after;
        if (allDeals.length >= 5000) break;
      } while (after);

      const upsertData = allDeals.map((d: any) => {
        const p = d.properties;
        return {
          hubspot_deal_id: d.id,
          deal_name: p.dealname,
          amount: p.amount ? Number(p.amount) : null,
          deal_stage: p.dealstage,
          pipeline: p.pipeline,
          close_date: p.closedate,
          create_date: p.createdate,
          hubspot_owner_id: p.hubspot_owner_id,
          updated_at: new Date().toISOString(),
        };
      });

      let upserted = 0;
      for (let i = 0; i < upsertData.length; i += 500) {
        const chunk = upsertData.slice(i, i + 500);
        const { error } = await supabase.from("deals").upsert(chunk, { onConflict: "hubspot_deal_id" });
        if (error) throw error;
        upserted += chunk.length;
      }

      dealStep.count = upserted;
      dealStep.status = "done";
      dealStep.durationMs = Date.now() - stepStart;
      console.log(`✅ Deals: ${upserted} synced`);
    } catch (e: any) {
      dealStep.status = "error";
      dealStep.error = e.message;
      dealStep.durationMs = Date.now() - stepStart;
      console.error(`❌ Deals sync error: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Facebook Ad Insights (last 30d)
  // ═══════════════════════════════════════════════════════════
  const fbStep = steps[2];
  if (skipSteps.includes("facebook_insights")) {
    fbStep.status = "skipped";
  } else {
    fbStep.status = "running";
    const stepStart = Date.now();
    try {
      const insightsData = await callPipeboard("get_account_insights", {
        account_id: "act_349832333681399",
        date_preset: "last_30d",
        level: "ad",
        fields: "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,actions,cost_per_action_type,cpc,cpm,ctr",
        time_increment: 1,
      });

      const rows = insightsData?.data || insightsData || [];
      let upserted = 0;

      if (Array.isArray(rows) && rows.length > 0) {
        const upsertData = rows.map((r: any) => {
          const leads = r.actions?.find((a: any) => a.action_type === "lead")?.value || 0;
          return {
            ad_id: r.ad_id,
            ad_name: r.ad_name,
            adset_id: r.adset_id,
            adset_name: r.adset_name,
            campaign_id: r.campaign_id,
            campaign_name: r.campaign_name,
            date: r.date_start,
            spend: Number(r.spend || 0),
            impressions: Number(r.impressions || 0),
            clicks: Number(r.clicks || 0),
            leads: Number(leads),
            cpc: r.cpc ? Number(r.cpc) : null,
            cpm: r.cpm ? Number(r.cpm) : null,
            ctr: r.ctr ? Number(r.ctr) : null,
            updated_at: new Date().toISOString(),
          };
        });

        for (let i = 0; i < upsertData.length; i += 500) {
          const chunk = upsertData.slice(i, i + 500);
          const { error } = await supabase
            .from("facebook_ads_insights")
            .upsert(chunk, { onConflict: "ad_id,date" });
          if (error) throw error;
          upserted += chunk.length;
        }
      }

      fbStep.count = upserted;
      fbStep.status = "done";
      fbStep.durationMs = Date.now() - stepStart;
      console.log(`✅ FB Insights: ${upserted} rows`);
    } catch (e: any) {
      fbStep.status = "error";
      fbStep.error = e.message;
      fbStep.durationMs = Date.now() - stepStart;
      console.error(`❌ FB Insights error: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 4: Stripe Backfill (last 30d)
  // ═══════════════════════════════════════════════════════════
  const stripeStep = steps[3];
  if (skipSteps.includes("stripe_backfill")) {
    stripeStep.status = "skipped";
  } else {
    stripeStep.status = "running";
    const stepStart = Date.now();
    try {
      // Call the existing stripe-backfill function
      const { data, error } = await supabase.functions.invoke("stripe-backfill", {
        body: { days: 30 },
      });
      if (error) throw error;

      stripeStep.count = data?.data?.transactions?.upserted || 0;
      stripeStep.status = "done";
      stripeStep.durationMs = Date.now() - stepStart;
      console.log(`✅ Stripe: ${stripeStep.count} transactions`);
    } catch (e: any) {
      stripeStep.status = "error";
      stripeStep.error = e.message;
      stripeStep.durationMs = Date.now() - stepStart;
      console.error(`❌ Stripe backfill error: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 5: Attribution Linking
  // ═══════════════════════════════════════════════════════════
  const attrStep = steps[4];
  if (skipSteps.includes("attribution_linking")) {
    attrStep.status = "skipped";
  } else {
    attrStep.status = "running";
    const stepStart = Date.now();
    try {
      // Time-match attribution: contacts with no ad attribution → match to top daily ad
      const { data: unattributed } = await supabase
        .from("contacts")
        .select("id, created_at")
        .is("attributed_ad_id", null)
        .not("created_at", "is", null)
        .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .limit(2000);

      let linked = 0;
      if (unattributed && unattributed.length > 0) {
        // Group by date
        const byDate = new Map<string, string[]>();
        for (const c of unattributed) {
          const d = c.created_at!.substring(0, 10); // YYYY-MM-DD
          if (!byDate.has(d)) byDate.set(d, []);
          byDate.get(d)!.push(c.id);
        }

        // For each date, find top-spending ad
        for (const [date, contactIds] of byDate) {
          const { data: topAd } = await supabase
            .from("facebook_ads_insights")
            .select("ad_id, adset_id, campaign_id")
            .eq("date", date)
            .order("spend", { ascending: false })
            .limit(1)
            .single();

          if (topAd) {
            // Batch update contacts for this date
            for (let i = 0; i < contactIds.length; i += 100) {
              const batch = contactIds.slice(i, i + 100);
              const { error } = await supabase
                .from("contacts")
                .update({
                  attributed_ad_id: topAd.ad_id,
                  attributed_adset_id: topAd.adset_id,
                  attributed_campaign_id: topAd.campaign_id,
                  attribution_method: "time_match_daily_top_ad",
                  updated_at: new Date().toISOString(),
                })
                .in("id", batch);
              if (!error) linked += batch.length;
            }
          }
        }
      }

      attrStep.count = linked;
      attrStep.status = "done";
      attrStep.durationMs = Date.now() - stepStart;
      console.log(`✅ Attribution: ${linked} contacts time-matched`);
    } catch (e: any) {
      attrStep.status = "error";
      attrStep.error = e.message;
      attrStep.durationMs = Date.now() - stepStart;
      console.error(`❌ Attribution error: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 6: Owner Propagation (setter/closer names)
  // ═══════════════════════════════════════════════════════════
  const ownerStep = steps[5];
  if (skipSteps.includes("owner_propagation")) {
    ownerStep.status = "skipped";
  } else {
    ownerStep.status = "running";
    const stepStart = Date.now();
    try {
      // Fetch HubSpot owners
      const ownerData = await hubspotFetch("/crm/v3/owners", { limit: "100" });
      const owners = ownerData.results || [];
      const ownerMap = new Map<string, string>();
      for (const o of owners) {
        const name = [o.firstName, o.lastName].filter(Boolean).join(" ");
        if (name) ownerMap.set(o.id, name);
      }

      // Update contacts with owner_name where missing
      let updated = 0;
      for (const [ownerId, ownerName] of ownerMap) {
        const { count } = await supabase
          .from("contacts")
          .update({ owner_name: ownerName, updated_at: new Date().toISOString() })
          .eq("hubspot_owner_id", ownerId)
          .is("owner_name", null)
          .select("id", { count: "exact", head: true });
        updated += (count || 0);
      }

      // Also update deals with owner names
      for (const [ownerId, ownerName] of ownerMap) {
        await supabase
          .from("deals")
          .update({ owner_name: ownerName, updated_at: new Date().toISOString() })
          .eq("hubspot_owner_id", ownerId)
          .is("owner_name", null);
      }

      ownerStep.count = updated;
      ownerStep.status = "done";
      ownerStep.durationMs = Date.now() - stepStart;
      console.log(`✅ Owners: ${updated} contacts, + deals updated`);
    } catch (e: any) {
      ownerStep.status = "error";
      ownerStep.error = e.message;
      ownerStep.durationMs = Date.now() - stepStart;
      console.error(`❌ Owner propagation error: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Log sync run
  // ═══════════════════════════════════════════════════════════
  const totalDuration = Date.now() - startTime;
  const summary = {
    timestamp: new Date().toISOString(),
    durationMs: totalDuration,
    steps,
    trigger: req.headers.get("X-Cron-Secret") ? "cron" : "manual",
  };

  // Log to sync_logs table
  await supabase.from("sync_logs").insert({
    sync_type: "master_sync",
    status: steps.every(s => s.status === "done" || s.status === "skipped") ? "success" : "partial",
    details: summary,
    created_at: new Date().toISOString(),
  }).catch(() => { /* don't fail on log write */ });

  console.log(`🏁 Master sync complete in ${totalDuration}ms`, JSON.stringify(summary, null, 2));

  return apiSuccess(summary);
});
