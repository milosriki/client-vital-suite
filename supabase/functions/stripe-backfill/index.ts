import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { apiSuccess, apiCorsPreFlight } from "../_shared/api-response.ts";
import { corsHeaders } from "../_shared/error-handler.ts";
import { UnauthorizedError } from "../_shared/app-errors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return apiCorsPreFlight();

  try {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); }

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

    const body = await req.json().catch(() => ({}));
    const {
      days = 30,
      only = "all", // "all" | "customers" | "payments" | "invoices" | "subscriptions"
      startAfterDays = 0, // skip recent N days (for windowed calls)
    } = body;

    const startDate = Math.floor(Date.now() / 1000) - (days * 86400);
    const endDate = startAfterDays > 0
      ? Math.floor(Date.now() / 1000) - (startAfterDays * 86400)
      : undefined;

    console.log(`[stripe-backfill] mode=${only} days=${days} startAfterDays=${startAfterDays}`);

    const results: any = {};

    // Step 1: Pull all customers (build cust_id → email map) — only for "all" or "customers" mode
    const customerMap: Record<string, string> = {};
    if (only === "all" || only === "customers") {
      let custHasMore = true;
      let custStartingAfter: string | undefined;
      let custCount = 0;

      while (custHasMore) {
        const params: any = { limit: 100 };
        if (custStartingAfter) params.starting_after = custStartingAfter;
        const customers = await stripe.customers.list(params);
        for (const c of customers.data) {
          if (c.email) {
            customerMap[c.id] = c.email.toLowerCase();
            custCount++;
          }
        }
        custHasMore = customers.has_more;
        if (customers.data.length > 0) {
          custStartingAfter = customers.data[customers.data.length - 1].id;
        }
      }
      console.log(`[stripe-backfill] Found ${custCount} customers with email`);
      results.customers_found = custCount;
    }

    // Pre-load contact email→id map for fast lookups
    const contactMap: Record<string, string> = {};
    if (only === "all" || only === "payments") {
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, email")
        .not("email", "is", null);
      if (contacts) {
        for (const c of contacts) {
          if (c.email) contactMap[c.email.toLowerCase()] = c.id;
        }
      }
      console.log(`[stripe-backfill] Loaded ${Object.keys(contactMap).length} contacts`);
    }

    // Step 2: Pull payment intents
    if (only === "all" || only === "payments") {
      let piCount = 0, piLinked = 0;
      let piHasMore = true;
      let piStartingAfter: string | undefined;
      let batch: any[] = [];

      while (piHasMore) {
        const params: any = {
          created: endDate ? { gte: startDate, lt: endDate } : { gte: startDate },
          limit: 100,
          expand: ['data.latest_charge'],
        };
        if (piStartingAfter) params.starting_after = piStartingAfter;

        const paymentIntents = await stripe.paymentIntents.list(params);

        for (const pi of paymentIntents.data) {
          const charge = pi.latest_charge as any;
          const email = (charge?.receipt_email
            || charge?.billing_details?.email
            || (pi.customer && customerMap[pi.customer as string] ? customerMap[pi.customer as string] : null))?.toLowerCase() || null;

          const contactId = email ? (contactMap[email] || null) : null;
          if (contactId) piLinked++;

          batch.push({
            stripe_id: pi.id,
            charge_id: charge?.id || null,
            customer_id: pi.customer || null,
            amount: pi.amount / 100,
            currency: pi.currency,
            status: pi.status === 'succeeded' ? 'succeeded' : pi.status === 'canceled' ? 'cancelled' : pi.status,
            payment_method: pi.payment_method || null,
            description: pi.description || charge?.description || null,
            customer_email: email,
            contact_id: contactId,
            metadata: pi.metadata,
            created_at: new Date(pi.created * 1000).toISOString(),
          });
          piCount++;

          if (batch.length >= 50) {
            await supabase.from("stripe_transactions").upsert(batch, { onConflict: "stripe_id" });
            batch = [];
          }
        }

        piHasMore = paymentIntents.has_more;
        if (paymentIntents.data.length > 0) {
          piStartingAfter = paymentIntents.data[paymentIntents.data.length - 1].id;
        }
      }
      if (batch.length > 0) {
        await supabase.from("stripe_transactions").upsert(batch, { onConflict: "stripe_id" });
      }
      results.payment_intents = piCount;
      results.payment_intents_linked = piLinked;
    }

    // Step 3: Pull invoices
    if (only === "all" || only === "invoices") {
      let invCount = 0;
      let invHasMore = true;
      let invStartingAfter: string | undefined;
      let batch: any[] = [];

      while (invHasMore) {
        const params: any = {
          created: endDate ? { gte: startDate, lt: endDate } : { gte: startDate },
          limit: 100,
        };
        if (invStartingAfter) params.starting_after = invStartingAfter;

        const invoices = await stripe.invoices.list(params);

        for (const inv of invoices.data) {
          const email = inv.customer_email || (inv.customer ? customerMap[inv.customer as string] : null);
          batch.push({
            stripe_id: inv.id,
            customer_id: inv.customer || null,
            subscription_id: inv.subscription || null,
            amount_paid: (inv.amount_paid || 0) / 100,
            amount_due: (inv.amount_due || 0) / 100,
            currency: inv.currency,
            status: inv.status,
            paid: inv.paid,
            customer_email: email?.toLowerCase() || null,
            metadata: inv.metadata,
            created_at: new Date(inv.created * 1000).toISOString(),
          });
          invCount++;

          if (batch.length >= 50) {
            await supabase.from("stripe_invoices").upsert(batch, { onConflict: "stripe_id" });
            batch = [];
          }
        }

        invHasMore = invoices.has_more;
        if (invoices.data.length > 0) {
          invStartingAfter = invoices.data[invoices.data.length - 1].id;
        }
      }
      if (batch.length > 0) {
        await supabase.from("stripe_invoices").upsert(batch, { onConflict: "stripe_id" });
      }
      results.invoices = invCount;
    }

    // Step 4: Pull subscriptions
    if (only === "all" || only === "subscriptions") {
      let subCount = 0;
      let subHasMore = true;
      let subStartingAfter: string | undefined;
      let batch: any[] = [];

      while (subHasMore) {
        const params: any = { limit: 100, status: 'all' };
        if (subStartingAfter) params.starting_after = subStartingAfter;

        const subs = await stripe.subscriptions.list(params);

        for (const sub of subs.data) {
          batch.push({
            stripe_id: sub.id,
            customer_id: sub.customer || null,
            status: sub.status,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            metadata: sub.metadata,
            updated_at: new Date().toISOString(),
          });
          subCount++;

          if (batch.length >= 50) {
            await supabase.from("stripe_subscriptions").upsert(batch, { onConflict: "stripe_id" });
            batch = [];
          }
        }

        subHasMore = subs.has_more;
        if (subs.data.length > 0) {
          subStartingAfter = subs.data[subs.data.length - 1].id;
        }
      }
      if (batch.length > 0) {
        await supabase.from("stripe_subscriptions").upsert(batch, { onConflict: "stripe_id" });
      }
      results.subscriptions = subCount;
    }

    results.days_backfilled = days;
    console.log(`[stripe-backfill] Complete:`, JSON.stringify(results));

    return apiSuccess(results);
  } catch (error: any) {
    console.error("[stripe-backfill] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
