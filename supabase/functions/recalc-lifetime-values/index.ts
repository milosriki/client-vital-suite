import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get all succeeded transactions grouped by email
    const { data: txns, error: txnErr } = await supabase
      .from("stripe_transactions")
      .select("customer_email, amount")
      .eq("status", "succeeded")
      .not("customer_email", "is", null);

    if (txnErr) throw txnErr;

    // Aggregate in memory
    const ltvMap = new Map<string, { total: number; count: number }>();
    for (const t of txns || []) {
      const email = t.customer_email?.toLowerCase();
      if (!email) continue;
      const existing = ltvMap.get(email) || { total: 0, count: 0 };
      existing.total += Number(t.amount) || 0;
      existing.count++;
      ltvMap.set(email, existing);
    }

    // 2. Update client_payment_history
    let updated = 0;
    let errors = 0;
    const topClients: Array<{ email: string; ltv: number; txns: number }> = [];

    // Sort by LTV desc
    const sorted = [...ltvMap.entries()].sort((a, b) => b[1].total - a[1].total);

    for (const [email, data] of sorted) {
      const { error } = await supabase
        .from("client_payment_history")
        .update({
          total_lifetime_value: Math.round(data.total * 100) / 100,
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);

      if (error) {
        errors++;
      } else {
        updated++;
      }

      if (topClients.length < 10) {
        topClients.push({
          email,
          ltv: Math.round(data.total * 100) / 100,
          txns: data.count,
        });
      }
    }

    // 3. Get packages at risk
    const { data: atRisk, error: riskErr } = await supabase
      .from("client_packages_live")
      .select("client_name, client_email, package_name, pack_size, remaining_sessions, package_value, depletion_priority")
      .lte("remaining_sessions", 3)
      .order("remaining_sessions", { ascending: true })
      .limit(20);

    if (riskErr) throw riskErr;

    const riskClients = (atRisk || []).map((r: any) => ({
      ...r,
      sessions_used: r.pack_size - r.remaining_sessions,
      alert_level: r.remaining_sessions < 0 ? "OVER-USED" : r.remaining_sessions <= 1 ? "CRITICAL" : "HIGH",
    }));

    return new Response(JSON.stringify({
      success: true,
      lifetime_values: {
        unique_emails: ltvMap.size,
        updated,
        errors,
        total_revenue_aed: Math.round(sorted.reduce((s, [, d]) => s + d.total, 0) * 100) / 100,
        top_10: topClients,
      },
      package_alerts: {
        total_at_risk: riskClients.length,
        critical: riskClients.filter((r: any) => r.alert_level === "CRITICAL").length,
        over_used: riskClients.filter((r: any) => r.alert_level === "OVER-USED").length,
        clients: riskClients,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
