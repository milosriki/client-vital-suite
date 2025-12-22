import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { action, ...params } = await req.json();
    console.log(`[STRIPE-TREASURY] Action: ${action}`);

    // ==================== LIST FINANCIAL ACCOUNTS ====================
    if (action === "list-financial-accounts") {
      const accounts = await stripe.treasury.financialAccounts.list({ limit: 10 });
      
      return new Response(
        JSON.stringify({
          success: true,
          accounts: accounts.data,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== CREATE OUTBOUND TRANSFER ====================
    if (action === "create-outbound-transfer") {
      const { 
        amount, 
        currency, 
        financial_account, 
        destination_payment_method, 
        description, 
        statement_descriptor,
        metadata 
      } = params;

      if (!amount || !currency || !financial_account || !destination_payment_method) {
        throw new Error("Missing required parameters: amount, currency, financial_account, destination_payment_method");
      }

      console.log(`Creating outbound transfer: ${amount} ${currency} from ${financial_account}`);

      const transfer = await stripe.treasury.outboundTransfers.create({
        amount,
        currency,
        financial_account,
        destination_payment_method,
        description,
        statement_descriptor,
        metadata,
      });

      // Store in database
      const { error: dbError } = await supabase
        .from("stripe_outbound_transfers")
        .insert({
          stripe_id: transfer.id,
          financial_account_id: transfer.financial_account,
          amount: transfer.amount,
          currency: transfer.currency,
          status: transfer.status,
          description: transfer.description,
          statement_descriptor: transfer.statement_descriptor,
          destination_payment_method_id: transfer.destination_payment_method,
          destination_payment_method_details: transfer.destination_payment_method_details,
          expected_arrival_date: transfer.expected_arrival_date ? new Date(transfer.expected_arrival_date * 1000).toISOString() : null,
          created_at: new Date(transfer.created * 1000).toISOString(),
          metadata: transfer.metadata,
          raw_response: transfer,
        });

      if (dbError) {
        console.error("Error storing transfer in DB:", dbError);
        // We don't fail the request if DB storage fails, but we log it
      }

      return new Response(
        JSON.stringify({
          success: true,
          transfer: {
            id: transfer.id,
            amount: transfer.amount,
            currency: transfer.currency,
            status: transfer.status,
            created: transfer.created,
            expected_arrival_date: transfer.expected_arrival_date,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== GET OUTBOUND TRANSFER ====================
    if (action === "get-outbound-transfer") {
      const { id } = params;
      if (!id) throw new Error("Missing required parameter: id");

      const transfer = await stripe.treasury.outboundTransfers.retrieve(id);

      return new Response(
        JSON.stringify({
          success: true,
          transfer,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== LIST OUTBOUND TRANSFERS ====================
    if (action === "list-outbound-transfers") {
      const { financial_account, limit = 50, starting_after, status, created } = params;
      
      if (!financial_account) throw new Error("Missing required parameter: financial_account");

      const listParams: any = {
        financial_account,
        limit: Math.min(limit, 100),
      };

      if (starting_after) listParams.starting_after = starting_after;
      if (status) listParams.status = status;
      if (created) listParams.created = created;

      const transfers = await stripe.treasury.outboundTransfers.list(listParams);

      return new Response(
        JSON.stringify({
          success: true,
          transfers: transfers.data,
          has_more: transfers.has_more,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== CANCEL OUTBOUND TRANSFER ====================
    if (action === "cancel-outbound-transfer") {
      const { id } = params;
      if (!id) throw new Error("Missing required parameter: id");

      const transfer = await stripe.treasury.outboundTransfers.cancel(id);

      // Update DB
      await supabase
        .from("stripe_outbound_transfers")
        .update({
          status: transfer.status,
          updated_at: new Date().toISOString(),
          raw_response: transfer,
        })
        .eq("stripe_id", id);

      return new Response(
        JSON.stringify({
          success: true,
          transfer,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error("[STRIPE-TREASURY] Error:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        code: error.code,
        type: error.type,
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
