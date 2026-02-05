import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
// stripe-account-details - Diagnostic endpoint for Stripe account investigation
// Fetches detailed account info including connected accounts and external accounts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { verifyAuth } from "../_shared/auth-middleware.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    try { verifyAuth(req); } catch(e) { return new Response("Unauthorized", {status: 401}); } // Security Hardening
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, accountId } = await req.json();
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // ===================================================================
    // ACTION: get-main-account
    // ===================================================================
    if (action === "get-main-account") {
      console.log("[STRIPE-ACCOUNT] Fetching main account details...");
      
      const account = await stripe.accounts.retrieve({
        expand: ["external_accounts", "settings.payouts"]
      });

      return new Response(JSON.stringify({
        success: true,
        type: "main-account",
        account: {
          id: account.id,
          business_profile: account.business_profile,
          capabilities: account.capabilities,
          charges_enabled: account.charges_enabled,
          country: account.country,
          created: account.created,
          default_currency: account.default_currency,
          details_submitted: account.details_submitted,
          email: account.email,
          external_accounts: account.external_accounts,
          payouts_enabled: account.payouts_enabled,
          settings: account.settings,
          type: account.type,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ===================================================================
    // ACTION: get-connected-account
    // ===================================================================
    if (action === "get-connected-account") {
      if (!accountId) throw new Error("accountId required for get-connected-account");
      console.log(`[STRIPE-ACCOUNT] Fetching connected account: ${accountId}`);
      
      const account = await stripe.accounts.retrieve(accountId, {
        expand: ["external_accounts", "settings.payouts"]
      });

      return new Response(JSON.stringify({
        success: true,
        type: "connected-account",
        account: {
          id: account.id,
          business_profile: account.business_profile,
          capabilities: account.capabilities,
          charges_enabled: account.charges_enabled,
          country: account.country,
          created: account.created,
          default_currency: account.default_currency,
          details_submitted: account.details_submitted,
          email: account.email,
          external_accounts: account.external_accounts,
          payouts_enabled: account.payouts_enabled,
          settings: account.settings,
          type: account.type,
          metadata: account.metadata,
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ===================================================================
    // ACTION: list-connected-accounts
    // ===================================================================
    if (action === "list-connected-accounts") {
      console.log("[STRIPE-ACCOUNT] Listing connected accounts...");
      
      const accounts = await stripe.accounts.list({ limit: 100 });

      return new Response(JSON.stringify({
        success: true,
        type: "connected-accounts-list",
        count: accounts.data.length,
        accounts: accounts.data.map((acc: any) => ({
          id: acc.id,
          email: acc.email,
          business_profile: acc.business_profile,
          charges_enabled: acc.charges_enabled,
          payouts_enabled: acc.payouts_enabled,
          type: acc.type,
          country: acc.country,
          default_currency: acc.default_currency,
          created: acc.created,
        }))
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ===================================================================
    // ACTION: get-full-diagnostic
    // ===================================================================
    if (action === "get-full-diagnostic") {
      console.log("[STRIPE-ACCOUNT] Running full diagnostic...");
      
      const [mainAccount, balance, connectedAccounts, payoutSchedule] = await Promise.all([
        stripe.accounts.retrieve({
          expand: ["external_accounts", "settings.payouts"]
        }).catch((e: any) => ({ error: e.message })),
        
        stripe.balance.retrieve().catch((e: any) => ({ error: e.message })),
        
        stripe.accounts.list({ limit: 20 }).catch((e: any) => ({ data: [], error: e.message })),
        
        // Get recent payouts to understand schedule
        stripe.payouts.list({ limit: 5 }).catch((e: any) => ({ data: [], error: e.message })),
      ]);

      // If specific account requested, fetch it too
      let specificAccount = null;
      if (accountId) {
        try {
          specificAccount = await stripe.accounts.retrieve(accountId, {
            expand: ["external_accounts", "settings.payouts"]
          });
        } catch (e: any) {
          specificAccount = { error: e.message };
        }
      }

      return new Response(JSON.stringify({
        success: true,
        type: "full-diagnostic",
        timestamp: new Date().toISOString(),
        
        mainAccount: {
          id: mainAccount.id,
          email: mainAccount.email,
          business_profile: mainAccount.business_profile,
          country: mainAccount.country,
          default_currency: mainAccount.default_currency,
          charges_enabled: mainAccount.charges_enabled,
          payouts_enabled: mainAccount.payouts_enabled,
          type: mainAccount.type,
          settings: mainAccount.settings,
          external_accounts: mainAccount.external_accounts,
        },
        
        balance: {
          available: balance.available,
          pending: balance.pending,
          connect_reserved: balance.connect_reserved,
        },
        
        connectedAccounts: {
          count: connectedAccounts.data?.length || 0,
          accounts: (connectedAccounts.data || []).map((acc: any) => ({
            id: acc.id,
            email: acc.email,
            business_name: acc.business_profile?.name,
            charges_enabled: acc.charges_enabled,
            payouts_enabled: acc.payouts_enabled,
            type: acc.type,
          }))
        },
        
        recentPayouts: (payoutSchedule.data || []).map((p: any) => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          arrival_date: p.arrival_date,
          automatic: p.automatic,
          destination: p.destination,
        })),
        
        specificAccount: specificAccount ? {
          id: specificAccount.id,
          email: specificAccount.email,
          business_profile: specificAccount.business_profile,
          external_accounts: specificAccount.external_accounts,
          settings: specificAccount.settings,
          error: specificAccount.error,
        } : null,
        
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    throw new Error("Invalid action. Use: get-main-account, get-connected-account, list-connected-accounts, get-full-diagnostic");

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[STRIPE-ACCOUNT] Error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
