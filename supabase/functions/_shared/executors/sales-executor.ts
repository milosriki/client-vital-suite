import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

// Basic sanitizer from original tool-executor
function sanitizeString(input: string, maxLength: number = 255): string {
  return input
    .replace(/['"`;\\]/g, "")
    .trim()
    .slice(0, maxLength);
}

export async function executeSalesTools(
  supabase: any,
  toolName: string,
  input: any,
): Promise<string> {
  switch (toolName) {
    case "sales_flow_control": {
      const { action, stage, days = 30 } = input;
      if (action === "get_pipeline") {
        const { data } = await supabase
          .from("deals")
          .select("stage, status, deal_value, deal_name")
          .order("created_at", { ascending: false });
        const pipeline: Record<string, any[]> = {};
        (data || []).forEach((d: any) => {
          const s = d.stage || "unknown";
          if (!pipeline[s]) pipeline[s] = [];
          pipeline[s].push(d);
        });
        return JSON.stringify({ pipeline, total_deals: data?.length || 0 });
      }
      if (action === "get_deals") {
        let query = supabase.from("deals").select("*");
        if (stage) {
          const sanitizedStage = sanitizeString(stage, 100);
          query = query.eq("stage", sanitizedStage);
        }
        const { data } = await query
          .order("created_at", { ascending: false })
          .limit(30);
        return JSON.stringify(data || []);
      }
      if (action === "get_appointments") {
        const { data } = await supabase
          .from("appointments")
          .select("*")
          .order("scheduled_at", { ascending: false })
          .limit(30);
        return JSON.stringify(data || []);
      }
      if (action === "get_recent_closes") {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const { data } = await supabase
          .from("deals")
          .select("*")
          .gte("close_date", since.toISOString())
          .order("close_date", { ascending: false });
        return JSON.stringify(data || []);
      }
      if (action === "get_assessment_report") {
        // Timezone: Asia/Dubai (UTC+4)
        // We manually adjust the date to ensure "Today" aligns with the business day
        const now = new Date();
        const dubaiOffset = 4 * 60 * 60 * 1000;
        const dubaiTime = new Date(now.getTime() + dubaiOffset);
        const today = dubaiTime.toISOString().split("T")[0]; // YYYY-MM-DD in Dubai

        // 1. Fetch all deals created today
        const { data } = await supabase
          .from("deals")
          .select("owner_name, stage, deal_name, deal_value, created_at")
          .gte("created_at", today)
          .ilike("stage", "%Assessment%"); // Filter for assessment-related stages

        const deals = data || [];

        // 2. Group by Owner (Setter)
        const bySetter: Record<
          string,
          { total: number; confirmed: number; pending: number; deals: any[] }
        > = {};

        deals.forEach((d: any) => {
          const owner = d.owner_name || "Unassigned";
          if (!bySetter[owner]) {
            bySetter[owner] = {
              total: 0,
              confirmed: 0,
              pending: 0,
              deals: [],
            };
          }

          bySetter[owner].total++;
          bySetter[owner].deals.push(d.deal_name);

          // Check status based on stage name
          if (
            d.stage.toLowerCase().includes("confirmed") ||
            d.stage.toLowerCase().includes("booked")
          ) {
            bySetter[owner].confirmed++;
          } else {
            bySetter[owner].pending++;
          }
        });

        return JSON.stringify(
          {
            report_date: today,
            total_assessments: deals.length,
            breakdown_by_setter: bySetter,
            raw_data:
              deals.length > 0 ? "Found data" : "No assessments found today",
          },
          null,
          2,
        );
      }

      if (action === "get_conversion_metrics") {
        const daysBack = days || 30;

        // Timezone: Asia/Dubai (UTC+4)
        const now = new Date();
        const dubaiOffset = 4 * 60 * 60 * 1000;
        const dubaiTime = new Date(now.getTime() + dubaiOffset);

        dubaiTime.setDate(dubaiTime.getDate() - daysBack);
        const since = dubaiTime.toISOString();

        // 1. Fetch Scheduled Appointments (by Owner)
        const { data: appointments } = await supabase
          .from("appointments")
          .select("owner_id, status, scheduled_at")
          .gte("scheduled_at", since);

        // 2. Fetch Won Deals (by Owner)
        const { data: deals } = await supabase
          .from("deals")
          .select("owner_id, owner_name, stage, created_at, close_date")
          .gte("close_date", since)
          .ilike("stage", "%closed won%");

        // 3. Aggregate Stats by Owner
        const stats: Record<
          string,
          { scheduled: number; won: number; ratio: string }
        > = {};

        // Helper to get owner name (using deals as lookup source if needed, or owner_id fallback)
        const getOwnerName = (id: string) => {
          const deal = deals?.find((d: any) => d.owner_id === id);
          return deal?.owner_name || "Unknown (" + id + ")";
        };

        (appointments || []).forEach((a: any) => {
          const ownerId = a.owner_id || "unassigned";
          if (!stats[ownerId])
            stats[ownerId] = { scheduled: 0, won: 0, ratio: "0%" };
          stats[ownerId].scheduled++;
        });

        (deals || []).forEach((d: any) => {
          const ownerId = d.owner_id || "unassigned";
          if (!stats[ownerId])
            stats[ownerId] = { scheduled: 0, won: 0, ratio: "0%" };
          stats[ownerId].won++;
        });

        // Calculate Ratios
        Object.keys(stats).forEach((ownerId) => {
          const s = stats[ownerId];
          if (s.scheduled > 0) {
            s.ratio = ((s.won / s.scheduled) * 100).toFixed(1) + "%";
          }
        });

        // Map Owner IDs to Names for human readability
        const readableStats: Record<string, any> = {};
        for (const [id, data] of Object.entries(stats)) {
          // Try to fuzzy match owner name if ID is just a number/string, or use the name directly if available
          const name = getOwnerName(id);
          readableStats[name] = data;
        }

        return JSON.stringify(
          {
            period: `Last ${daysBack} days`,
            metrics_by_owner: readableStats,
            raw_stats: stats,
          },
          null,
          2,
        );
      }
      return "Unknown action";
    }

    default:
      return `Tool ${toolName} not handled by Sales executor.`;
  }
}
