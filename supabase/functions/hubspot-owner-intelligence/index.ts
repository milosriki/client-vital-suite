import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { HubSpotSyncManager } from "../_shared/hubspot-sync-manager.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // We need HubSpot key for fetching owner names if not in cache/DB
    const HUBSPOT_ACCESS_TOKEN = Deno.env.get("HUBSPOT_ACCESS_TOKEN");

    console.log("📊 Starting HubSpot Owner Intelligence...");

    // 1. Fetch Aggregated Data from Supabase
    // We want to group contacts by owner_id and count statuses
    // Since Supabase (PostgREST) doesn't support complex GROUP BY aggregation easily in one call without RPC,
    // we'll fetch raw data and aggregate in memory (assuming reasonable volume < 5000 active leads).
    // For Production: Create a DB View or RPC.

    // Fetch last 30 days of active leads
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: leads, error } = await supabase
      .from("contacts")
      .select("hubspot_owner_id, status, lifecycle_stage, created_at")
      .gte("updated_at", thirtyDaysAgo);

    if (error) throw error;

    console.log(`Processing ${leads?.length || 0} recent lead records...`);

    // 2. Aggregate in Memory
    const ownerStats: Record<string, any> = {};

    leads?.forEach((lead) => {
      const ownerId = lead.hubspot_owner_id || "unassigned";

      if (!ownerStats[ownerId]) {
        ownerStats[ownerId] = {
          ownerId,
          totalLeads: 0,
          attempted: 0,
          connected: 0,
          meetingsBooked: 0,
          meetingsHeld: 0,
          closedWon: 0,
          deals: 0, // Legacy support if needed
          score: 0,
        };
      }

      const stats = ownerStats[ownerId];
      stats.totalLeads++;

      // 1. Attempts (Call Made)
      if (
        [
          "ATTEMPTED",
          "LEFT_VOICEMAIL",
          "CONNECTED",
          "attempted",
          "left_voicemail",
          "connected",
        ].includes(lead.status)
      ) {
        stats.attempted++;
      }

      // 2. Connections (Spoke to someone)
      if (
        ["CONNECTED", "QUALIFIED", "connected", "qualified"].includes(
          lead.status,
        )
      ) {
        stats.connected++;
      }

      // 3. Meetings Booked (Conversion from Connection)
      if (
        ["evangelist", "opportunity", "customer", "meeting_booked"].includes(
          lead.lifecycle_stage?.toLowerCase(),
        )
      ) {
        stats.meetingsBooked++;
      }

      // 4. Meetings Held (Show up)
      if (
        ["opportunity", "customer", "evangelist"].includes(
          lead.lifecycle_stage?.toLowerCase(),
        )
      ) {
        stats.meetingsHeld++;
      }

      // 5. Closed Won (Money)
      if (
        ["customer", "evangelist"].includes(lead.lifecycle_stage?.toLowerCase())
      ) {
        stats.closedWon++;
      }
    });

    // 3. Resolve Owner Names
    let ownerMap: Record<string, string> = {};
    if (HUBSPOT_ACCESS_TOKEN) {
      try {
        const syncManager = new HubSpotSyncManager(
          supabase,
          HUBSPOT_ACCESS_TOKEN,
        );
        ownerMap = await syncManager.fetchOwners();
      } catch (e) {
        console.warn("Failed to fetch owner names from HubSpot:", e);
      }
    }

    // 4. Format Output with Funnel Rates
    const leaderboard = Object.values(ownerStats)
      .map((stat: any) => {
        const leadToBookRate =
          stat.totalLeads > 0
            ? ((stat.meetingsBooked / stat.totalLeads) * 100).toFixed(1)
            : "0.0";
        const bookToShowRate =
          stat.meetingsBooked > 0
            ? ((stat.meetingsHeld / stat.meetingsBooked) * 100).toFixed(1)
            : "0.0";
        const showToCloseRate =
          stat.meetingsHeld > 0
            ? ((stat.closedWon / stat.meetingsHeld) * 100).toFixed(1)
            : "0.0";

        // Weighted Score (Focus on Revenue behaviors)
        const score =
          stat.closedWon * 10 +
          stat.meetingsHeld * 5 +
          stat.meetingsBooked * 3 +
          stat.connected * 1;

        return {
          id: stat.ownerId,
          name:
            ownerMap[stat.ownerId] || `Agent ${stat.ownerId.substring(0, 4)}`,
          score,
          metrics: {
            leads: stat.totalLeads,
            attempts: stat.attempted,
            connected: stat.connected,
            booked: stat.meetingsBooked,
            held: stat.meetingsHeld,
            closed: stat.closedWon,
          },
          rates: {
            lead_to_book: `${leadToBookRate}%`,
            book_to_show: `${bookToShowRate}%`,
            show_to_close: `${showToCloseRate}%`,
          },
        };
      })
      .sort((a: any, b: any) => b.score - a.score); // Highest score first

    return apiSuccess({
      generated_at: new Date().toISOString(),
      leaderboard,
    });
  } catch (error: unknown) {
    console.error("Owner Intelligence Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError("INTERNAL_ERROR", message, 500);
  }
});
