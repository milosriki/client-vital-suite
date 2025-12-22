import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Currency conversion rates to AED (approximate, should be updated from live API in production)
const CURRENCY_TO_AED: Record<string, number> = {
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    
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
      account
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
      customersCount: (customers.data || []).length,
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

    return new Response(
      JSON.stringify({
        balance: {
          ...balance,
          available: [{ amount: balanceAvailableAED, currency: "aed" }],
          pending: [{ amount: balancePendingAED, currency: "aed" }],
          _original: balance, // Keep original for reference
        },
        customers: customers.data || [],
        subscriptions: subscriptionsData,
        payments: paymentsData,
        charges: chargesData,
        payouts: payoutsData,
        refunds: refundsData,
        products: products.data || [],
        invoices: invoices.data || [],
        account: account,
        metrics: {
          // All amounts in AED (fils - smallest unit)
          totalRevenue,
          totalRefunded,
          netRevenue,
          totalPayouts,
          successfulPaymentsCount: successfulPayments.length,
          failedPaymentsCount: failedPayments.length,
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
