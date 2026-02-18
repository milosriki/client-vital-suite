import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";

// ── Cache for business context (5 min TTL) ──
let cachedContext: { data: string; ts: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

const GEMINI_KEY = "AIzaSyC2g_C7zy5AaHvaCVyPICR_dIY4WcfzR8A";
const DEEPSEEK_KEY = Deno.env.get("DEEPSEEK_API_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    verifyAuth(req);
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { message, coach_filter } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Build business context (cached 5min) ──
    let businessContext: string;
    if (cachedContext && Date.now() - cachedContext.ts < CACHE_TTL_MS) {
      businessContext = cachedContext.data;
    } else {
      businessContext = await buildBusinessContext(supabase, coach_filter);
      cachedContext = { data: businessContext, ts: Date.now() };
    }

    const systemPrompt = `You are the AI Business Advisor for PTD Fitness, a premium personal training company in Dubai/Abu Dhabi.
You serve high-end clients (executives 40+) with packages from 3,520 to 41,616 AED.

${businessContext}

RULES:
1. ALWAYS reference specific client NAMES, PHONE NUMBERS, and EMAILS when discussing anyone.
2. Never say "consider monitoring" — say "Call [Name] at [Phone] TODAY because [specific reason]."
3. Every recommendation must include: WHO (name + phone), WHAT (specific action), WHEN (today/this week), WHY (data-backed reason).
4. Prioritize by AED impact — biggest revenue at risk first.
5. Use AED currency. Be direct, no fluff.
6. If asked about a specific coach, focus on their clients but compare to team averages.
7. For churn prevention: remaining sessions + days inactive + booking pattern = urgency level.
8. Always end with a prioritized action list: "DO THIS NOW" items.`;

    // ── Call Gemini (primary) ──
    let response: string;
    try {
      response = await callGemini(systemPrompt, message);
    } catch (geminiErr) {
      console.error("Gemini failed, trying DeepSeek:", geminiErr);
      if (DEEPSEEK_KEY) {
        response = await callDeepSeek(systemPrompt, message);
      } else {
        throw geminiErr;
      }
    }

    return new Response(
      JSON.stringify({ success: true, response, provider: "gemini" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("smart-ai-advisor error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ── Build rich business context from DB ──
async function buildBusinessContext(supabase: any, coachFilter?: string): Promise<string> {
  const [
    { data: packages },
    { data: healthScores },
    { data: predictions },
    { data: recentCalls },
  ] = await Promise.all([
    supabase.from("client_packages_live").select("*"),
    supabase.from("client_health_scores")
      .select("*")
      .order("calculated_on", { ascending: false })
      .limit(300),
    supabase.from("client_predictions").select("*"),
    supabase.from("call_records")
      .select("caller_number, started_at, call_status, call_direction, duration_seconds")
      .order("started_at", { ascending: false })
      .limit(500),
  ]);

  const pkgs = packages || [];
  const health = healthScores || [];
  const preds = predictions || [];
  const calls = recentCalls || [];

  // Build call history map (phone → last call date)
  const callMap = new Map<string, string>();
  for (const c of calls) {
    const phone = c.caller_number?.replace(/\D/g, "");
    if (phone && !callMap.has(phone)) {
      callMap.set(phone, c.started_at);
    }
  }

  // Health score map
  const healthMap = new Map<string, any>();
  for (const h of health) {
    if (h.email && !healthMap.has(h.email)) healthMap.set(h.email, h);
  }

  // Prediction map
  const predMap = new Map<string, any>();
  for (const p of preds) predMap.set(p.client_id, p);

  // Coach grouping
  const coachGroups = new Map<string, any[]>();
  for (const pkg of pkgs) {
    const coach = pkg.last_coach || "Unassigned";
    if (coachFilter && coach !== coachFilter) continue;
    const arr = coachGroups.get(coach) || [];
    arr.push(pkg);
    coachGroups.set(coach, arr);
  }

  // Health distribution
  const zones = { RED: 0, YELLOW: 0, GREEN: 0, PURPLE: 0 };
  for (const h of health) {
    if (h.health_zone && zones[h.health_zone as keyof typeof zones] !== undefined) {
      zones[h.health_zone as keyof typeof zones]++;
    }
  }

  // Build context
  const lines: string[] = [];
  lines.push("CURRENT BUSINESS STATE:");
  lines.push(`- Active packages: ${pkgs.length}`);
  lines.push(`- Total clients with predictions: ${preds.length}`);
  const totalRevAtRisk = preds.filter(p => p.churn_score >= 60).reduce((s: number, p: any) => s + (p.revenue_at_risk || 0), 0);
  lines.push(`- Total revenue at risk (churn>60%): AED ${totalRevAtRisk.toLocaleString()}`);
  lines.push(`- Health distribution: RED ${zones.RED}, YELLOW ${zones.YELLOW}, GREEN ${zones.GREEN}, PURPLE ${zones.PURPLE}`);
  lines.push(`- Coaches: ${Array.from(coachGroups.keys()).join(", ")}`);
  lines.push("");

  // Per-coach summary
  for (const [coach, clients] of coachGroups) {
    lines.push(`\nCOACH: ${coach} (${clients.length} clients)`);
    
    // Sort by churn risk desc
    const enriched = clients.map(pkg => {
      const pred = predMap.get(pkg.client_id);
      const h = pkg.client_email ? healthMap.get(pkg.client_email) : null;
      const phone = pkg.client_phone || pred?.churn_factors?.phone || "";
      const phoneClean = phone.replace(/\D/g, "");
      const lastCall = callMap.get(phoneClean);
      const now = new Date();
      const lastSession = pkg.last_session_date ? new Date(pkg.last_session_date) : null;
      const daysInactive = lastSession ? Math.floor((now.getTime() - lastSession.getTime()) / 86400000) : 999;

      return {
        name: pkg.client_name,
        email: pkg.client_email || "no email",
        phone: phone || "no phone",
        remaining: pkg.remaining_sessions ?? 0,
        packSize: pkg.pack_size ?? 0,
        value: pkg.package_value ?? 0,
        sessPerWeek: pkg.sessions_per_week ?? 0,
        futureBooked: pkg.future_booked ?? 0,
        lastSession: pkg.last_session_date?.split("T")[0] || "never",
        daysInactive,
        churnScore: pred?.churn_score ?? null,
        revenueAtRisk: pred?.revenue_at_risk ?? 0,
        healthZone: h?.health_zone || (pred?.churn_score >= 70 ? "RED" : pred?.churn_score >= 40 ? "YELLOW" : "GREEN"),
        healthScore: h?.health_score ?? null,
        predictedChurn: pred?.predicted_churn_date?.split("T")[0] || null,
        lastCallDate: lastCall?.split("T")[0] || "never called",
        depletion: pkg.depletion_priority || "LOW",
      };
    }).sort((a, b) => (b.churnScore ?? 0) - (a.churnScore ?? 0));

    for (const c of enriched) {
      const flags: string[] = [];
      if (c.remaining <= 1) flags.push("⚠️ DEPLETING");
      if (c.daysInactive > 14) flags.push(`🔴 ${c.daysInactive}d inactive`);
      if (c.futureBooked === 0) flags.push("❌ No bookings");
      if ((c.churnScore ?? 0) >= 60) flags.push(`🚨 Churn ${c.churnScore}%`);
      
      lines.push(`  - ${c.name} (${c.email}, ${c.phone}): ${c.healthZone} zone, score ${c.healthScore ?? "N/A"}, churn ${c.churnScore ?? "N/A"}%, ${c.remaining}/${c.packSize} sessions, last session ${c.lastSession} (${c.daysInactive}d ago), ${c.futureBooked} booked, AED ${c.value} pkg, last call ${c.lastCallDate}${flags.length ? " [" + flags.join(", ") + "]" : ""}`);
    }
  }

  // TOP RISK CLIENTS (RED zone or churn >= 60)
  lines.push("\n\nTOP RISK CLIENTS REQUIRING IMMEDIATE ACTION:");
  const allEnriched = pkgs.map(pkg => {
    const pred = predMap.get(pkg.client_id);
    const h = pkg.client_email ? healthMap.get(pkg.client_email) : null;
    const phone = pkg.client_phone || pred?.churn_factors?.phone || "";
    const phoneClean = phone.replace(/\D/g, "");
    const lastCall = callMap.get(phoneClean);
    const now = new Date();
    const lastSession = pkg.last_session_date ? new Date(pkg.last_session_date) : null;
    const daysInactive = lastSession ? Math.floor((now.getTime() - lastSession.getTime()) / 86400000) : 999;
    return {
      name: pkg.client_name,
      email: pkg.client_email || "",
      phone: phone || "no phone",
      coach: pkg.last_coach || "Unassigned",
      remaining: pkg.remaining_sessions ?? 0,
      value: pkg.package_value ?? 0,
      daysInactive,
      churnScore: pred?.churn_score ?? 0,
      revenueAtRisk: pred?.revenue_at_risk ?? 0,
      healthZone: h?.health_zone || "UNKNOWN",
      futureBooked: pkg.future_booked ?? 0,
      lastCallDate: lastCall?.split("T")[0] || "never called",
      predictedChurn: pred?.predicted_churn_date?.split("T")[0] || "N/A",
    };
  })
    .filter(c => c.churnScore >= 50 || c.remaining <= 2 || c.daysInactive > 21)
    .sort((a, b) => b.churnScore - a.churnScore || b.revenueAtRisk - a.revenueAtRisk)
    .slice(0, 30);

  for (const c of allEnriched) {
    lines.push(`  🚨 ${c.name} (📧 ${c.email}, 📱 ${c.phone}) — Coach: ${c.coach}`);
    lines.push(`     Churn: ${c.churnScore}% | AED ${c.revenueAtRisk} at risk | ${c.remaining} sessions left | ${c.daysInactive}d inactive | ${c.futureBooked} booked | Last call: ${c.lastCallDate} | Predicted churn: ${c.predictedChurn}`);
  }

  return lines.join("\n");
}

// ── Gemini API call ──
async function callGemini(systemPrompt: string, userMessage: string): Promise<string> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    },
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty Gemini response");
  return text;
}

// ── DeepSeek fallback ──
async function callDeepSeek(systemPrompt: string, userMessage: string): Promise<string> {
  const resp = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!resp.ok) throw new Error(`DeepSeek ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data?.choices?.[0]?.message?.content || "No response";
}
