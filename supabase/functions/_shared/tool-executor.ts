import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { executeHubSpotTools } from "./executors/hubspot-executor.ts";
import { executeStripeTools } from "./executors/stripe-executor.ts";
import { executeCallGearTools } from "./executors/callgear-executor.ts";
import { executeForensicTools } from "./executors/forensic-executor.ts";
import { executeSystemTools } from "./executors/system-executor.ts";
import { executeIntelligenceTools } from "./executors/intelligence-executor.ts";
import { executeSalesTools } from "./executors/sales-executor.ts";
import { executeLocationTools } from "./executors/location-executor.ts";
import { executeMetaTools } from "./executors/meta-executor.ts";
import { executeAwsTools } from "./executors/aws-executor.ts";
import { executeErrorTools } from "./executors/error-executor.ts";
import { executeCommandCenterTools } from "./executors/command-center-executor.ts";

export async function executeSharedTool(
  supabase: any,
  toolName: string,
  input: any,
): Promise<string> {
  console.log(`🔧 Executing shared tool: ${toolName}`, input);

  try {
    // 1. HubSpot Tools
    if (
      ["client_control", "lead_control", "hubspot_control"].includes(toolName)
    ) {
      return await executeHubSpotTools(supabase, toolName, input);
    }

    // 2. Stripe Tools
    if (["stripe_control"].includes(toolName)) {
      return await executeStripeTools(supabase, toolName, input);
    }

    // 3. CallGear Tools
    if (
      [
        "call_control",
        "callgear_control",
        "callgear_supervisor",
        "callgear_live_monitor",
        "callgear_icp_router",
      ].includes(toolName)
    ) {
      return await executeCallGearTools(supabase, toolName, input);
    }

    // 4. Forensic Tools
    if (
      ["forensic_control", "validate_truth", "get_proactive_insights"].includes(
        toolName,
      )
    ) {
      return await executeForensicTools(supabase, toolName, input);
    }

    // 5. System Tools
    if (
      [
        "test_api_connections",
        "trigger_realtime_sync",
        "run_sql_query",
        "discover_system_map",
        "discover_system",
        "build_feature",
        "run_intelligence_suite",
        "run_intelligence",
      ].includes(toolName)
    ) {
      return await executeSystemTools(supabase, toolName, input);
    }

    // 6. Intelligence Tools
    if (
      [
        "intelligence_control",
        "evolution_control",
        "get_at_risk_clients",
        "get_coach_clients",
        "get_coach_performance",
        "analytics_control",
        "get_daily_summary",
      ].includes(toolName)
    ) {
      return await executeIntelligenceTools(supabase, toolName, input);
    }

    // 7. Sales Tools
    if (["sales_flow_control"].includes(toolName)) {
      return await executeSalesTools(supabase, toolName, input);
    }

    // 8. Location Tools
    if (["location_control"].includes(toolName)) {
      return await executeLocationTools(supabase, toolName, input);
    }

    // 9. Meta Tools
    if (["meta_ads_analytics", "meta_ads_manager"].includes(toolName)) {
      return await executeMetaTools(supabase, toolName, input);
    }

    // 10. AWS Tools
    if (["aws_data_query"].includes(toolName)) {
      return await executeAwsTools(supabase, toolName, input);
    }

    // 11. Legacy Universal Search (Kept here for now or moved to system?)
    if (toolName === "universal_search") {
      // Inline implementation for now to avoid complexity or move to system
      // For now, let's keep it here because it uses EVERYTHING
      return await executeUniversalSearch(supabase, input);
    }

    // 12. Error Tools
    if (
      [
        "system_error_audit",
        "analyze_error_patterns",
        "triage_error_batch",
        "resolve_error_batch",
      ].includes(toolName)
    ) {
      return await executeErrorTools(supabase, toolName, input);
    }

    // 13. Command Center Tools
    if (["command_center_control"].includes(toolName)) {
      return await executeCommandCenterTools(supabase, toolName, input);
    }

    // 14. Revenue Intelligence (calls stripe-dashboard-data, extracts metrics only)
    if (toolName === "revenue_intelligence") {
      const { period } = input;
      const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/stripe-dashboard-data`;
      console.log(`💰 Calling Revenue Intelligence: period=${period}`);
      
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ period: period || "last_30d" }),
      });

      if (!response.ok) {
        throw new Error(`Stripe dashboard failed: ${response.status}`);
      }

      const data = await response.json();
      // Extract ONLY the metrics object (raw response is 100KB+ of invoices)
      const m = data?.metrics || data?.data?.metrics || {};
      return JSON.stringify({
        mrr_aed: m.mrr ? (m.mrr / 100).toFixed(0) : "unknown",
        total_revenue_aed: m.totalRevenue ? (m.totalRevenue / 100).toFixed(0) : "unknown",
        net_revenue_aed: m.netRevenue ? (m.netRevenue / 100).toFixed(0) : "unknown",
        total_refunded_aed: m.totalRefunded ? (m.totalRefunded / 100).toFixed(0) : "unknown",
        paying_customers: m.payingCustomersCount || 0,
        active_subscriptions: m.activeSubscriptions || 0,
        canceled_subscriptions: m.canceledSubscriptions || 0,
        success_rate_pct: m.successRate || 0,
        currency: "AED",
        period: period || "last_30d",
        source: "stripe_live_api",
      });
    }

    // 15. The Truth Engine
    if (toolName === "marketing_truth_engine") {
      // Call the data-reconciler edge function
      const { date_range } = input;
      const functionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/data-reconciler`;

      console.log(
        `🔍 Calling Truth Engine: ${functionUrl} with range ${date_range}`,
      );

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ date_range }),
      });

      if (!response.ok) {
        throw new Error(
          `Data Reconciler failed: ${response.status} ${await response.text()}`,
        );
      }

      const data = await response.json();
      return JSON.stringify(data);
    }

    return `Tool ${toolName} not found in shared executor registry.`;
  } catch (e: any) {
    console.error(`Tool execution failed: ${e.message}`);
    return `Tool execution failed: ${e.message}`;
  }
}

// Extracted Universal Search to keep main function clean
async function executeUniversalSearch(supabase: any, input: any) {
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
        .select("id, first_name, last_name, email, phone, owner_name, lifecycle_stage, lead_status, city, location, hubspot_contact_id, first_touch_time, last_activity_date, created_at")
        .or(
          `phone.ilike.%${phoneCleaned}%,email.ilike.${searchLike},first_name.ilike.${searchLike},last_name.ilike.${searchLike},hubspot_contact_id.ilike.${searchLike},owner_name.ilike.${searchLike}`,
        )
        .limit(10),
      supabase
        .from("attribution_events")
        .select("id, email, campaign, campaign_name, ad_name, lead_score, lead_quality, conversion_status, fitness_goal, budget_range, urgency, dubai_area, phone")
        .or(`email.ilike.${searchLike},campaign.ilike.${searchLike}`)
        .limit(10),
      supabase
        .from("call_records")
        .select("id, caller_number, started_at, duration_seconds, call_outcome, call_status, call_direction")
        .or(`caller_number.ilike.%${phoneCleaned}%`)
        .order("started_at", { ascending: false })
        .limit(20),
      supabase
        .from("deals")
        .select("id, deal_name, deal_value, stage, status, close_date, hubspot_deal_id")
        .or(`deal_name.ilike.${searchLike},hubspot_deal_id.ilike.${searchLike}`)
        .limit(10),
      supabase
        .from("client_health_scores")
        .select("id, email, firstname, lastname, health_score, health_zone, assigned_coach, churn_risk_score")
        .or(
          `email.ilike.${searchLike},firstname.ilike.${searchLike},lastname.ilike.${searchLike}`,
        )
        .limit(5),
      supabase
        .from("contact_activities")
        .select("id, activity_type, activity_title, occurred_at, hubspot_contact_id")
        .or(`hubspot_contact_id.ilike.${searchLike}`)
        .order("occurred_at", { ascending: false })
        .limit(10),
    ]);

  const callAttempts = calls.data?.length || 0;
  const connectedCalls =
    calls.data?.filter((c: any) => c.call_status === "completed")?.length || 0;
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
      name: `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unknown",
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
      name: `${l.first_name || ""} ${l.last_name || ""}`.trim() || "Unknown",
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
      date: c.started_at, // Fixed typo from start_time
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
