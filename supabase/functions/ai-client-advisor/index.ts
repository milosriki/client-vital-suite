import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GEMINI_KEY") ?? "";
const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY") ?? Deno.env.get("DEEPSEEK_KEY") ?? "";

async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
      }),
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response from Gemini";
}

async function callDeepSeek(prompt: string): Promise<string> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "You are a fitness business retention advisor. Give SPECIFIC, ACTIONABLE advice with names, dates, and exact steps. Never be generic." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "No response from DeepSeek";
}

async function callAI(prompt: string): Promise<string> {
  // Try Gemini first, fallback to DeepSeek
  if (GEMINI_KEY) {
    try { return await callGemini(prompt); } catch (_) { /* fallback */ }
  }
  if (DEEPSEEK_KEY) {
    try { return await callDeepSeek(prompt); } catch (_) { /* fallback */ }
  }
  return "No AI provider available. Set GEMINI_API_KEY or DEEPSEEK_API_KEY.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
        .select("client_id").eq("client_email", client_email).limit(1).single();
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
- Recent Sessions: ${recentSessions.slice(0, 5).map(s => `${new Date(s.training_date).toLocaleDateString()} (${s.status})`).join(", ") || "None"}
      `.trim());
    }

    const prompt = `You are a senior fitness business retention consultant. Today is ${now.toLocaleDateString()}.

Analyze these at-risk clients and provide SPECIFIC, ACTIONABLE intervention plans.

For EACH client, provide:
1. **Status Summary** (1 line: name, score, key issue)
2. **Root Cause** (why are they churning?)
3. **Specific Action** (EXACTLY what to do — not "monitor" but "Call [name] at [phone] about [specific issue] by [date]")
4. **Script/Talking Points** (2-3 bullet points for the call/message)
5. **Revenue Impact** (what we lose if we don't act)
6. **Priority** (CRITICAL/HIGH/MEDIUM with deadline)

BE SPECIFIC. Use their actual data. Reference exact dates, session counts, package details.

${clientContexts.join("\n\n---\n\n")}`;

    const aiResponse = await callAI(prompt);

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
      advisory: aiResponse,
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
