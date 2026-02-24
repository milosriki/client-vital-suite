/// <reference lib="deno.ns" />
import {
  withTracing,
  structuredLog,
  getCorrelationId,
} from "../_shared/observability.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAgentPrompt } from "../_shared/unified-prompts.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import {
  apiSuccess,
  apiError,
  apiCorsPreFlight,
} from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Try direct Gemini API first, fallback to Lovable
const geminiApiKey =
  Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
const useDirectGemini = !!geminiApiKey;

serve(async (req) => {
  try {
    verifyAuth(req);
  } catch {
    throw new UnauthorizedError();
  } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const now = new Date();
    const dubaiTime = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Dubai" }),
    );
    const currentHour = dubaiTime.getHours();

    // Get business rules
    const { data: businessRules } = await supabase
      .from("business_rules")
      .select("rule_name, rule_category, rule_config")
      .eq("is_active", true);

    const workingHoursRule = businessRules?.find(
      (r) => r.rule_name === "working_hours",
    );
    const isBusinessHours = currentHour >= 10 && currentHour < 20;

    // Get learned patterns for better recommendations
    const { data: learningRules } = await supabase
      .from("ai_learning_rules")
      .select("condition_pattern, action_pattern, confidence_score")
      .eq("is_active", true)
      .gte("confidence_score", 0.6)
      .order("success_count", { ascending: false })
      .limit(20);

    // Fetch data sources for insights
    const [
      { data: recentLeads },
      { data: recentCalls },
      { data: clientHealth },
      { data: enhancedLeads },
      { data: deals },
      { data: coachPerformance },
      { data: mlChurnPredictions },
      { data: revenueTriangle },
      { data: gpsAnomalies },
    ] = await Promise.all([
      supabase
        .from("leads")
        .select("id, email, phone, first_name, last_name, source, status, lead_score, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("call_records")
        .select("id, call_status, direction, caller_number, called_number, agent_name, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("client_health_scores")
        .select("id, email, client_name, health_score, health_zone, churn_risk_score, risk_level")
        .order("health_score", { ascending: true })
        .limit(50),
      // Using unified schema: contacts table instead of enhanced_leads
      supabase
        .from("contacts")
        .select("id, email, phone, first_name, last_name, lifecycle_stage, lead_status, follow_up_status, lead_score, budget_range, created_at")
        .eq("lifecycle_stage", "lead")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("deals")
        .select("id, deal_name, amount, stage, pipeline, contact_id, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("coach_performance")
        .select("id, coach_name, report_date, total_clients, avg_health_score, red_clients, clients_improving, clients_declining")
        .order("report_date", { ascending: false })
        .limit(10),
      // ML Churn: specific probability per client (from ml-churn-score output)
      supabase
        .from("client_predictions")
        .select("client_id, client_name, churn_score, churn_factors, revenue_at_risk, predicted_churn_date, updated_at")
        .gte("churn_score", 70)
        .order("churn_score", { ascending: false })
        .limit(10),
      // Revenue Truth Triangle: month-by-month Meta vs HubSpot vs Stripe
      supabase
        .from("view_truth_triangle")
        .select("month, meta_ad_spend, hubspot_deal_value, stripe_gross_revenue, true_roas_cash, gap_stripe_hubspot")
        .order("month", { ascending: false })
        .limit(2), // current + previous month
      // GPS anomalies: coaches with low truth score (missed visits)
      supabase
        .from("view_coach_behavior_scorecard")
        .select("coach_name, sessions_scheduled, gps_verified_visits, truth_score")
        .lt("truth_score", 60) // Below 60% GPS verification = anomaly
        .order("truth_score", { ascending: true })
        .limit(5),
    ]);

    const insights: any[] = [];

    // INSIGHT 1: Leads without follow-up (SLA breach risk)
    const leadsNeedingFollowUp =
      enhancedLeads?.filter((lead) => {
        const createdAt = new Date(lead.created_at);
        const minutesSinceCreation =
          (now.getTime() - createdAt.getTime()) / 60000;
        return (
          minutesSinceCreation > 30 &&
          lead.follow_up_status === "pending" &&
          isBusinessHours
        );
      }) || [];

    if (leadsNeedingFollowUp.length > 0) {
      insights.push({
        insight_type: "sla_breach_risk",
        priority: "critical",
        status: "active",
        recommended_action: `${leadsNeedingFollowUp.length} leads have exceeded 30-min SLA. Immediate callback required.`,
        reason: "Leads waiting > 30 minutes during business hours",
        best_call_time: "Now - During Business Hours",
        call_script:
          "Hi [Name], this is [Your Name] from PTD Fitness. I saw you just reached out - perfect timing! What fitness goals are you looking to achieve?",
      });
    }

    // INSIGHT 2: High-value leads to prioritize
    const highValueLeads =
      enhancedLeads?.filter(
        (lead) =>
          (lead.lead_score || 0) >= 70 ||
          lead.budget_range?.includes("15K") ||
          lead.budget_range?.includes("12K"),
      ) || [];

    if (highValueLeads.length > 0) {
      insights.push({
        insight_type: "high_value_lead",
        priority: "high",
        status: "active",
        recommended_action: `${highValueLeads.length} high-value leads identified. Prioritize these for senior closer assignment.`,
        reason: "Lead score ≥70 or premium budget range",
        best_call_time: isBusinessHours ? "Now" : "Tomorrow 10:00 AM Dubai",
        call_script:
          "Premium approach: Focus on exclusive 1-on-1 training, flexible scheduling, and proven results.",
      });
    }

    // INSIGHT 3: International numbers needing special routing
    const internationalLeads =
      enhancedLeads?.filter((lead) => {
        const phone = lead.phone || "";
        return phone.startsWith("+") && !phone.startsWith("+971");
      }) || [];

    if (internationalLeads.length > 0) {
      insights.push({
        insight_type: "international_routing",
        priority: "medium",
        status: "active",
        recommended_action: `${internationalLeads.length} international leads detected. Route to International Queue per playbook.`,
        reason: "Non-UAE phone numbers detected",
        best_call_time: "Verify timezone before calling",
        call_script:
          "Adjust for potential relocation to Dubai or remote coaching options.",
      });
    }

    // INSIGHT 4: Clients at churn risk (generic health zone)
    const atRiskClients =
      clientHealth?.filter(
        (client) =>
          client.health_zone === "RED" ||
          (client.churn_risk_score && client.churn_risk_score > 70),
      ) || [];

    if (atRiskClients.length > 0) {
      insights.push({
        insight_type: "churn_risk",
        priority: "critical",
        status: "active",
        recommended_action: `${atRiskClients.length} clients in RED zone. Urgent retention intervention needed.`,
        reason: "Health score critical or high churn probability",
        best_call_time: isBusinessHours ? "Today" : "Tomorrow 10:00 AM",
        call_script:
          'Check-in call: "Hi [Name], I noticed we haven\'t connected in a while. I wanted to personally check in and see how your fitness journey is going..."',
      });
    }

    // INSIGHT 4b: ML Churn Predictions (specific clients with probability + reason)
    if (mlChurnPredictions && mlChurnPredictions.length > 0) {
      const topChurner = mlChurnPredictions[0];
      const topReason = topChurner.churn_factors?.top_risk_factors?.[0] ?? "multiple risk signals";
      const totalRevAtRisk = mlChurnPredictions.reduce((sum: number, p: any) => sum + (p.revenue_at_risk || 0), 0);
      const clientList = mlChurnPredictions
        .slice(0, 5)
        .map((p: any) => `${p.client_name} (${p.churn_score}%)`)
        .join(", ");

      insights.push({
        insight_type: "ml_churn_predictions",
        priority: "critical",
        status: "active",
        recommended_action: `${mlChurnPredictions.length} clients with >70% ML churn probability. AED ${Math.round(totalRevAtRisk).toLocaleString()} revenue at risk. Top: ${clientList}. Top risk: ${topReason}.`,
        reason: `ML model identified high-probability churners from 33 behavioral features`,
        best_call_time: isBusinessHours ? "Now — CRITICAL retention window" : "Tomorrow 10:00 AM sharp",
        call_script: `Personal intervention: "Hi [Name], I'm personally reaching out because I care about your progress. I noticed we haven't seen you as often — what's been going on? Let's find a schedule that works for you."`,
      });
    }

    // INSIGHT 8: GPS Anomaly Alerts (coach accountability)
    if (gpsAnomalies && gpsAnomalies.length > 0) {
      const coachList = gpsAnomalies
        .map((c: any) => `${c.coach_name} (${Math.round(c.truth_score || 0)}% verified, ${c.sessions_scheduled ?? '?'} scheduled vs ${c.gps_verified_visits ?? '?'} GPS-confirmed)`)
        .join("; ");

      insights.push({
        insight_type: "gps_anomaly",
        priority: "high",
        status: "active",
        recommended_action: `${gpsAnomalies.length} coach(es) with GPS truth score <60%. Possible session inflation. Immediate manager review required. Coaches: ${coachList}.`,
        reason: "GPS-verified visits don't match scheduled/claimed sessions",
        best_call_time: isBusinessHours ? "Today — review before client billing" : "Tomorrow morning",
        call_script: `Manager action: "Review ${gpsAnomalies[0]?.coach_name}'s session log vs GPS data for the last 30 days. Cross-check with client sign-off sheets."`,
      });
    }

    // INSIGHT 9: Revenue Drop Alert (Truth Triangle)
    if (revenueTriangle && revenueTriangle.length >= 2) {
      const current = revenueTriangle[0] as any;
      const previous = revenueTriangle[1] as any;
      const stripeDrop = (previous.stripe_gross_revenue || 0) - (current.stripe_gross_revenue || 0);
      const dropPct = previous.stripe_gross_revenue > 0
        ? Math.round((stripeDrop / previous.stripe_gross_revenue) * 100)
        : 0;
      const hubspotStripeGap = current.gap_stripe_hubspot ?? 0;

      if (dropPct > 15) {
        insights.push({
          insight_type: "revenue_drop",
          priority: "critical",
          status: "active",
          recommended_action: `Stripe revenue dropped ${dropPct}% vs last month (AED ${Math.round(current.stripe_gross_revenue).toLocaleString()} vs AED ${Math.round(previous.stripe_gross_revenue).toLocaleString()}). True ROAS: ${(current.true_roas_cash || 0).toFixed(2)}x. Immediate review needed.`,
          reason: `Month-over-month Stripe cash drop >${dropPct}% (Truth Triangle validation)`,
          best_call_time: "CEO review today",
          call_script: `ATLAS analysis: Cross-check renewals pipeline, check payment failures in Stripe, verify no reconciliation errors.`,
        });
      }

      if (Math.abs(hubspotStripeGap) > 50000) {
        insights.push({
          insight_type: "revenue_discrepancy",
          priority: "high",
          status: "active",
          recommended_action: `AED ${Math.round(Math.abs(hubspotStripeGap)).toLocaleString()} gap between HubSpot deals and Stripe collections. ${hubspotStripeGap < 0 ? "HubSpot over-reporting" : "Stripe collecting more than booked — check for unrecorded deals"}.`,
          reason: "Truth Triangle: HubSpot deal value ≠ Stripe gross revenue",
          best_call_time: "Finance review this week",
          call_script: `Run stripe-forensics reconciliation and check for unlinked Stripe charges.`,
        });
      }
    }

    // INSIGHT 5: Missed calls to follow up
    const missedCalls =
      recentCalls?.filter(
        (call) =>
          call.call_status === "missed" || call.call_status === "no_answer",
      ) || [];

    if (missedCalls.length > 0 && isBusinessHours) {
      insights.push({
        insight_type: "missed_call_callback",
        priority: "high",
        status: "active",
        recommended_action: `${missedCalls.length} missed calls need callback. Second dial recommended.`,
        reason: "Unanswered inbound/outbound calls",
        best_call_time: "Within 2 hours of original call",
        call_script:
          "Hi [Name], I noticed we missed connecting earlier. Is now a good time to chat about your fitness goals?",
      });
    }

    // INSIGHT 6: Night freeze reminder
    if (!isBusinessHours) {
      insights.push({
        insight_type: "working_hours_notice",
        priority: "info",
        status: "active",
        recommended_action:
          "Off-hours (20:00-10:00 Dubai). No task creation or reassignment per playbook.",
        reason: "Outside business hours window",
        best_call_time: "Resume at 10:00 AM Dubai",
        call_script: "N/A - Queue tasks for next business day",
      });
    }

    // INSIGHT 7: Coach performance alerts
    const underperformingCoaches =
      coachPerformance?.filter(
        (coach) =>
          (coach.clients_red || 0) > 3 || (coach.avg_client_health || 100) < 50,
      ) || [];

    if (underperformingCoaches.length > 0) {
      insights.push({
        insight_type: "coach_performance",
        priority: "medium",
        status: "active",
        recommended_action: `${underperformingCoaches.length} coaches have elevated at-risk clients. Review required.`,
        reason: "Multiple clients in RED zone per coach",
        best_call_time: "During weekly review",
        call_script:
          "Internal: Schedule 1:1 with coach to review client portfolio and intervention strategies.",
      });
    }

    // Use Unified AI to enhance insights if available
    let aiEnhancedInsights = insights;
    if (insights.length > 0) {
      try {
        const learningContext =
          learningRules
            ?.map(
              (r) =>
                `Pattern: ${JSON.stringify(r.condition_pattern)} → ${JSON.stringify(r.action_pattern)} (confidence: ${r.confidence_score})`,
            )
            .join("\n") || "No learned patterns yet";

        const prompt = `${buildAgentPrompt("PROACTIVE_INSIGHTS", {
          includeROI: true,
          outputFormat: "EXECUTIVE_SUMMARY",
          additionalContext: `LEARNED PATTERNS FROM FEEDBACK:
${learningContext}

BUSINESS RULES:
- Working hours: 10:00-20:00 Dubai
- SLA: 30-min callback required
- International numbers: Route to International Queue
- Task minimization: Only high-value tasks

Return a JSON array of enhanced insights with improved call_script and recommended_action fields.`,
        })}

INPUT DATA:
Enhance these ${insights.length} insights with better call scripts and actions:\n${JSON.stringify(insights, null, 2)}`;

        const response = await unifiedAI.chat(
          [{ role: "user", content: prompt }],
          {
            jsonMode: true,
            temperature: 0.2,
          },
        );

        const content = response.content;
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            aiEnhancedInsights = JSON.parse(jsonMatch[0]);
          } else {
            // Try parsing the whole thing if no array brackets found, might be a single object or just JSON
            aiEnhancedInsights = JSON.parse(content);
          }
        } catch (e) {
          console.log("AI response not JSON, using original insights");
        }
      } catch (e) {
        console.log("AI enhancement failed, using original insights:", e);
      }
    }

    // Store insights in proactive_insights table
    if (aiEnhancedInsights.length > 0) {
      // Archive old active insights from this agent (not from ml-churn-score which manages its own)
      await supabase
        .from("proactive_insights")
        .update({ is_dismissed: true })
        .eq("source_agent", "proactive_insights_generator")
        .eq("is_dismissed", false);

      // Insert new insights using the real table schema:
      // id, insight_type, title, description, priority, data (JSONB), source_agent, is_dismissed, actioned_at, created_at
      const { error: insertError } = await supabase
        .from("proactive_insights")
        .insert(
          aiEnhancedInsights.map((insight) => ({
            insight_type: insight.insight_type,
            title: insight.recommended_action?.slice(0, 200) ?? insight.insight_type,
            description: insight.reason ?? null,
            priority: insight.priority,
            data: {
              recommended_action: insight.recommended_action,
              reason: insight.reason,
              best_call_time: insight.best_call_time,
              call_script: insight.call_script,
              status: "active",
            },
            source_agent: "proactive_insights_generator",
            is_dismissed: false,
          })),
        );

      if (insertError) {
        console.error("Insert error:", insertError);
      }
    }

    return apiSuccess({
      success: true,
      insights_generated: aiEnhancedInsights.length,
      is_business_hours: isBusinessHours,
      dubai_time: dubaiTime.toISOString(),
      insights: aiEnhancedInsights,
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return apiSuccess({ error: errorMessage });
  }
});
