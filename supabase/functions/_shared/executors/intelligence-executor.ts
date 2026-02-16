import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { IntelligenceService } from "../intelligence-service.ts";
import { LearningLayer } from "../learning-layer.ts";
import { checkDataFreshness, getFreshnessSummary } from "../data-freshness-sla.ts";

export async function executeIntelligenceTools(
  supabase: any,
  toolName: string,
  input: any,
): Promise<string> {
  switch (toolName) {
    case "intelligence_control": {
      const { action } = input;
      const intelligence = new IntelligenceService(supabase);

      if (action === "coach_retention") {
        const data = await intelligence.analyzeCoachRetention();
        return JSON.stringify(data, null, 2);
      }
      if (action === "goal_conversion") {
        const data = await intelligence.analyzeGoalConversion();
        return JSON.stringify(data, null, 2);
      }

      // === NEW: View-backed intelligence actions ===

      if (action === "get_lead_dna") {
        const { email, name, limit: queryLimit = 20 } = input;
        let query = supabase
          .from("view_atlas_lead_dna")
          .select("*");
        if (email) query = query.ilike("email", `%${email}%`);
        if (name) query = query.or(`firstname.ilike.%${name}%,lastname.ilike.%${name}%`);
        const { data, error } = await query.limit(queryLimit);
        if (error) return `Error querying lead DNA: ${error.message}`;
        return JSON.stringify({ source: "view_atlas_lead_dna", count: data?.length || 0, leads: data || [] }, null, 2);
      }

      if (action === "get_contact_360") {
        const { email, name, limit: queryLimit = 10 } = input;
        let query = supabase
          .from("view_contact_360")
          .select("*");
        if (email) query = query.ilike("email", `%${email}%`);
        if (name) query = query.or(`firstname.ilike.%${name}%,lastname.ilike.%${name}%`);
        const { data, error } = await query.limit(queryLimit);
        if (error) return `Error querying contact 360: ${error.message}`;
        return JSON.stringify({ source: "view_contact_360", count: data?.length || 0, contacts: data || [] }, null, 2);
      }

      if (action === "get_capacity_alert") {
        const { data, error } = await supabase
          .from("view_capacity_vs_spend")
          .select("*");
        if (error) return `Error querying capacity: ${error.message}`;
        return JSON.stringify({ source: "view_capacity_vs_spend", data: data || [] }, null, 2);
      }

      if (action === "get_discrepancies") {
        const { limit: queryLimit = 50 } = input;
        const { data, error } = await supabase
          .from("source_discrepancy_matrix")
          .select("*")
          .limit(queryLimit);
        if (error) return `Error querying discrepancies: ${error.message}`;
        return JSON.stringify({ source: "source_discrepancy_matrix", count: data?.length || 0, discrepancies: data || [] }, null, 2);
      }

      if (action === "get_marketing_attribution") {
        const { email, campaign_name, limit: queryLimit = 20 } = input;
        let query = supabase
          .from("view_marketing_attribution")
          .select("*");
        if (email) query = query.ilike("email", `%${email}%`);
        if (campaign_name) query = query.ilike("campaign_name", `%${campaign_name}%`);
        const { data, error } = await query.limit(queryLimit);
        if (error) return `Error querying attribution: ${error.message}`;
        return JSON.stringify({ source: "view_marketing_attribution", count: data?.length || 0, attribution: data || [] }, null, 2);
      }

      if (action === "data_freshness") {
        const results = await checkDataFreshness(supabase);
        const summary = getFreshnessSummary(results);
        return JSON.stringify({ ...summary, details: results }, null, 2);
      }

      return "Unknown intelligence action";
    }

    case "evolution_control": {
      const { action, feedback, category, thread_id } = input;
      const learningLayer = new LearningLayer(supabase);

      if (action === "record_feedback") {
        const result = await learningLayer.recordFeedback(
          feedback,
          category,
          thread_id,
        );
        return JSON.stringify(result);
      }
      return "Unknown evolution action";
    }

    case "get_at_risk_clients": {
      const { zone = "red", limit = 20 } = input;
      let query = supabase.from("client_health_scores").select("id, email, firstname, lastname, health_score, health_zone, assigned_coach, churn_risk_score, days_since_last_session, calculated_at");
      if (zone !== "all") {
        query = query.eq("health_zone", zone);
      }
      const { data } = await query
        .order("churn_risk_score", { ascending: false })
        .limit(limit);
      return JSON.stringify(data || []);
    }

    case "get_coach_clients": {
      const { coach_name } = input;
      const searchName = `%${coach_name}%`;

      const [clients, coachPerf] = await Promise.all([
        supabase
          .from("client_health_scores")
          .select("id, email, firstname, lastname, health_score, health_zone, assigned_coach, churn_risk_score, days_since_last_session")
          .ilike("assigned_coach", searchName)
          .order("health_score", { ascending: true }),
        supabase
          .from("coach_performance")
          .select("coach_name, report_date, performance_score, clients_at_risk, intervention_success_rate")
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
        .select("coach_name, report_date, performance_score, clients_at_risk, intervention_success_rate, total_clients, avg_health_score")
        .order("report_date", { ascending: false });
      if (coach_name) {
        query = query.ilike("coach_name", `%${coach_name}%`);
      }
      const { data } = await query.limit(20);
      return JSON.stringify(data || []);
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

    case "get_daily_summary": {
      const { date } = input;
      const targetDate = date || new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("daily_summary")
        .select("id, summary_date, total_leads, total_deals, total_revenue, health_summary, ai_insights, created_at")
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

    default:
      return `Tool ${toolName} not handled by Intelligence executor.`;
  }
}
