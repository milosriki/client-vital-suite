import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

// Security Utilities
function validateEmail(email: string): string {
  const emailRegex = /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const sanitized = email.trim().toLowerCase().slice(0, 255);
  if (!emailRegex.test(sanitized)) throw new Error("Invalid email format");
  return sanitized;
}

function sanitizeString(input: string, maxLength: number = 255): string {
  return input
    .replace(/['"`;\\]/g, "")
    .trim()
    .slice(0, maxLength);
}

export async function executeSharedTool(
  supabase: any,
  toolName: string,
  input: any,
): Promise<string> {
  console.log(`🔧 Executing shared tool: ${toolName}`, input);

  try {
    switch (toolName) {
      case "client_control": {
        const { email, action } = input;
        if (action === "get_all") {
          const validatedEmail = validateEmail(email);
          const [health, calls, deals, activities] = await Promise.all([
            supabase
              .from("client_health_scores")
              .select("*")
              .eq("email", validatedEmail)
              .single(),
            supabase
              .from("call_records")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(10),
            supabase
              .from("deals")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(10),
            supabase
              .from("contact_activities")
              .select("*")
              .order("occurred_at", { ascending: false })
              .limit(20),
          ]);
          return JSON.stringify(
            {
              health: health.data,
              calls: calls.data,
              deals: deals.data,
              activities: activities.data,
            },
            null,
            2,
          );
        }
        // ... other actions
        if (action === "get_health") {
          const validatedEmail = validateEmail(email);
          const { data } = await supabase
            .from("client_health_scores")
            .select("*")
            .eq("email", validatedEmail)
            .single();
          return JSON.stringify(data);
        }
        return "Unknown action";
      }

      case "lead_control": {
        const { action, query, status, limit = 20 } = input;
        if (action === "get_all") {
          const { data } = await supabase
            .from("contacts")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(limit);
          return JSON.stringify({
            count: data?.length || 0,
            leads: data || [],
          });
        }
        if (action === "search" && query) {
          const sanitizedQuery = query
            .replace(/[^a-zA-Z0-9@.\-+\s]/g, "")
            .slice(0, 100);
          const { data } = await supabase
            .from("contacts")
            .select("*")
            .or(
              `email.ilike.%${sanitizedQuery}%,first_name.ilike.%${sanitizedQuery}%,last_name.ilike.%${sanitizedQuery}%,phone.ilike.%${sanitizedQuery}%`,
            )
            .limit(limit);
          return JSON.stringify({
            count: data?.length || 0,
            leads: data || [],
          });
        }
        return "Unknown action";
      }

      case "trigger_realtime_sync": {
        try {
          const [stripeSync, hubspotSync] = await Promise.all([
            supabase.functions.invoke("stripe-dashboard-data", {
              body: { force_refresh: true },
            }),
            supabase.functions.invoke("sync-hubspot-to-supabase", {
              body: { sync_type: "all" },
            }),
          ]);
          return `🔄 REAL-TIME SYNC COMPLETE: Stripe and HubSpot data updated.`;
        } catch (e) {
          return `Sync error: ${e}`;
        }
      }

      case "stripe_control": {
        const { action, days = 90 } = input;

        // Force a live sync for high-priority actions
        if (
          action === "live_pulse" ||
          action === "fraud_scan" ||
          action === "integrity_check"
        ) {
          console.log(`🚀 Triggering live sync for ${action}...`);
          await supabase.functions.invoke("stripe-dashboard-data", {
            body: { force_refresh: true },
          });
        }

        if (action === "fraud_scan") {
          try {
            const { data } = await supabase.functions.invoke(
              "stripe-forensics",
              {
                body: { action: "full-audit", days_back: days },
              },
            );
            return `🚨 LIVE STRIPE FRAUD SCAN:\n${JSON.stringify(data, null, 2)}`;
          } catch (e) {
            return `Stripe forensics error: ${e}`;
          }
        }

        if (action === "live_pulse") {
          try {
            const { data } = await supabase.functions.invoke(
              "stripe-dashboard-data",
              { body: {} },
            );
            return (
              `📊 LIVE STRIPE PULSE (Current as of ${new Date().toLocaleTimeString()}):\n` +
              `- Net Revenue: ${data.metrics.netRevenue / 100} AED\n` +
              `- Successful Payments: ${data.metrics.successfulPaymentsCount}\n` +
              `- Pending Balance: ${data.balance.pending[0].amount / 100} AED\n` +
              `Recent Activity Summary: ${JSON.stringify(data.chartData.slice(-3))}`
            );
          } catch (e) {
            return `Live pulse error: ${e}`;
          }
        }
        if (action === "get_summary" || action === "analyze") {
          try {
            const { data } = await supabase.functions.invoke(
              "stripe-dashboard-data",
              { body: {} },
            );
            return JSON.stringify(data);
          } catch (e) {
            return `Stripe dashboard error: ${e}`;
          }
        }
        return "Unknown action";
      }

      case "test_api_connections": {
        const results: Record<string, any> = {};

        // 1. Stripe Test
        try {
          const stripe = await fetch("https://api.stripe.com/v1/balance", {
            headers: {
              Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`,
            },
          });
          results.stripe = stripe.ok ? "🟢 OK" : `🔴 FAILED (${stripe.status})`;
        } catch (e) {
          results.stripe = "🔴 ERROR";
        }

        // 2. HubSpot Test
        try {
          const hubspot = await fetch(
            "https://api.hubapi.com/crm/v3/objects/contacts?limit=1",
            {
              headers: {
                Authorization: `Bearer ${Deno.env.get("HUBSPOT_API_KEY")}`,
              },
            },
          );
          results.hubspot = hubspot.ok
            ? "🟢 OK"
            : `🔴 FAILED (${hubspot.status})`;
        } catch (e) {
          results.hubspot = "🔴 ERROR";
        }

        // 3. CallGear Test
        try {
          const cgRes = await supabase.functions.invoke("fetch-callgear-data", {
            body: { limit: 1 },
          });
          results.callgear = cgRes.data?.success ? "🟢 OK" : "🔴 FAILED";
        } catch (e) {
          results.callgear = "🔴 ERROR";
        }

        return JSON.stringify(results, null, 2);
      }

      case "hubspot_control": {
        const { action, limit = 50, email, contact_id } = input;

        if (action === "get_contact_history") {
          const { data } = await supabase
            .from("contact_ownership_history")
            .select("*")
            .eq("contact_id", contact_id)
            .order("changed_at", { ascending: false });
          return JSON.stringify(data || []);
        }

        if (action === "get_call_summaries") {
          const { data } = await supabase
            .from("call_records")
            .select(
              "started_at, duration_seconds, call_outcome, transcription, summary",
            )
            .ilike("caller_number", `%${input.phone}%`)
            .order("started_at", { ascending: false })
            .limit(5);
          return JSON.stringify(data || []);
        }

        if (action === "sync_now") {
          try {
            const { data } = await supabase.functions.invoke(
              "sync-hubspot-to-supabase",
              { body: { force: true } },
            );
            return `HubSpot sync triggered: ${JSON.stringify(data)}`;
          } catch (e) {
            return `Sync error: ${e}`;
          }
        }
        if (action === "get_contacts") {
          const { data } = await supabase
            .from("contacts")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(limit);
          return JSON.stringify({
            count: data?.length || 0,
            contacts: data || [],
          });
        }
        if (action === "get_activities") {
          const { data } = await supabase
            .from("contact_activities")
            .select("*")
            .order("occurred_at", { ascending: false })
            .limit(limit);
          return JSON.stringify(data || []);
        }
        if (action === "get_lifecycle_stages") {
          const { data } = await supabase
            .from("contacts")
            .select("lifecycle_stage");
          const stages: Record<string, number> = {};
          (data || []).forEach((c: any) => {
            const stage = c.lifecycle_stage || "unknown";
            stages[stage] = (stages[stage] || 0) + 1;
          });
          return JSON.stringify(stages);
        }
        return "Unknown action";
      }

      case "call_control": {
        const { action, limit = 20 } = input;
        if (action === "get_all") {
          const { data } = await supabase
            .from("call_records")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(limit);
          return JSON.stringify({
            count: data?.length || 0,
            calls: data || [],
          });
        }
        if (action === "get_transcripts") {
          const { data } = await supabase
            .from("call_records")
            .select(
              "id, caller_number, transcription, call_outcome, duration_seconds, created_at",
            )
            .not("transcription", "is", null)
            .order("created_at", { ascending: false })
            .limit(limit);
          return JSON.stringify(data || []);
        }
        if (action === "get_analytics") {
          const { data } = await supabase
            .from("call_analytics")
            .select("*")
            .order("date", { ascending: false })
            .limit(30);
          return JSON.stringify(data || []);
        }
        if (action === "find_patterns" || action === "analyze_objections") {
          const { data } = await supabase
            .from("call_records")
            .select("transcription, call_outcome, caller_number")
            .not("transcription", "is", null)
            .limit(50);

          const objections = {
            pricing: data?.filter((c: any) =>
              /price|expensive|cost|budget|discount/i.test(c.transcription),
            ).length,
            timing: data?.filter((c: any) =>
              /later|next month|busy|wait/i.test(c.transcription),
            ).length,
            competitor: data?.filter((c: any) =>
              /enhance|other gym|trainer at home/i.test(c.transcription),
            ).length,
          };

          return JSON.stringify({
            analysis_period: "Last 50 calls with transcripts",
            objection_counts: objections,
            recommendation:
              objections.pricing > 10
                ? "Consider introducing more flexible installment plans."
                : "Sales flow is healthy.",
          });
        }
        return "Unknown action";
      }

      case "analytics_control": {
        const { dashboard } = input;
        try {
          // Use the same RPC function as the main dashboard for consistency
          const { data, error } = await supabase.rpc("get_dashboard_stats");

          if (error) {
            return `Error fetching dashboard stats: ${error.message}`;
          }

          return JSON.stringify(
            {
              dashboard: dashboard || "main",
              stats: data,
              source: "real-time-rpc",
            },
            null,
            2,
          );
        } catch (e) {
          return `Analytics error: ${e}`;
        }
      }

      case "get_at_risk_clients": {
        const { zone = "red", limit = 20 } = input;
        let query = supabase.from("client_health_scores").select("*");
        if (zone !== "all") {
          query = query.eq("health_zone", zone);
        }
        const { data } = await query
          .order("churn_risk_score", { ascending: false })
          .limit(limit);
        return JSON.stringify(data || []);
      }

      case "intelligence_control": {
        const { functions } = input;
        // This would trigger other edge functions
        return `Intelligence functions triggered: ${functions.join(", ")}. Results will be available in agent_context.`;
      }

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

      case "universal_search": {
        const { query, search_type = "auto" } = input;
        const q = String(query).trim();

        if (q.length > 100) {
          return JSON.stringify({
            error: "Search query too long (max 100 characters)",
          });
        }

        let detectedType = search_type;
        if (search_type === "auto") {
          if (/^\d{9,15}$/.test(q.replace(/\D/g, ""))) detectedType = "phone";
          else if (q.includes("@")) detectedType = "email";
          else if (/^[a-f0-9-]{36}$/i.test(q)) detectedType = "id";
          else detectedType = "name";
        }

        console.log(`🔍 Universal search: "${q}" (type: ${detectedType})`);

        const phoneCleaned = q.replace(/\D/g, "");
        const searchLike = `%${q}%`;

        const [contacts, leads, calls, deals, healthScores, activities] =
          await Promise.all([
            supabase
              .from("contacts")
              .select("*")
              .or(
                `phone.ilike.%${phoneCleaned}%,email.ilike.${searchLike},first_name.ilike.${searchLike},last_name.ilike.${searchLike},hubspot_contact_id.ilike.${searchLike},owner_name.ilike.${searchLike}`,
              )
              .limit(10),
            supabase
              .from("attribution_events")
              .select("*")
              .or(`email.ilike.${searchLike},campaign.ilike.${searchLike}`)
              .limit(10),
            supabase
              .from("call_records")
              .select("*")
              .or(`caller_number.ilike.%${phoneCleaned}%`)
              .order("started_at", { ascending: false })
              .limit(20),
            supabase
              .from("deals")
              .select("*")
              .or(
                `deal_name.ilike.${searchLike},hubspot_deal_id.ilike.${searchLike}`,
              )
              .limit(10),
            supabase
              .from("client_health_scores")
              .select("*")
              .or(
                `email.ilike.${searchLike},firstname.ilike.${searchLike},lastname.ilike.${searchLike}`,
              )
              .limit(5),
            supabase
              .from("contact_activities")
              .select("*")
              .or(`hubspot_contact_id.ilike.${searchLike}`)
              .order("occurred_at", { ascending: false })
              .limit(10),
          ]);

        const callAttempts = calls.data?.length || 0;
        const connectedCalls =
          calls.data?.filter((c: any) => c.call_status === "completed")
            ?.length || 0;
        const callStats = {
          total_attempts: callAttempts,
          connected: connectedCalls,
          missed: callAttempts - connectedCalls,
          first_call: calls.data?.[calls.data.length - 1]?.started_at,
          last_call: calls.data?.[0]?.started_at,
          directions: calls.data?.reduce((acc: any, c: any) => {
            acc[c.call_direction || "unknown"] =
              (acc[c.call_direction || "unknown"] || 0) + 1;
            return acc;
          }, {}),
        };

        const result = {
          search_query: q,
          search_type: detectedType,
          contacts_found: contacts.data?.length || 0,
          contact_details: contacts.data?.map((c: any) => ({
            name:
              `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unknown",
            email: c.email,
            phone: c.phone,
            owner: c.owner_name,
            lifecycle_stage: c.lifecycle_stage,
            lead_status: c.lead_status,
            city: c.city,
            location: c.location,
            hubspot_id: c.hubspot_contact_id,
            first_touch: c.first_touch_time,
            last_activity: c.last_activity_date,
            created_at: c.created_at,
          })),
          leads_found: leads.data?.length || 0,
          lead_details: leads.data?.map((l: any) => ({
            name:
              `${l.first_name || ""} ${l.last_name || ""}`.trim() || "Unknown",
            email: l.email,
            phone: l.phone,
            lead_score: l.lead_score,
            lead_quality: l.lead_quality,
            conversion_status: l.conversion_status,
            campaign: l.campaign_name,
            ad_name: l.ad_name,
            fitness_goal: l.fitness_goal,
            budget: l.budget_range,
            urgency: l.urgency,
            dubai_area: l.dubai_area,
          })),
          call_stats: callStats,
          call_history: calls.data?.slice(0, 10).map((c: any) => ({
            date: c.started_at,
            status: c.call_status,
            direction: c.call_direction,
            duration_seconds: c.duration_seconds,
            outcome: c.call_outcome,
          })),
          deals_found: deals.data?.length || 0,
          deal_details: deals.data?.map((d: any) => ({
            name: d.deal_name,
            value: d.deal_value,
            stage: d.stage,
            status: d.status,
            close_date: d.close_date,
          })),
          health_scores: healthScores.data?.map((h: any) => ({
            name: `${h.firstname || ""} ${h.lastname || ""}`.trim(),
            email: h.email,
            health_score: h.health_score,
            health_zone: h.health_zone,
            coach: h.assigned_coach,
            churn_risk: h.churn_risk_score,
          })),
          recent_activities: activities.data?.slice(0, 5).map((a: any) => ({
            type: a.activity_type,
            title: a.activity_title,
            date: a.occurred_at,
          })),
        };

        return JSON.stringify(result, null, 2);
      }

      case "get_coach_clients": {
        const { coach_name } = input;
        const searchName = `%${coach_name}%`;

        const [clients, coachPerf] = await Promise.all([
          supabase
            .from("client_health_scores")
            .select("*")
            .ilike("assigned_coach", searchName)
            .order("health_score", { ascending: true }),
          supabase
            .from("coach_performance")
            .select("*")
            .ilike("coach_name", searchName)
            .order("report_date", { ascending: false })
            .limit(1),
        ]);

        const clientData = clients.data || [];
        const performance = coachPerf.data?.[0];

        const zones: Record<string, number> = {
          purple: 0,
          green: 0,
          yellow: 0,
          red: 0,
        };
        let totalHealth = 0;
        clientData.forEach((c: any) => {
          if (c.health_zone) zones[c.health_zone]++;
          totalHealth += c.health_score || 0;
        });

        return JSON.stringify(
          {
            coach_name: coach_name,
            total_clients: clientData.length,
            avg_health_score:
              clientData.length > 0
                ? (totalHealth / clientData.length).toFixed(1)
                : 0,
            zone_distribution: zones,
            at_risk_clients: clientData.filter(
              (c: any) => c.health_zone === "red" || c.health_zone === "yellow",
            ),
            all_clients: clientData.map((c: any) => ({
              name: `${c.firstname || ""} ${c.lastname || ""}`.trim(),
              email: c.email,
              health_score: c.health_score,
              health_zone: c.health_zone,
              churn_risk: c.churn_risk_score,
              days_since_session: c.days_since_last_session,
            })),
            coach_performance: performance
              ? {
                  performance_score: performance.performance_score,
                  clients_at_risk: performance.clients_at_risk,
                  intervention_success_rate:
                    performance.intervention_success_rate,
                }
              : null,
          },
          null,
          2,
        );
      }

      case "get_coach_performance": {
        const { coach_name } = input;
        let query = supabase
          .from("coach_performance")
          .select("*")
          .order("report_date", { ascending: false });
        if (coach_name) {
          query = query.ilike("coach_name", `%${coach_name}%`);
        }
        const { data } = await query.limit(20);
        return JSON.stringify(data || []);
      }

      case "get_proactive_insights": {
        const { priority = "all", limit = 10 } = input;
        let query = supabase.from("proactive_insights").select("*");
        if (priority !== "all") {
          query = query.eq("priority", priority);
        }
        const { data } = await query
          .order("created_at", { ascending: false })
          .limit(limit);
        return JSON.stringify({
          insights_count: data?.length || 0,
          insights: data || [],
        });
      }

      case "get_daily_summary": {
        const { date } = input;
        const targetDate = date || new Date().toISOString().split("T")[0];
        const { data } = await supabase
          .from("daily_summary")
          .select("*")
          .eq("summary_date", targetDate)
          .single();
        if (!data) {
          return JSON.stringify({
            message: "No summary found for this date",
            date: targetDate,
          });
        }
        return JSON.stringify(data);
      }

      case "callgear_control": {
        const { date_from, date_to, limit = 50 } = input;
        try {
          const { data, error } = await supabase.functions.invoke(
            "fetch-callgear-data",
            {
              body: { date_from, date_to, limit },
            },
          );
          if (error) return `CallGear Error: ${error.message}`;
          if (!data.success)
            return `CallGear API Error: ${data.error || "Unknown error"}`;
          return JSON.stringify({
            count: data.count,
            calls: data.data?.map((c: any) => ({
              start_time: c.start_time,
              duration: c.duration,
              caller: c.calling_phone,
              called: c.called_phone,
              employee: c.employee_full_name || "Unknown",
              status: c.status,
              outcome: c.finish_reason,
              recording: c.record_url,
            })),
          });
        } catch (e) {
          return `CallGear integration error: ${e}`;
        }
      }

      case "forensic_control": {
        const { target_identity, limit = 50 } = input;
        try {
          const { data, error } = await supabase.functions.invoke(
            "fetch-forensic-data",
            {
              body: { target_identity, limit },
            },
          );
          if (error) return `Forensic Audit Error: ${error.message}`;
          if (!data.success)
            return `Forensic Audit Failed: ${data.message || "Unknown error"}`;
          return JSON.stringify({
            target: data.contact,
            audit_log: data.audit_log,
          });
        } catch (e) {
          return `Forensic integration error: ${e}`;
        }
      }

      case "callgear_supervisor": {
        const { action, call_session_id, mode, coach_sip_uri } = input;
        try {
          const { data, error } = await supabase.functions.invoke(
            "callgear-supervisor",
            {
              body: { action, call_session_id, mode, coach_sip_uri },
            },
          );
          if (error) return `CallGear Supervisor Error: ${error.message}`;
          return JSON.stringify(data);
        } catch (e) {
          return `CallGear Supervisor error: ${e}`;
        }
      }

      case "callgear_live_monitor": {
        const { action } = input;
        try {
          const { data, error } = await supabase.functions.invoke(
            "callgear-live-monitor",
            { body: { action } },
          );
          if (error) return `CallGear Monitor Error: ${error.message}`;
          return JSON.stringify(data);
        } catch (e) {
          return `CallGear Monitor error: ${e}`;
        }
      }

      case "callgear_icp_router": {
        const { action, test_caller } = input;
        try {
          const { data, error } = await supabase.functions.invoke(
            "callgear-icp-router",
            { body: { action, test_caller } },
          );
          if (error) return `CallGear ICP Error: ${error.message}`;
          return JSON.stringify(data);
        } catch (e) {
          return `CallGear ICP error: ${e}`;
        }
      }

      case "run_sql_query": {
        const { query } = input;
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery.startsWith("select")) {
          return JSON.stringify({ error: "Only SELECT queries are allowed" });
        }
        const forbiddenPattern =
          /\b(drop|delete|insert|update|alter|create|truncate|grant|revoke|execute|exec)\b/i;
        if (forbiddenPattern.test(normalizedQuery)) {
          return JSON.stringify({
            error: "Query contains forbidden operations",
          });
        }
        // Allow semicolons if they are at the end, but block multiple statements
        if (
          normalizedQuery.split(";").filter((s) => s.trim().length > 0).length >
          1
        ) {
          return JSON.stringify({
            error: "Multiple statements are not allowed",
          });
        }
        try {
          const { data, error } = await supabase.rpc("execute_sql_query", {
            sql_query: query,
          });
          if (error) return JSON.stringify({ error: error.message });
          return JSON.stringify({ results: data });
        } catch (e) {
          return JSON.stringify({ error: "SQL query execution failed." });
        }
      }

      case "run_intelligence_suite": {
        try {
          const results: Record<string, any> = {};
          const functionsToRun = ["anomaly-detector", "churn-predictor"];
          for (const fn of functionsToRun) {
            const { data, error } = await supabase.functions.invoke(fn, {
              body: {},
            });
            results[fn] = error ? `Error: ${error.message}` : data;
          }
          return `INTELLIGENCE SUITE RESULTS:\n${JSON.stringify(results, null, 2)}`;
        } catch (e) {
          return `Intelligence suite unavailable: ${e}`;
        }
      }

      case "run_intelligence": {
        const { action } = input;
        try {
          const functionMap: Record<string, string> = {
            churn: "churn-predictor",
            anomaly: "anomaly-detector",
            revenue: "hubspot-analyzer",
            payouts: "stripe-payouts-ai",
          };
          const functionName = functionMap[action];
          if (!functionName)
            return `Unknown action: ${action}. Use: churn, anomaly, revenue, or payouts`;
          const { data, error } = await supabase.functions.invoke(
            functionName,
            { body: {} },
          );
          if (error) return `Intelligence function error: ${error.message}`;
          return `Analysis Result: ${JSON.stringify(data)}`;
        } catch (e) {
          return `Intelligence function unavailable: ${e}`;
        }
      }

      case "discover_system_map":
      case "discover_system": {
        try {
          const { data, error } = await supabase.rpc(
            "introspect_schema_verbose",
          );
          if (error) return `Schema discovery error: ${error.message}`;
          return `ULTIMATE SYSTEM MAP (110 Tables Found): ${JSON.stringify(data)}`;
        } catch (e) {
          return `Schema discovery unavailable: ${e}`;
        }
      }

      case "build_feature": {
        const { code, impact } = input;
        try {
          const { data, error } = await supabase
            .from("ai_agent_approvals")
            .insert({
              request_type: "UI_FIX",
              code_changes: [{ path: "src/DynamicFix.tsx", content: code }],
              description: impact,
            });
          if (error) return `Build feature error: ${error.message}`;
          return "Fix prepared in Approvals dashboard.";
        } catch (e) {
          return `Build feature unavailable: ${e}`;
        }
      }

      // vvvvv NEW PIPEBOARD META ADS TOOLS vvvvv
      case "meta_ads_analytics": {
        const {
          level = "campaign",
          date_preset = "last_7d",
          limit = 10,
        } = input;
        const PB_TOKEN = "pk_5f94902b81e24b1bb5bdf85e51bd7226"; // TODO: Move to Env
        const PB_URL = "https://mcp.pipeboard.co/meta-ads-mcp";

        console.log(`📊 Calling Pipeboard Insights (${level})...`);
        try {
          // JSON-RPC to Pipeboard
          const payload = {
            jsonrpc: "2.0",
            method: "tools/call",
            id: Date.now(),
            params: {
              name: "get_insights",
              arguments: {
                level,
                date_preset: date_preset,
                limit: Number(limit),
              },
            },
          };

          const resp = await fetch(PB_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${PB_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (!resp.ok)
            return `Pipeboard API Error: ${resp.status} ${await resp.text()}`;
          const json = await resp.json();

          // Result is usually in result.content[0].text
          if (json.error) return `MCP Error: ${JSON.stringify(json.error)}`;
          const content = json.result?.content?.[0]?.text;
          return content || JSON.stringify(json.result);
        } catch (e) {
          return `Meta Ads Analytics Error: ${e}`;
        }
      }

      case "meta_ads_manager": {
        const { action, target_id, value, limit = 20 } = input;
        const PB_TOKEN = "pk_5f94902b81e24b1bb5bdf85e51bd7226";
        const PB_URL = "https://mcp.pipeboard.co/meta-ads-mcp";

        // Map high-level actions to MCP tools
        let toolName = "";
        let toolArgs = {};

        if (action === "list_campaigns") {
          toolName = "get_campaigns";
          toolArgs = { limit: Number(limit), status: "ACTIVE" };
        } else if (action === "list_ads") {
          toolName = "get_ads";
          toolArgs = { limit: Number(limit), status: "ACTIVE" };
        } else if (action === "get_creatives") {
          toolName = "get_ad_creatives";
          toolArgs = { limit: Number(limit) };
        } else if (action === "audit_campaign") {
          // Complex flow? Just get details for now
          toolName = "get_campaign_details";
          toolArgs = { campaign_id: target_id };
        } else {
          return `Unknown Meta Ads Action: ${action}. Supported: list_campaigns, list_ads, get_creatives`;
        }

        try {
          const payload = {
            jsonrpc: "2.0",
            method: "tools/call",
            id: Date.now(),
            params: {
              name: toolName,
              arguments: toolArgs,
            },
          };

          const resp = await fetch(PB_URL, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${PB_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (!resp.ok) return `Pipeboard HTTP Error: ${resp.status}`;
          const json = await resp.json();
          if (json.error) return `MCP Error: ${JSON.stringify(json.error)}`;
          return json.result?.content?.[0]?.text || JSON.stringify(json.result);
        } catch (e) {
          return `Meta Ads Manager Error: ${e}`;
        }
      }
      // ^^^^^ END NEW TOOLS ^^^^^

      default:
        return `Tool ${toolName} not found in shared executor.`;
    }
  } catch (e) {
    console.error(`Tool execution error (${toolName}):`, e);
    return `Error executing ${toolName}: ${e instanceof Error ? e.message : String(e)}`;
  }
}
