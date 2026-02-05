import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { verifyAuth } from "../_shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CardholderData {
  name: string;
  email: string;
  phone_number?: string;
  type: "individual" | "company";
  billing: {
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
}

interface CardData {
  cardholder_id: string;
  currency?: string;
  type: "virtual" | "physical";
  status?: "active" | "inactive" | "canceled";
  spending_controls?: {
    spending_limits?: Array<{
      amount: number;
      interval: "per_authorization" | "daily" | "weekly" | "monthly" | "yearly" | "all_time";
    }>;
    allowed_categories?: string[];
    blocked_categories?: string[];
  };
  shipping?: {
    name: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
}

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
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

    console.log("[STRIPE-ISSUING] Action:", action);

    // List all cardholders
    if (action === "list-cardholders") {
      const cardholders = await stripe.issuing.cardholders.list({
        limit: 100,
        ...data
      });

      console.log("[STRIPE-ISSUING] Cardholders fetched:", cardholders.data.length);

      return new Response(
        JSON.stringify({
          cardholders: cardholders.data,
          has_more: cardholders.has_more,
          total: cardholders.data.length
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a cardholder
    if (action === "create-cardholder") {
      const cardholderData = data as CardholderData;
      
      const cardholder = await stripe.issuing.cardholders.create({
        name: cardholderData.name,
        email: cardholderData.email,
        phone_number: cardholderData.phone_number,
        type: cardholderData.type,
        billing: cardholderData.billing
      });

      console.log("[STRIPE-ISSUING] Cardholder created:", cardholder.id);

      return new Response(
        JSON.stringify({ cardholder }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List all cards
    if (action === "list-cards") {
      const cards = await stripe.issuing.cards.list({
        limit: 100,
        ...data
      });

      console.log("[STRIPE-ISSUING] Cards fetched:", cards.data.length);

      return new Response(
        JSON.stringify({
          cards: cards.data.map((card: any) => ({
            id: card.id,
            last4: card.last4,
            exp_month: card.exp_month,
            exp_year: card.exp_year,
            brand: card.brand,
            type: card.type,
            status: card.status,
            cardholder: card.cardholder,
            created: card.created,
            spending_controls: card.spending_controls,
            metadata: card.metadata
          })),
          has_more: cards.has_more,
          total: cards.data.length
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a card
    if (action === "create-card") {
      const cardData = data as CardData;

      const cardParams: any = {
        cardholder: cardData.cardholder_id,
        currency: cardData.currency || "usd",
        type: cardData.type,
        status: cardData.status || "active"
      };

      if (cardData.spending_controls) {
        cardParams.spending_controls = cardData.spending_controls;
      }

      if (cardData.type === "physical" && cardData.shipping) {
        cardParams.shipping = cardData.shipping;
      }

      const card = await stripe.issuing.cards.create(cardParams);

      console.log("[STRIPE-ISSUING] Card created:", card.id);

      return new Response(
        JSON.stringify({
          card: {
            id: card.id,
            last4: card.last4,
            exp_month: card.exp_month,
            exp_year: card.exp_year,
            brand: card.brand,
            type: card.type,
            status: card.status,
            cardholder: card.cardholder,
            created: card.created
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update card status
    if (action === "update-card") {
      const { card_id, status, spending_controls } = data;

      const updateParams: any = {};
      if (status) updateParams.status = status;
      if (spending_controls) updateParams.spending_controls = spending_controls;

      const card = await stripe.issuing.cards.update(card_id, updateParams);

      console.log("[STRIPE-ISSUING] Card updated:", card.id, "Status:", card.status);

      return new Response(
        JSON.stringify({ card }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List transactions
    if (action === "list-transactions") {
      const transactions = await stripe.issuing.transactions.list({
        limit: 100,
        ...data
      });

      console.log("[STRIPE-ISSUING] Transactions fetched:", transactions.data.length);

      return new Response(
        JSON.stringify({
          transactions: transactions.data.map((tx: any) => ({
            id: tx.id,
            amount: tx.amount,
            currency: tx.currency,
            type: tx.type,
            card: tx.card,
            cardholder: tx.cardholder,
            merchant_data: tx.merchant_data,
            created: tx.created,
            authorization: tx.authorization
          })),
          has_more: transactions.has_more,
          total: transactions.data.length
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List authorizations
    if (action === "list-authorizations") {
      const authorizations = await stripe.issuing.authorizations.list({
        limit: 100,
        ...data
      });

      console.log("[STRIPE-ISSUING] Authorizations fetched:", authorizations.data.length);

      return new Response(
        JSON.stringify({
          authorizations: authorizations.data.map((auth: any) => ({
            id: auth.id,
            amount: auth.amount,
            currency: auth.currency,
            status: auth.status,
            approved: auth.approved,
            card: auth.card,
            cardholder: auth.cardholder,
            merchant_data: auth.merchant_data,
            created: auth.created,
            authorization_method: auth.authorization_method
          })),
          has_more: authorizations.has_more,
          total: authorizations.data.length
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Approve/Decline authorization (for real-time authorization webhooks)
    if (action === "respond-authorization") {
      const { authorization_id, approved } = data;

      let authorization;
      if (approved) {
        authorization = await stripe.issuing.authorizations.approve(authorization_id);
      } else {
        authorization = await stripe.issuing.authorizations.decline(authorization_id);
      }

      console.log("[STRIPE-ISSUING] Authorization", approved ? "approved" : "declined", authorization.id);

      return new Response(
        JSON.stringify({ authorization }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get issuing dashboard data (overview)
    if (action === "dashboard") {
      const [cardholders, cards, transactions, authorizations] = await Promise.all([
        stripe.issuing.cardholders.list({ limit: 100 }).catch(() => ({ data: [] })),
        stripe.issuing.cards.list({ limit: 100 }).catch(() => ({ data: [] })),
        stripe.issuing.transactions.list({ 
          limit: 100,
          created: { gte: Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60) }
        }).catch(() => ({ data: [] })),
        stripe.issuing.authorizations.list({
          limit: 50,
          status: "pending"
        }).catch(() => ({ data: [] }))
      ]);

      const totalSpend = transactions.data.reduce((sum: number, tx: any) => 
        tx.type === "capture" ? sum + Math.abs(tx.amount) : sum, 0);
      
      const activeCards = cards.data.filter((c: any) => c.status === "active").length;
      const virtualCards = cards.data.filter((c: any) => c.type === "virtual").length;
      const physicalCards = cards.data.filter((c: any) => c.type === "physical").length;

      console.log("[STRIPE-ISSUING] Dashboard data compiled");

      return new Response(
        JSON.stringify({
          summary: {
            total_cardholders: cardholders.data.length,
            total_cards: cards.data.length,
            active_cards: activeCards,
            virtual_cards: virtualCards,
            physical_cards: physicalCards,
            pending_authorizations: authorizations.data.length,
            total_spend_30d: totalSpend,
            transactions_30d: transactions.data.length
          },
          cardholders: cardholders.data.slice(0, 10),
          cards: cards.data.slice(0, 10).map((c: any) => ({
            id: c.id,
            last4: c.last4,
            exp_month: c.exp_month,
            exp_year: c.exp_year,
            type: c.type,
            status: c.status,
            cardholder: c.cardholder
          })),
          recent_transactions: transactions.data.slice(0, 10).map((tx: any) => ({
            id: tx.id,
            amount: tx.amount,
            currency: tx.currency,
            merchant_data: tx.merchant_data,
            created: tx.created
          })),
          pending_authorizations: authorizations.data.map((auth: any) => ({
            id: auth.id,
            amount: auth.amount,
            currency: auth.currency,
            merchant_data: auth.merchant_data,
            created: auth.created
          }))
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action: " + action);
  } catch (error) {
    console.error("[STRIPE-ISSUING] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Check for specific Stripe errors
    if (errorMessage.includes("Issuing is not available")) {
      return new Response(
        JSON.stringify({ 
          error: "Stripe Issuing is not enabled for this account. Please contact Stripe to enable Issuing.",
          code: "issuing_not_enabled"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
