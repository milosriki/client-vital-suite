import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { corsHeaders } from "../_shared/error-handler.ts";
import { getConstitutionalSystemMessage } from "../_shared/constitutional-framing.ts";

const AdvisorOutputSchema = z.object({
  clients: z.array(z.object({
    name: z.string(),
    status_summary: z.string(),
    root_cause: z.string(),
    specific_action: z.string(),
    talking_points: z.array(z.string()),
    revenue_impact: z.string(),
    priority: z.enum(["CRITICAL", "HIGH", "MEDIUM"]),
  })),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authResponse = await verifyAuth(req);
  if (authResponse) return authResponse;

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const { client_email, mode } = body; // mode: "single" | "all-at-risk"

    const isAllAtRisk = mode === "all-at-risk" || !client_email;
    const now = new Date();

    // Load predictions with ML data
    let predictionsQuery = sb.from("client_predictions").select("*");
    if (!isAllAtRisk && client_email) {
      // Find by email via packages
      const { data: pkg } = await sb.from("client_packages_live")
        .select("client_id").eq("client_email", client_email).maybeSingle();
      if (pkg) predictionsQuery = predictionsQuery.eq("client_id", pkg.client_id);
    } else {
      predictionsQuery = predictionsQuery.gte("churn_score", 50).order("churn_score", { ascending: false }).limit(20);
    }
    const { data: predictions } = await predictionsQuery;

    if (!predictions?.length) {
      return new Response(JSON.stringify({ success: true, advisories: [], message: "No at-risk clients found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load features and packages
    const { data: allFeatures } = await sb.from("ml_client_features").select("*");
    const featuresByEmail = new Map<string, any>();
    for (const f of allFeatures ?? []) featuresByEmail.set(f.client_email, f);

    const { data: allPackages } = await sb.from("client_packages_live").select("*");
    const pkgByClientId = new Map<string, any>();
    const pkgByEmail = new Map<string, any>();
    for (const p of allPackages ?? []) {
      pkgByClientId.set(p.client_id, p);
      if (p.client_email) pkgByEmail.set(p.client_email.toLowerCase(), p);
    }

    // Build context for each client
    const clientContexts: string[] = [];
    for (const pred of predictions) {
      const pkg = pkgByClientId.get(pred.client_id);
      const email = pkg?.client_email?.toLowerCase();
      const features = email ? featuresByEmail.get(email)?.features : null;
      const cf = pred.churn_factors;

      // Load recent sessions for this client
      let recentSessions: any[] = [];
      if (email) {
        const { data } = await sb.from("training_sessions_live")
          .select("training_date,status,coach_name")
          .eq("client_email", email)
          .order("training_date", { ascending: false })
          .limit(10);
        recentSessions = data ?? [];
      }

      const daysInactive = cf?.days_since_last_session ?? features?.days_since_last_session ?? 0;
      const expiryDate = pkg?.expiry_date ? new Date(pkg.expiry_date).toLocaleDateString() : "N/A";

      clientContexts.push(`
CLIENT: ${pred.client_name}
- Email: ${email ?? "unknown"} | Phone: ${cf?.phone ?? "N/A"}
- Coach: ${cf?.coach ?? pkg?.last_coach ?? "Unknown"}
- CHURN SCORE: ${pred.churn_score}/100 (7d: ${cf?.ml_score_7d ?? "?"}, 30d: ${cf?.ml_score_30d ?? "?"}, 90d: ${cf?.ml_score_90d ?? "?"})
- ML Confidence: ${cf?.ml_confidence ?? "?"}%
- Revenue at Risk: $${pred.revenue_at_risk}
- Package: ${pkg?.package_name ?? "Unknown"} | ${pkg?.remaining_sessions ?? "?"}/${pkg?.pack_size ?? "?"} sessions left | Expires: ${expiryDate}
- Days Inactive: ${daysInactive} | Future Booked: ${cf?.future_booked ?? 0}
- Cancellation Rate: ${Math.round((cf?.cancel_rate ?? 0) * 100)}%
- Sessions (7d/30d/90d): ${features?.sessions_7d ?? "?"}/${features?.sessions_30d ?? "?"}/${features?.sessions_90d ?? "?"}
- Trend: ${features?.session_trend > 0 ? "↑ improving" : features?.session_trend < 0 ? "↓ declining" : "→ stable"}
- Momentum: ${features?.momentum_velocity > 0 ? "accelerating" : features?.momentum_velocity < 0 ? "decelerating" : "flat"}
- Top Risk Factors: ${(cf?.top_risk_factors ?? []).join(", ") || "None identified"}
- Recent Sessions: ${recentSessions.slice(0, 5).map((s: any) => `${new Date(s.training_date).toLocaleDateString()} (${s.status})`).join(", ") || "None"}
      `.trim());
    }

    const constitutionalPrefix = getConstitutionalSystemMessage();
    const systemPrompt = `${constitutionalPrefix}
You are a senior fitness business retention consultant for PTD Fitness Dubai. Today is ${now.toLocaleDateString()}.

OUTPUT FORMAT (strict JSON):
{
  "clients": [
    {
      "name": "<client name>",
      "status_summary": "<1-line summary: name, score, key issue>",
      "root_cause": "<why they are churning>",
      "specific_action": "<EXACTLY what to do, with names, phones, dates>",
      "talking_points": ["<point 1>", "<point 2>", "<point 3>"],
      "revenue_impact": "<what we lose if we don't act>",
      "priority": "<CRITICAL | HIGH | MEDIUM>"
    }
  ]
}

ERROR RECOVERY:
- If a client has incomplete data (no phone, no email), still provide advice but note "Contact info unavailable — ask reception".
- If churn_score is below 50, classify as MEDIUM and suggest proactive check-in rather than urgent intervention.
- If session data is empty, note "No session history available" and recommend a re-engagement call.

FEW-SHOT EXAMPLES:

Example 1 (CRITICAL — inactive high-value):
{
  "name": "Ahmed K.",
  "status_summary": "Ahmed K. — Score 92/100 — No sessions in 21 days, 3 sessions left on premium package expiring March 15",
  "root_cause": "Likely schedule conflict or dissatisfaction — went from 3x/week to zero with no cancellation call",
  "specific_action": "Call Ahmed at +971-50-XXX-XXXX today. Ask about schedule availability. Offer to rebook his remaining 3 sessions this week with Coach Sara.",
  "talking_points": ["We noticed you haven't been in — is everything okay with your schedule?", "You have 3 sessions left before March 15, let's make sure you get full value", "Coach Sara has morning slots Tuesday/Thursday if that works better"],
  "revenue_impact": "AED 4,500 package at risk + potential AED 18,000 annual renewal",
  "priority": "CRITICAL"
}

Example 2 (HIGH — declining frequency):
{
  "name": "Fatima R.",
  "status_summary": "Fatima R. — Score 71/100 — Dropped from 4 sessions/week to 1 over past month",
  "root_cause": "Gradual disengagement — cancellation rate jumped to 40%, possibly losing motivation",
  "specific_action": "WhatsApp Fatima by tomorrow. Share her progress photos from month 1 vs now. Suggest a goal review session with her coach.",
  "talking_points": ["Your transformation has been incredible — look at your month 1 vs now!", "Let's set a new 90-day goal to keep the momentum", "Would a different training time work better for your new schedule?"],
  "revenue_impact": "AED 2,800/month recurring revenue, AED 33,600 annual value",
  "priority": "HIGH"
}

BE SPECIFIC. Use actual data from the context. Reference exact dates, session counts, package details.`;

    const prompt = `Analyze these at-risk clients and return the JSON output:\n\n${clientContexts.join("\n\n---\n\n")}`;

    const aiResponse = await unifiedAI.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      {
        jsonMode: true,
        max_tokens: 2500,
        temperature: 0.3,
        agentType: "atlas",
        functionName: "ai-client-advisor"
      }
    );

    let advisoryText: string;
    try {
      const parsed = AdvisorOutputSchema.safeParse(JSON.parse(aiResponse.content));
      if (parsed.success) {
        advisoryText = parsed.data.clients
          .map(c => `**${c.name}** [${c.priority}]\n${c.status_summary}\nRoot Cause: ${c.root_cause}\nAction: ${c.specific_action}\nTalking Points:\n${c.talking_points.map(t => `  - ${t}`).join("\n")}\nRevenue Impact: ${c.revenue_impact}`)
          .join("\n\n---\n\n");
      } else {
        console.warn("[ai-client-advisor] Zod validation failed:", parsed.error.issues);
        advisoryText = aiResponse.content;
      }
    } catch {
      advisoryText = aiResponse.content;
    }

    // Store interventions
    const interventions = predictions.map(pred => {
      const pkg = pkgByClientId.get(pred.client_id);
      return {
        client_email: pkg?.client_email ?? pred.client_id,
        client_name: pred.client_name,
        intervention_type: "ai_advisor",
        urgency: pred.churn_score >= 80 ? "CRITICAL" : pred.churn_score >= 60 ? "HIGH" : "MEDIUM",
        action_text: `AI analysis generated for ${pred.client_name} (score: ${pred.churn_score})`,
        context: {
          churn_score: pred.churn_score,
          revenue_at_risk: pred.revenue_at_risk,
          generated_at: now.toISOString(),
        },
        status: "pending",
      };
    });

    // Don't fail if insert has issues
    try {
      await sb.from("ai_interventions").insert(interventions);
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({
      success: true,
      clients_analyzed: predictions.length,
      advisory: advisoryText,
      clients: predictions.map(p => ({
        name: p.client_name,
        score: p.churn_score,
        urgency: p.churn_factors?.action_urgency,
      })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});