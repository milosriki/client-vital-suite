import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unifiedAI } from "../_shared/unified-ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() });

    // 1. Load Reference Data
    const { data: catalog } = await supabase.from('package_catalog').select('*');
    const { data: activeClients } = await supabase.from('client_health_scores').select('*').gt('sessions_last_30d', 0);
    const { data: signatures } = await supabase.from('forensic_signatures').select('*');

    const auditResults = [];

    // 2. AUDIT: Stripe Invoices (Last 30 days)
    const invoices = await stripe.invoices.list({ limit: 100, status: 'paid', expand: ['data.payment_intent'] });
    
    for (const inv of invoices.data) {
      const pkgName = inv.lines.data[0]?.description || "";
      const isDuo = pkgName.toLowerCase().includes("duo");
      const amountPaid = inv.amount_paid / 100;
      
      const matchedPkg = catalog?.find((p: any) => pkgName.toLowerCase().includes(p.package_name.toLowerCase().split(' ')[0]));
      
      if (matchedPkg) {
        let expectedPrice = matchedPkg.base_price_aed;
        
        // Add Duo Premium (+100 AED per session)
        if (isDuo) {
          expectedPrice += (matchedPkg.session_count * matchedPkg.duo_premium_per_session);
        }

        const isFullPay = Math.abs(amountPaid - expectedPrice) < 5;
        const isInstallment = (matchedPkg.installment_plans || []).some((p: any) => Math.abs(amountPaid - p.amount) < 5);
        
        if (!isFullPay && !isInstallment) {
          auditResults.push({
            category: "PRICE_MISMATCH",
            severity: "high",
            client: inv.customer_email,
            package: pkgName,
            paid: amountPaid,
            expected: expectedPrice,
            details: `Price mismatch for ${pkgName}. Paid: ${amountPaid}, Expected: ${expectedPrice} (Duo: ${isDuo}).`
          });
        }
      }

      // Check for Manual Override (Marked Paid without Payment Intent)
      if (!inv.payment_intent) {
        auditResults.push({
          category: "FRAUD_SIGNATURE",
          severity: "critical",
          client: inv.customer_email,
          issue: "MANUAL_MARK_AS_PAID",
          details: `Invoice ${inv.id} for ${pkgName} was marked paid manually. No card transaction exists.`
        });
      }
    }

    // 3. RENEWAL PREDICTION & DEPLETION TRACKING
    const renewalsNeeded = [];
    for (const client of (activeClients || [])) {
      // Find latest Stripe Subscription or Invoice for session count
      const stripeCust = await stripe.customers.list({ email: client.email, limit: 1 });
      if (stripeCust.data.length > 0) {
        const invs = await stripe.invoices.list({ customer: stripeCust.data[0].id, limit: 5 });
        const lastInv = invs.data[0];
        const sessionsPurchased = catalog?.find((p: any) => lastInv?.lines.data[0]?.description?.includes(p.package_name))?.session_count || 0;
        
        // Calculate remaining sessions based on usage in DB
        // (Assuming we track sessions_remaining in client_health_scores)
        const weeklyUsage = client.sessions_last_30d / 4;
        const sessionsRemaining = client.sessions_remaining || 0; 
        
        if (sessionsRemaining < 3 && weeklyUsage > 0) {
          renewalsNeeded.push({
            client: client.email,
            name: `${client.firstname} ${client.lastname}`,
            remaining: sessionsRemaining,
            usage: weeklyUsage.toFixed(1),
            estDaysToRenewal: Math.round(sessionsRemaining / (weeklyUsage / 7))
          });
        }
      }
    }

    // 5. UPDATE DEEP CLIENT HISTORY (For CEO Dashboard)
    for (const client of (activeClients || [])) {
      const stripeCust = await stripe.customers.list({ email: client.email, limit: 1 });
      if (stripeCust.data.length > 0) {
        const customerId = stripeCust.data[0].id;
        
        // Fetch historical data
        const [allInvs, allPIs] = await Promise.all([
          stripe.invoices.list({ customer: customerId, status: 'paid', limit: 3 }),
          stripe.paymentIntents.list({ customer: customerId, limit: 10 })
        ]);

        const firstPurchaseDate = allInvs.data.length > 0 ? 
          new Date(allInvs.data[allInvs.data.length - 1].created * 1000).toISOString() : null;
        
        const last3Packages = allInvs.data.map((inv: any) => ({
          name: inv.lines.data[0]?.description || "Unknown",
          date: new Date(inv.created * 1000).toISOString(),
          amount: inv.amount_paid / 100
        }));

        const failedPIs = allPIs.data.filter((pi: any) => pi.status === 'requires_payment_method' || pi.status === 'canceled');
        const failedLog = failedPIs.map((pi: any) => ({
          date: new Date(pi.created * 1000).toISOString(),
          reason: pi.last_payment_error?.message || "Card Declined",
          amount: pi.amount / 100
        }));

        // Upsert into Supabase
        await supabase.from('client_payment_history').upsert({
          email: client.email,
          first_purchase_date: firstPurchaseDate,
          last_three_packages: last3Packages,
          failed_payment_count: failedPIs.length,
          failed_payment_log: failedLog,
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });
      }
    }
    let aiBriefing = "No AI Analysis Key";

    try {
      const response = await unifiedAI.chat([
        { role: "system", content: "You are the PTD Forensic Auditor. Analyze these discrepancies and renewal risks. Be blunt about manual marks-as-paid." },
        { role: "user", content: `Audit Data:\n${JSON.stringify({ auditResults, renewalsNeeded }, null, 2)}` }
      ], {
        max_tokens: 1500,
        temperature: 0.5
      });
      aiBriefing = response.content;
    } catch (e) {
      console.error("AI Analysis failed:", e);
      aiBriefing = "AI Analysis Failed";
    }

    return new Response(JSON.stringify({
      ok: true,
      auditCount: auditResults.length,
      alerts: auditResults,
      renewalPredictions: renewalsNeeded,
      aiBriefing
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
