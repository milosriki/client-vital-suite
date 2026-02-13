import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback currency rates to AED (used if org_memory_kv lookup fails)
const FALLBACK_RATES: Record<string, number> = {
  "aed": 1,
  "usd": 3.67,
  "eur": 4.00,
  "gbp": 4.65,
  "sar": 0.98,
  "jpy": 0.025,
  "cad": 2.70,
  "aud": 2.40,
  "chf": 4.15,
  "inr": 0.044,
};

// In-memory cache: refreshed once per invocation (edge function cold start)
let CURRENCY_TO_AED: Record<string, number> = { ...FALLBACK_RATES };
let ratesLoaded = false;

async function loadCurrencyRates(): Promise<void> {
  if (ratesLoaded) return;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await supabase
      .from("org_memory_kv")
      .select("value")
      .eq("namespace", "config")
      .eq("key", "currency_rates_aed")
      .maybeSingle();

    if (data?.value && typeof data.value === "object") {
      CURRENCY_TO_AED = { ...FALLBACK_RATES, ...(data.value as Record<string, number>) };
    }
  } catch {
    // Fallback to hardcoded rates on error — non-critical
  }
  ratesLoaded = true;
}

/**
 * Converts any currency amount to AED
 * @param amount - Amount in smallest currency unit (cents/fils)
 * @param currency - ISO currency code
 * @returns Amount converted to AED in smallest unit
 */
function convertToAED(amount: number, currency: string): number {
  const currencyLower = currency.toLowerCase();
  const rate = CURRENCY_TO_AED[currencyLower] || 1;
  return Math.round(amount * rate);
}

/**
 * Formats amount from smallest unit to major unit with AED currency
 * @param amount - Amount in fils (smallest AED unit)
 * @returns Formatted string like "1,234.56 AED"
 */
function formatAED(amount: number): string {
  return `${(amount / 100).toFixed(2)} AED`;
}

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  try {
    // Load live currency rates from org_memory_kv (falls back to hardcoded)
    await loadCurrencyRates();

    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const langsmithConfigured = !!Deno.env.get("LANGSMITH_API_KEY");

    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

    // Parse request body for date range and filters
    const body = await req.json().catch(() => ({}));
    const { startDate, endDate, status, limit = 100 } = body;

    console.log("Fetching Stripe dashboard data with filters:", { startDate, endDate, status, limit });

    // Build date range query params
    const createdFilter: any = {};
    if (startDate) {
      createdFilter.gte = Math.floor(new Date(startDate).getTime() / 1000);
    }
    if (endDate) {
      createdFilter.lte = Math.floor(new Date(endDate).getTime() / 1000);
    }

    const hasDateFilter = Object.keys(createdFilter).length > 0;

    // Fetch all data in parallel for efficiency
    const [
      balance,
      customers,
      subscriptions,
      payments,
      products,
      invoices,
      charges,
      payouts,
      refunds,
      account,
      treasuryTransfers
    ] = await Promise.all([
      stripe.balance.retrieve().catch((e: Error) => {
        console.error("Error fetching balance:", e.message);
        return null;
      }),
      stripe.customers.list({ 
        limit: Math.min(limit, 100),
        ...(hasDateFilter && { created: createdFilter })
      }).catch((e: Error) => {
        console.error("Error fetching customers:", e.message);
        return { data: [] };
      }),
      stripe.subscriptions.list({ 
        limit: Math.min(limit, 100), 
        status: status || 'all',
        ...(hasDateFilter && { created: createdFilter })
      }).catch((e: Error) => {
        console.error("Error fetching subscriptions:", e.message);
        return { data: [] };
      }),
      stripe.paymentIntents.list({ 
        limit: Math.min(limit, 100),
        ...(hasDateFilter && { created: createdFilter })
      }).catch((e: Error) => {
        console.error("Error fetching payments:", e.message);
        return { data: [] };
      }),
      stripe.products.list({ limit: Math.min(limit, 100), active: true }).catch((e: Error) => {
        console.error("Error fetching products:", e.message);
        return { data: [] };
      }),
      stripe.invoices.list({ 
        limit: Math.min(limit, 100),
        ...(hasDateFilter && { created: createdFilter })
      }).catch((e: Error) => {
        console.error("Error fetching invoices:", e.message);
        return { data: [] };
      }),
      stripe.charges.list({
        limit: Math.min(limit, 100),
        ...(hasDateFilter && { created: createdFilter })
      }).catch((e: Error) => {
        console.error("Error fetching charges:", e.message);
        return { data: [] };
      }),
      stripe.payouts.list({
        limit: Math.min(limit, 100),
        ...(hasDateFilter && { created: createdFilter })
      }).catch((e: Error) => {
        console.error("Error fetching payouts:", e.message);
        return { data: [] };
      }),
      stripe.refunds.list({
        limit: Math.min(limit, 50),
        ...(hasDateFilter && { created: createdFilter })
      }).catch((e: Error) => {
        console.error("Error fetching refunds:", e.message);
        return { data: [] };
      }),
      stripe.accounts.retrieve().catch((e: Error) => {
        console.error("Error fetching account:", e.message);
        return null;
      }),
      stripe.treasury.outboundTransfers.list({
        limit: Math.min(limit, 100),
        ...(hasDateFilter && { created: createdFilter })
      }).catch((e: Error) => {
        console.error("Error fetching treasury transfers:", e.message);
        return { data: [] };
      })
    ]);

    // Calculate metrics - ALL AMOUNTS NORMALIZED TO AED
    const paymentsData = payments.data || [];
    const chargesData = charges.data || [];
    const payoutsData = payouts.data || [];
    const refundsData = refunds.data || [];
    const subscriptionsData = subscriptions.data || [];

    const successfulPayments = paymentsData.filter((p: any) => p.status === "succeeded");
    const failedPayments = paymentsData.filter((p: any) => p.status === "canceled" || p.status === "requires_payment_method");

    // Identify customers who have actually paid (successful payments or paid charges)
    const payingCustomerIds = new Set<string>();

    successfulPayments.forEach((payment: any) => {
      const customerId = typeof payment.customer === "string" ? payment.customer : payment.customer?.id;
      if (customerId) {
        payingCustomerIds.add(customerId);
      }
    });

    chargesData
      .filter((charge: any) => charge.status === "succeeded" && charge.paid)
      .forEach((charge: any) => {
        const customerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
        if (customerId) {
          payingCustomerIds.add(customerId);
        }
      });

    const customersData = customers.data || [];
    const payingCustomers = customersData.filter((customer: any) => payingCustomerIds.has(customer.id));

    // Convert all amounts to AED for consistent reporting
    const totalRevenue = successfulPayments.reduce(
      (sum: number, p: any) => sum + convertToAED(p.amount || 0, p.currency || "aed"),
      0
    );
    const totalRefunded = refundsData.reduce(
      (sum: number, r: any) => sum + convertToAED(r.amount || 0, r.currency || "aed"),
      0
    );
    const netRevenue = totalRevenue - totalRefunded;
    const totalPayouts = payoutsData.reduce(
      (sum: number, p: any) => sum + convertToAED(p.amount || 0, p.currency || "aed"),
      0
    );

    // Subscription metrics - MRR normalized to AED
    const activeSubscriptions = subscriptionsData.filter((s: any) => s.status === "active");
    const canceledSubscriptions = subscriptionsData.filter((s: any) => s.status === "canceled");
    const trialSubscriptions = subscriptionsData.filter((s: any) => s.status === "trialing");
    const mrr = activeSubscriptions.reduce((sum: number, s: any) => {
      const price = s.items?.data?.[0]?.price;
      const currency = price?.currency || "aed";

      if (price?.recurring?.interval === "month") {
        return sum + convertToAED(price.unit_amount || 0, currency);
      } else if (price?.recurring?.interval === "year") {
        return sum + convertToAED((price.unit_amount || 0) / 12, currency);
      }
      return sum;
    }, 0);

    // Daily breakdown for charts - ALL AMOUNTS IN AED
    const dailyData: Record<string, { revenue: number; refunds: number; payouts: number; count: number }> = {};

    successfulPayments.forEach((p: any) => {
      const date = new Date(p.created * 1000).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { revenue: 0, refunds: 0, payouts: 0, count: 0 };
      }
      dailyData[date].revenue += convertToAED(p.amount || 0, p.currency || "aed");
      dailyData[date].count += 1;
    });

    refundsData.forEach((r: any) => {
      const date = new Date(r.created * 1000).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { revenue: 0, refunds: 0, payouts: 0, count: 0 };
      }
      dailyData[date].refunds += convertToAED(r.amount || 0, r.currency || "aed");
    });

    payoutsData.forEach((p: any) => {
      const date = new Date(p.created * 1000).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { revenue: 0, refunds: 0, payouts: 0, count: 0 };
      }
      dailyData[date].payouts += convertToAED(p.amount || 0, p.currency || "aed");
    });

    const chartData = Object.entries(dailyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    console.log("Stripe data fetched successfully (all amounts normalized to AED):", {
      customersCount: customersData.length,
      payingCustomersCount: payingCustomers.length,
      subscriptionsCount: subscriptionsData.length,
      paymentsCount: paymentsData.length,
      chargesCount: chargesData.length,
      payoutsCount: payoutsData.length,
      refundsCount: refundsData.length,
      totalRevenueAED: formatAED(totalRevenue),
      netRevenueAED: formatAED(netRevenue),
    });

    // Convert balance amounts to AED
    const balanceAvailableAED = balance?.available?.[0]
      ? convertToAED(balance.available[0].amount, balance.available[0].currency)
      : 0;
    const balancePendingAED = balance?.pending?.[0]
      ? convertToAED(balance.pending[0].amount, balance.pending[0].currency)
      : 0;

    return apiSuccess({
        balance: {
          ...balance,
          available: [{ amount: balanceAvailableAED, currency: "aed" }],
          pending: [{ amount: balancePendingAED, currency: "aed" }],
          _original: balance, // Keep original for reference
        },
        customers: customersData,
        payingCustomers,
        subscriptions: subscriptionsData,
        payments: paymentsData,
        charges: chargesData,
        payouts: payoutsData,
        refunds: refundsData,
        products: products.data || [],
        invoices: invoices.data || [],
        account: account,
        treasuryTransfers: treasuryTransfers.data || [],
        observability: {
          langsmithConfigured,
        },
        metrics: {
          // All amounts in AED (fils - smallest unit)
          totalRevenue,
          totalRefunded,
          netRevenue,
          totalPayouts,
          successfulPaymentsCount: successfulPayments.length,
          failedPaymentsCount: failedPayments.length,
          payingCustomersCount: payingCustomers.length,
          activeSubscriptions: activeSubscriptions.length,
          canceledSubscriptions: canceledSubscriptions.length,
          trialSubscriptions: trialSubscriptions.length,
          mrr,
          successRate: paymentsData.length > 0
            ? Math.round((successfulPayments.length / paymentsData.length) * 100)
            : 100,
          currency: "aed", // All amounts normalized to AED
        },
        chartData,
        dateRange: { startDate, endDate },
        currency: "aed", // Global currency indicator
      });
  } catch (error: unknown) {
    console.error("Error in stripe-dashboard-data:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return apiError("INTERNAL_ERROR", JSON.stringify({ error: errorMessage }), 500);
  }
});
