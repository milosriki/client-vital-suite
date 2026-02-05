// backfill-deals-history
// "The Great Sync" - Force fetch ALL deals from HubSpot to recover missing 730k revenue.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 100;
const START_DATE = "2024-01-01T00:00:00.000Z";

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!HUBSPOT_API_KEY) throw new Error("Missing HUBSPOT_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("🚀 STARTING HISTORICAL DEAL BACKFILL...");

    let totalSynced = 0;
    let hasMore = true;
    let afterCursor = undefined;
    const stageStats: Record<string, number> = {};

    // 1. Fetch Owners (for mapping)
    const ownerMap: Record<string, string> = {};
    try {
      const ownersRes = await fetch("https://api.hubapi.com/crm/v3/owners", {
        headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` },
      });
      if (ownersRes.ok) {
        const data = await ownersRes.json();
        data.results.forEach(
          (o: any) => (ownerMap[o.id] = `${o.firstName} ${o.lastName}`),
        );
      }
    } catch (e) {
      console.warn("Owner fetch failed", e);
    }

    // 2. Fetch Deals Loop
    while (hasMore) {
      const searchBody = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: "closedate",
                operator: "GTE",
                value: new Date(START_DATE).getTime().toString(),
              },
              {
                propertyName: "amount",
                operator: "GT",
                value: "0",
              },
            ],
          },
        ],
        properties: [
          "dealname",
          "dealstage",
          "amount",
          "pipeline",
          "closedate",
          "hubspot_owner_id",
          "createdate",
        ],
        sorts: [{ propertyName: "closedate", direction: "DESCENDING" }],
        limit: BATCH_SIZE,
        after: afterCursor,
      };

      const res = await fetch(
        "https://api.hubapi.com/crm/v3/objects/deals/search",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(searchBody),
        },
      );

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const deals = data.results || [];

      if (deals.length === 0) {
        hasMore = false;
        break;
      }

      // Track Stage Stats to debug "Missing 700k"
      deals.forEach((d: any) => {
        const stage = d.properties.dealstage || "unknown";
        stageStats[stage] = (stageStats[stage] || 0) + 1;
      });

      // 3. Upsert to Supabase
      const dealsToUpsert = deals.map((d: any) => {
        const props = d.properties;
        const val = parseFloat(props.amount) || 0;

        let status = "pending";
        // Logic: Try to capture ALL "won" variations
        const stage = (props.dealstage || "").toLowerCase();
        if (
          stage.includes("won") ||
          stage.includes("signed") ||
          stage.includes("paid")
        ) {
          status = "closed";
        } else if (stage.includes("lost") || stage.includes("bad")) {
          status = "cancelled";
        }

        return {
          hubspot_deal_id: d.id,
          deal_name: props.dealname,
          deal_value: val,
          value_aed: val, // Assuming AED for now, or use currency code conversion logic if needed
          stage: props.dealstage,
          pipeline: props.pipeline,
          status: status,
          close_date: props.closedate
            ? new Date(props.closedate).toISOString()
            : null,
          created_at: props.createdate
            ? new Date(props.createdate).toISOString()
            : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      const { error } = await supabase.from("deals").upsert(dealsToUpsert, {
        onConflict: "hubspot_deal_id",
      });

      if (error) {
        console.error("Upsert Error:", error);
      } else {
        totalSynced += dealsToUpsert.length;
        console.log(
          `✅ Synced batch of ${dealsToUpsert.length}. Total: ${totalSynced}`,
        );
      }

      if (data.paging?.next?.after) {
        afterCursor = data.paging.next.after;
      } else {
        hasMore = false;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_synced: totalSynced,
        stage_breakdown: stageStats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
