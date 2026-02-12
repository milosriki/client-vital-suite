// backfill-deals-history
// "The Great Sync" - Force fetch ALL deals from HubSpot to recover missing 730k revenue.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { withTracing, structuredLog } from "../_shared/observability.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";
import { HubSpotManager } from "../_shared/hubspot-manager.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 100;
const START_DATE = "2024-01-01T00:00:00.000Z";

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
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
        const dealOwnerId = d.properties.hubspot_owner_id || null;
        const dealOwnerName = dealOwnerId ? ownerMap[dealOwnerId] || null : null;
        return HubSpotManager.mapDealFields(d, null, dealOwnerName);
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

    return apiError("INTERNAL_ERROR", JSON.stringify({
        success: true,
        total_synced: totalSynced,
        stage_breakdown: stageStats,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    return apiSuccess({ error: error.message });
  }
});
