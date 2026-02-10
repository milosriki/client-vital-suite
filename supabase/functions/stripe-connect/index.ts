import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DestinationChargeData {
  amount: number;
  currency?: string;
  destination_account: string;
  application_fee?: number;
  description?: string;
  metadata?: Record<string, string>;
}

interface TransferData {
  amount: number;
  currency?: string;
  destination: string;
  description?: string;
  metadata?: Record<string, string>;
  source_transaction?: string;
}

interface PayoutData {
  amount: number;
  currency?: string;
  connected_account: string;
  method?: "standard" | "instant";
  description?: string;
}

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
    const { action, data } = await req.json();

    console.log("[STRIPE-CONNECT] Action:", action);

    // List connected accounts
    if (action === "list-accounts") {
      const accounts = await stripe.accounts.list({
        limit: 100,
        ...data
      });

      console.log("[STRIPE-CONNECT] Accounts fetched:", accounts.data.length);

      return apiSuccess({
          accounts: accounts.data.map((acc: any) => ({
            id: acc.id,
            type: acc.type,
            email: acc.email,
            country: acc.country,
            charges_enabled: acc.charges_enabled,
            payouts_enabled: acc.payouts_enabled,
            capabilities: acc.capabilities,
            business_profile: acc.business_profile,
            created: acc.created,
            default_currency: acc.default_currency
          })),
          has_more: accounts.has_more,
          total: accounts.data.length
        });
    }

    // Get account details
    if (action === "get-account") {
      const { account_id } = data;
      
      const account = await stripe.accounts.retrieve(account_id);

      return apiSuccess({ account });
    }

    // Create connected account (Express)
    if (action === "create-account") {
      const { type, country, email, capabilities, business_type } = data;

      const account = await stripe.accounts.create({
        type: type || "express",
        country: country || "US",
        email,
        capabilities: capabilities || {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        business_type: business_type || "individual"
      });

      console.log("[STRIPE-CONNECT] Account created:", account.id);

      return apiSuccess({ account });
    }

    // Create account onboarding link
    if (action === "create-onboarding-link") {
      const { account_id, refresh_url, return_url } = data;

      const accountLink = await stripe.accountLinks.create({
        account: account_id,
        refresh_url: refresh_url || "https://example.com/reauth",
        return_url: return_url || "https://example.com/return",
        type: "account_onboarding"
      });

      console.log("[STRIPE-CONNECT] Onboarding link created for:", account_id);

      return apiSuccess({ url: accountLink.url, expires_at: accountLink.expires_at });
    }

    // Create dashboard login link for connected account
    if (action === "create-login-link") {
      const { account_id } = data;

      const loginLink = await stripe.accounts.createLoginLink(account_id);

      return apiSuccess({ url: loginLink.url });
    }

    // Create destination charge (payment to connected account)
    if (action === "create-destination-charge") {
      const chargeData = data as DestinationChargeData;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: chargeData.amount,
        currency: chargeData.currency || "usd",
        application_fee_amount: chargeData.application_fee,
        transfer_data: {
          destination: chargeData.destination_account
        },
        description: chargeData.description,
        metadata: chargeData.metadata,
        automatic_payment_methods: { enabled: true }
      });

      console.log("[STRIPE-CONNECT] Destination charge created:", paymentIntent.id);

      return apiSuccess({
          payment_intent: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
          status: paymentIntent.status
        });
    }

    // Create transfer to connected account
    if (action === "create-transfer") {
      const transferData = data as TransferData;

      const transfer = await stripe.transfers.create({
        amount: transferData.amount,
        currency: transferData.currency || "usd",
        destination: transferData.destination,
        description: transferData.description,
        metadata: transferData.metadata,
        source_transaction: transferData.source_transaction
      });

      console.log("[STRIPE-CONNECT] Transfer created:", transfer.id);

      return apiSuccess({ transfer });
    }

    // List transfers
    if (action === "list-transfers") {
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
      
      const transfers = await stripe.transfers.list({
        limit: 100,
        created: { gte: thirtyDaysAgo },
        ...data
      });

      console.log("[STRIPE-CONNECT] Transfers fetched:", transfers.data.length);

      return apiSuccess({
          transfers: transfers.data,
          has_more: transfers.has_more,
          total: transfers.data.length
        });
    }

    // Create payout to connected account's bank
    if (action === "create-payout") {
      const payoutData = data as PayoutData;

      const payout = await stripe.payouts.create(
        {
          amount: payoutData.amount,
          currency: payoutData.currency || "usd",
          method: payoutData.method || "standard",
          description: payoutData.description
        },
        { stripeAccount: payoutData.connected_account }
      );

      console.log("[STRIPE-CONNECT] Payout created:", payout.id, "for account:", payoutData.connected_account);

      return apiSuccess({ payout });
    }

    // Get connected account balance
    if (action === "get-account-balance") {
      const { account_id } = data;

      const balance = await stripe.balance.retrieve(
        {},
        { stripeAccount: account_id }
      );

      return apiSuccess({ balance });
    }

    // Get Connect dashboard data (overview)
    if (action === "dashboard") {
      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
      
      const [accounts, transfers, platformBalance] = await Promise.all([
        stripe.accounts.list({ limit: 100 }).catch(() => ({ data: [] })),
        stripe.transfers.list({ limit: 100, created: { gte: thirtyDaysAgo } }).catch(() => ({ data: [] })),
        stripe.balance.retrieve().catch(() => null)
      ]);

      const enabledAccounts = accounts.data.filter((a: any) => a.charges_enabled && a.payouts_enabled);
      const totalTransferred = transfers.data.reduce((sum: number, t: any) => sum + t.amount, 0);

      // Get balances for top connected accounts
      const accountBalances: any[] = [];
      for (const acc of accounts.data.slice(0, 5)) {
        try {
          const balance = await stripe.balance.retrieve({}, { stripeAccount: acc.id });
          accountBalances.push({
            account_id: acc.id,
            email: acc.email,
            available: balance.available,
            pending: balance.pending
          });
        } catch (e) {
          // Account might not have balance access
        }
      }

      console.log("[STRIPE-CONNECT] Dashboard data compiled");

      return apiSuccess({
          summary: {
            total_accounts: accounts.data.length,
            enabled_accounts: enabledAccounts.length,
            transfers_30d: transfers.data.length,
            total_transferred_30d: totalTransferred,
            platform_available: platformBalance?.available?.[0]?.amount || 0,
            platform_pending: platformBalance?.pending?.[0]?.amount || 0
          },
          accounts: accounts.data.slice(0, 10).map((acc: any) => ({
            id: acc.id,
            type: acc.type,
            email: acc.email,
            country: acc.country,
            charges_enabled: acc.charges_enabled,
            payouts_enabled: acc.payouts_enabled,
            business_profile: acc.business_profile,
            created: acc.created
          })),
          recent_transfers: transfers.data.slice(0, 10),
          account_balances: accountBalances,
          platform_balance: platformBalance
        });
    }

    throw new Error("Invalid action: " + action);
  } catch (error: unknown) {
    console.error("[STRIPE-CONNECT] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return apiError("INTERNAL_ERROR", JSON.stringify({ error: errorMessage }), 500);
  }
});
