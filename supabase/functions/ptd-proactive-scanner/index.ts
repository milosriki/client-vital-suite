import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
// supabase/functions/ptd-proactive-scanner/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
serve(async (req) => {
  try {
    verifyAuth(req); // Security Hardening
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    console.log("🔍 Starting Proactive Scan...");

    // 1. Check for Churn Risks (Guardian)
    const { data: atRiskClients } = await supabase
      .from("client_health_scores")
      .select("contact_id, email, health_score, health_zone, days_since_last_session, assigned_coach")
      .eq("health_zone", "red")
      .limit(5);

    if (atRiskClients && atRiskClients.length > 0) {
      for (const client of atRiskClients) {
        // Create an insight
        await supabase.from("proactive_insights").insert({
          insight_type: "churn_risk",
          title: `High Churn Risk: ${client.email}`,
          description: `Client has health score ${client.health_score}. Last session: ${client.days_since_last_session} days ago.`,
          priority: "high",
          data: client,
          source_agent: "guardian_scanner",
        });
      }
    }

    // 2. Check for Stale Leads (Hunter) - Using unified schema: contacts table
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: staleLeads } = await supabase
      .from("contacts")
      .select("id, email, first_name, last_name, lifecycle_stage, lead_status, created_at")
      .eq("lifecycle_stage", "lead")
      .lt("created_at", twoDaysAgo)
      .limit(5);

    if (staleLeads && staleLeads.length > 0) {
      for (const lead of staleLeads) {
        await supabase.from("proactive_insights").insert({
          insight_type: "stale_lead",
          title: `Stale Lead Detected: ${lead.email}`,
          description: `Lead created > 48h ago with no contact logged.`,
          priority: "medium",
          data: lead,
          source_agent: "hunter_scanner",
        });
      }
    }

    // 3. Check for Failed Payments (Revenue)
    // Call the specialist Stripe agent
    const stripeRes = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/stripe-forensics`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "fraud_scan", days: 1 }),
      },
    );

    if (stripeRes.ok) {
      const stripeData = await stripeRes.json();
      const alerts = stripeData.alerts || [];

      for (const alert of alerts) {
        await supabase.from("proactive_insights").insert({
          insight_type: "revenue_risk",
          title: `Stripe Alert: ${alert.title || "Payment Issue"}`,
          description: alert.description || "Detected by Stripe Forensics",
          priority: "critical",
          data: alert,
          source_agent: "revenue_scanner",
        });
      }
    }

    return apiSuccess({ success: true, message: "Scan completed" });
  } catch (error: unknown) {
    console.error("Scanner Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return apiError("INTERNAL_ERROR", message, 500);
  }
});
