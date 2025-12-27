import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckoutSessionData {
  mode: "payment" | "subscription" | "setup";
  success_url: string;
  cancel_url: string;
  line_items?: Array<{
    price?: string;
    price_data?: {
      currency: string;
      product_data: {
        name: string;
        description?: string;
        images?: string[];
      };
      unit_amount: number;
      recurring?: {
        interval: "day" | "week" | "month" | "year";
        interval_count?: number;
      };
    };
    quantity: number;
  }>;
  customer_email?: string;
  customer?: string;
  client_reference_id?: string;
  metadata?: Record<string, string>;
  payment_method_types?: string[];
  allow_promotion_codes?: boolean;
  billing_address_collection?: "auto" | "required";
  shipping_address_collection?: {
    allowed_countries: string[];
  };
  // Connect specific
  destination_account?: string;
  application_fee_amount?: number;
}

interface PaymentIntentData {
  amount: number;
  currency?: string;
  description?: string;
  customer?: string;
  metadata?: Record<string, string>;
  automatic_payment_methods?: boolean;
  return_url?: string;
  // Connect specific
  destination_account?: string;
  application_fee_amount?: number;
}

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
    const { action, data } = await req.json();

    console.log("[STRIPE-CHECKOUT] Action:", action);

    // Create checkout session (redirect-based)
    if (action === "create-session") {
      const sessionData = data as CheckoutSessionData;

      const sessionParams: any = {
        mode: sessionData.mode,
        success_url: sessionData.success_url,
        cancel_url: sessionData.cancel_url,
        line_items: sessionData.line_items,
        customer_email: sessionData.customer_email,
        customer: sessionData.customer,
        client_reference_id: sessionData.client_reference_id,
        metadata: sessionData.metadata,
        allow_promotion_codes: sessionData.allow_promotion_codes,
        billing_address_collection: sessionData.billing_address_collection
      };

      if (sessionData.payment_method_types) {
        sessionParams.payment_method_types = sessionData.payment_method_types;
      }

      if (sessionData.shipping_address_collection) {
        sessionParams.shipping_address_collection = sessionData.shipping_address_collection;
      }

      // Connect destination charge
      if (sessionData.destination_account) {
        sessionParams.payment_intent_data = {
          application_fee_amount: sessionData.application_fee_amount,
          transfer_data: {
            destination: sessionData.destination_account
          }
        };
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      console.log("[STRIPE-CHECKOUT] Session created:", session.id);

      return new Response(
        JSON.stringify({
          session_id: session.id,
          url: session.url,
          expires_at: session.expires_at
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create payment intent (embedded checkout)
    if (action === "create-payment-intent") {
      const intentData = data as PaymentIntentData;

      const intentParams: any = {
        amount: intentData.amount,
        currency: intentData.currency || "usd",
        description: intentData.description,
        customer: intentData.customer,
        metadata: intentData.metadata
      };

      if (intentData.automatic_payment_methods !== false) {
        intentParams.automatic_payment_methods = { enabled: true };
      }

      // Connect destination charge
      if (intentData.destination_account) {
        intentParams.application_fee_amount = intentData.application_fee_amount;
        intentParams.transfer_data = {
          destination: intentData.destination_account
        };
      }

      const paymentIntent = await stripe.paymentIntents.create(intentParams);

      console.log("[STRIPE-CHECKOUT] PaymentIntent created:", paymentIntent.id);

      return new Response(
        JSON.stringify({
          payment_intent_id: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
          status: paymentIntent.status
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Confirm payment intent (for redirect-based methods)
    if (action === "confirm-payment") {
      const { payment_intent_id, payment_method, return_url } = data;

      const paymentIntent = await stripe.paymentIntents.confirm(payment_intent_id, {
        payment_method,
        return_url
      });

      console.log("[STRIPE-CHECKOUT] PaymentIntent confirmed:", paymentIntent.id);

      return new Response(
        JSON.stringify({
          payment_intent_id: paymentIntent.id,
          status: paymentIntent.status,
          next_action: paymentIntent.next_action
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Retrieve payment intent (after redirect)
    if (action === "retrieve-payment-intent") {
      const { payment_intent_id } = data;

      const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

      return new Response(
        JSON.stringify({
          payment_intent_id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          payment_method: paymentIntent.payment_method,
          metadata: paymentIntent.metadata
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Retrieve checkout session
    if (action === "retrieve-session") {
      const { session_id } = data;

      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["line_items", "payment_intent", "customer"]
      });

      return new Response(
        JSON.stringify({
          session_id: session.id,
          status: session.status,
          payment_status: session.payment_status,
          customer_email: session.customer_email,
          amount_total: session.amount_total,
          currency: session.currency,
          payment_intent: session.payment_intent,
          line_items: session.line_items,
          customer: session.customer,
          metadata: session.metadata
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List checkout sessions
    if (action === "list-sessions") {
      const sessions = await stripe.checkout.sessions.list({
        limit: 100,
        ...data
      });

      return new Response(
        JSON.stringify({
          sessions: sessions.data.map((s: any) => ({
            id: s.id,
            status: s.status,
            payment_status: s.payment_status,
            customer_email: s.customer_email,
            amount_total: s.amount_total,
            currency: s.currency,
            created: s.created,
            expires_at: s.expires_at
          })),
          has_more: sessions.has_more,
          total: sessions.data.length
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create customer portal session (for managing subscriptions)
    if (action === "create-portal-session") {
      const { customer, return_url } = data;

      const session = await stripe.billingPortal.sessions.create({
        customer,
        return_url
      });

      console.log("[STRIPE-CHECKOUT] Portal session created for customer:", customer);

      return new Response(
        JSON.stringify({
          url: session.url
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create setup intent (for saving payment methods)
    if (action === "create-setup-intent") {
      const { customer, payment_method_types, metadata } = data;

      const setupIntent = await stripe.setupIntents.create({
        customer,
        payment_method_types: payment_method_types || ["card"],
        metadata
      });

      console.log("[STRIPE-CHECKOUT] SetupIntent created:", setupIntent.id);

      return new Response(
        JSON.stringify({
          setup_intent_id: setupIntent.id,
          client_secret: setupIntent.client_secret,
          status: setupIntent.status
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List payment methods for a customer
    if (action === "list-payment-methods") {
      const { customer, type } = data;

      const paymentMethods = await stripe.paymentMethods.list({
        customer,
        type: type || "card"
      });

      return new Response(
        JSON.stringify({
          payment_methods: paymentMethods.data.map((pm: any) => ({
            id: pm.id,
            type: pm.type,
            card: pm.card ? {
              brand: pm.card.brand,
              last4: pm.card.last4,
              exp_month: pm.card.exp_month,
              exp_year: pm.card.exp_year
            } : null,
            billing_details: pm.billing_details,
            created: pm.created
          })),
          total: paymentMethods.data.length
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Expire a checkout session
    if (action === "expire-session") {
      const { session_id } = data;

      const session = await stripe.checkout.sessions.expire(session_id);

      console.log("[STRIPE-CHECKOUT] Session expired:", session.id);

      return new Response(
        JSON.stringify({ session_id: session.id, status: session.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action: " + action);
  } catch (error) {
    console.error("[STRIPE-CHECKOUT] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
