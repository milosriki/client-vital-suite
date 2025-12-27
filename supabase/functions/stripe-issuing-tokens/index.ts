import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TokenListParams {
  includeDeleted?: boolean;
  status?: 'active' | 'suspended' | 'deleted' | 'requested';
  cardId?: string;
  dateFrom?: number; // Unix timestamp
  dateTo?: number;   // Unix timestamp
  limit?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    const params: TokenListParams = await req.json().catch(() => ({}));
    console.log("[stripe-issuing-tokens] Request params:", JSON.stringify(params));

    // Build Stripe API query params
    const listParams: Stripe.Issuing.TokenListParams = {
      limit: params.limit || 100,
    };

    // Add card filter
    if (params.cardId) {
      listParams.card = params.cardId;
    }

    // Add status filter
    if (params.status) {
      listParams.status = params.status;
    }

    // Add date range filters (created timestamp)
    if (params.dateFrom || params.dateTo) {
      listParams.created = {};
      if (params.dateFrom) listParams.created.gte = params.dateFrom;
      if (params.dateTo) listParams.created.lte = params.dateTo;
    }

    console.log("[stripe-issuing-tokens] Stripe params:", JSON.stringify(listParams));

    // Fetch tokens from Stripe
    const tokens = await stripe.issuing.tokens.list(listParams);
    console.log(`[stripe-issuing-tokens] Found ${tokens.data.length} tokens`);

    // Process and enrich token data
    const enrichedTokens = tokens.data.map((token: any) => ({
      id: token.id,
      card: token.card,
      status: token.status,
      created: token.created,
      createdDate: new Date(token.created * 1000).toISOString(),
      last_four: token.last_four,
      network: token.network,
      network_data: token.network_data,
      wallet_provider: token.wallet_provider,
      network_updated_at: token.network_updated_at,
      device: token.device,
    }));

    // Group by status for summary
    const summary = {
      total: enrichedTokens.length,
      byStatus: enrichedTokens.reduce((acc: Record<string, number>, t: any) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {}),
      hasMore: tokens.has_more,
    };

    return new Response(JSON.stringify({
      success: true,
      summary,
      tokens: enrichedTokens,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("[stripe-issuing-tokens] Error:", error.message);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeInvalidRequestError' || error.code === 'resource_missing') {
      return new Response(JSON.stringify({
        success: false,
        error: "Stripe Issuing is not enabled for this account",
        code: "issuing_not_enabled"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
