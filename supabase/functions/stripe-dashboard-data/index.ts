import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    
    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });

    console.log("Fetching Stripe dashboard data...");

    // Fetch all data in parallel for efficiency
    const [
      balance,
      customers,
      subscriptions,
      payments,
      products,
      invoices,
      account
    ] = await Promise.all([
      stripe.balance.retrieve().catch((e: Error) => {
        console.error("Error fetching balance:", e.message);
        return null;
      }),
      stripe.customers.list({ limit: 50 }).catch((e: Error) => {
        console.error("Error fetching customers:", e.message);
        return { data: [] };
      }),
      stripe.subscriptions.list({ limit: 50, status: 'all' }).catch((e: Error) => {
        console.error("Error fetching subscriptions:", e.message);
        return { data: [] };
      }),
      stripe.paymentIntents.list({ limit: 50 }).catch((e: Error) => {
        console.error("Error fetching payments:", e.message);
        return { data: [] };
      }),
      stripe.products.list({ limit: 50 }).catch((e: Error) => {
        console.error("Error fetching products:", e.message);
        return { data: [] };
      }),
      stripe.invoices.list({ limit: 20 }).catch((e: Error) => {
        console.error("Error fetching invoices:", e.message);
        return { data: [] };
      }),
      stripe.accounts.retrieve().catch((e: Error) => {
        console.error("Error fetching account:", e.message);
        return null;
      })
    ]);

    console.log("Stripe data fetched successfully:", {
      customersCount: customers.data?.length || 0,
      subscriptionsCount: subscriptions.data?.length || 0,
      paymentsCount: payments.data?.length || 0,
      productsCount: products.data?.length || 0
    });

    return new Response(
      JSON.stringify({
        balance: balance,
        customers: customers.data || [],
        subscriptions: subscriptions.data || [],
        payments: payments.data || [],
        products: products.data || [],
        invoices: invoices.data || [],
        account: account
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in stripe-dashboard-data:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
