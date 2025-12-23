import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type StripeEventRow = {
  event_id: string;
  event_type: string;
  created_at: string;
  request_id?: string | null;
  raw_event?: any;
  data?: any;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials are not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { days = 90, limit = 500 } = await req.json().catch(() => ({ days: 90, limit: 500 }));
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: events, error } = await supabase
      .from("stripe_events")
      .select("event_id, event_type, created_at, request_id, raw_event, data")
      .gte("created_at", fromDate)
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 1000));

    if (error) throw error;

    const rows: StripeEventRow[] = events || [];

    const capabilityChanges = rows
      .filter((e) => e.event_type === "capability.updated" || e.event_type === "account.updated")
      .map((e) => {
        const obj = e.raw_event?.data?.object || e.data || {};
        return {
          event_id: e.event_id,
          event_type: e.event_type,
          created_at: e.created_at,
          request_id: e.request_id,
          capability_id: obj.id,
          status: obj.status,
          controller: obj.controller,
        };
      });

    const payouts = rows
      .filter((e) => e.event_type.startsWith("payout."))
      .map((e) => {
        const obj = e.raw_event?.data?.object || e.data || {};
        return {
          event_id: e.event_id,
          event_type: e.event_type,
          created_at: e.created_at,
          request_id: e.request_id,
          payout_id: obj.id,
          amount: obj.amount,
          currency: obj.currency,
          status: obj.status,
          method: obj.method,
          arrival_date: obj.arrival_date,
          destination: obj.destination,
        };
      });

    const disputes = rows
      .filter((e) => e.event_type.includes("dispute"))
      .map((e) => {
        const obj = e.raw_event?.data?.object || e.data || {};
        return {
          event_id: e.event_id,
          event_type: e.event_type,
          created_at: e.created_at,
          request_id: e.request_id,
          dispute_id: obj.id,
          amount: obj.amount,
          currency: obj.currency,
          status: obj.status,
          reason: obj.reason,
        };
      });

    const treasuryEvents = rows
      .filter((e) => e.event_type.startsWith("treasury.") || e.event_type.startsWith("v2.money_management"))
      .map((e) => ({
        event_id: e.event_id,
        event_type: e.event_type,
        created_at: e.created_at,
        request_id: e.request_id,
        payload: e.raw_event?.data?.object || e.data || {},
      }));

    const issuingEvents = rows
      .filter((e) => e.event_type.startsWith("issuing.") || e.event_type.startsWith("issuing_"))
      .map((e) => ({
        event_id: e.event_id,
        event_type: e.event_type,
        created_at: e.created_at,
        request_id: e.request_id,
        payload: e.raw_event?.data?.object || e.data || {},
      }));

    // Track deleted external accounts (bank accounts, cards, wallets)
    const deletedWallets = rows
      .filter((e) => 
        e.event_type === "account.external_account.deleted" ||
        e.event_type === "external_account.deleted" ||
        e.event_type.includes("bank_account.deleted") ||
        e.event_type.includes("card.deleted")
      )
      .map((e) => {
        const obj = e.raw_event?.data?.object || e.data || {};
        const prevAttrs = e.raw_event?.data?.previous_attributes || {};
        return {
          event_id: e.event_id,
          event_type: e.event_type,
          created_at: e.created_at,
          request_id: e.request_id,
          account_id: obj.account || obj.id,
          object_type: obj.object, // "bank_account", "card", etc.
          bank_name: obj.bank_name,
          last4: obj.last4,
          country: obj.country,
          currency: obj.currency,
          routing_number: obj.routing_number,
          fingerprint: obj.fingerprint,
          status: obj.status,
          default_for_currency: prevAttrs.default_for_currency || obj.default_for_currency,
          metadata: obj.metadata,
        };
      });

    const radarFindings = rows
      .filter((e) => e.event_type.startsWith("charge.") || e.event_type.startsWith("payment_intent."))
      .map((e) => {
        const obj = e.raw_event?.data?.object || e.data || {};
        const outcome = obj.outcome || obj.charges?.data?.[0]?.outcome || {};
        return {
          event_id: e.event_id,
          event_type: e.event_type,
          created_at: e.created_at,
          request_id: e.request_id,
          charge_id: obj.id || obj.latest_charge,
          risk_level: outcome.risk_level,
          risk_score: outcome.risk_score,
          seller_message: outcome.seller_message,
          type: outcome.type,
        };
      })
      .filter((r) => r.risk_level || r.risk_score !== undefined);

    // Extract daily sales (one-time payments)
    const dailySales = rows
      .filter((e) => 
        (e.event_type === "payment_intent.succeeded" || e.event_type === "charge.succeeded") &&
        !e.raw_event?.data?.object?.invoice // Exclude subscription invoices
      )
      .map((e) => {
        const obj = e.raw_event?.data?.object || e.data || {};
        return {
          event_id: e.event_id,
          event_type: e.event_type,
          created_at: e.created_at,
          request_id: e.request_id,
          payment_id: obj.id,
          customer_id: obj.customer,
          amount: obj.amount || obj.amount_received || 0,
          currency: obj.currency || "AED",
          status: obj.status,
          description: obj.description,
        };
      });

    // Extract renewals (subscription invoice payments)
    const renewals = rows
      .filter((e) => 
        e.event_type === "invoice.payment_succeeded" ||
        (e.event_type === "payment_intent.succeeded" && e.raw_event?.data?.object?.invoice)
      )
      .map((e) => {
        const obj = e.raw_event?.data?.object || e.data || {};
        const invoice = obj.invoice ? obj : (e.raw_event?.data?.previous_attributes?.invoice || {});
        return {
          event_id: e.event_id,
          event_type: e.event_type,
          created_at: e.created_at,
          request_id: e.request_id,
          invoice_id: obj.id || invoice.id,
          subscription_id: obj.subscription || invoice.subscription,
          customer_id: obj.customer || invoice.customer,
          amount: obj.amount_paid || obj.amount || 0,
          currency: obj.currency || invoice.currency || "AED",
          status: obj.status || "paid",
          period_start: obj.period_start || invoice.period_start,
          period_end: obj.period_end || invoice.period_end,
        };
      });

    // Calculate daily aggregates
    const salesByDate: Record<string, { count: number; total: number; currency: string }> = {};
    dailySales.forEach((sale) => {
      const date = new Date(sale.created_at).toISOString().split("T")[0];
      if (!salesByDate[date]) {
        salesByDate[date] = { count: 0, total: 0, currency: sale.currency };
      }
      salesByDate[date].count++;
      salesByDate[date].total += sale.amount / 100; // Convert from cents
    });

    const renewalsByDate: Record<string, { count: number; total: number; currency: string }> = {};
    renewals.forEach((renewal) => {
      const date = new Date(renewal.created_at).toISOString().split("T")[0];
      if (!renewalsByDate[date]) {
        renewalsByDate[date] = { count: 0, total: 0, currency: renewal.currency };
      }
      renewalsByDate[date].count++;
      renewalsByDate[date].total += renewal.amount / 100; // Convert from cents
    });

    // Get today's totals
    const today = new Date().toISOString().split("T")[0];
    const todaySales = salesByDate[today] || { count: 0, total: 0, currency: "AED" };
    const todayRenewals = renewalsByDate[today] || { count: 0, total: 0, currency: "AED" };

    return new Response(
      JSON.stringify({
        summary: {
          total_events: rows.length,
          window_days: days,
          today_sales: todaySales,
          today_renewals: todayRenewals,
          deleted_wallets_count: deletedWallets.length,
        },
        capabilityChanges,
        payouts,
        disputes,
        treasuryEvents,
        issuingEvents,
        radarFindings,
        deletedWallets,
        dailySales,
        renewals,
        salesByDate,
        renewalsByDate,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[stripe-history] Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

