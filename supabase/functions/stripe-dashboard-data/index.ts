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

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" });

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

    // Calculate metrics
    const paymentsData = payments.data || [];
    const chargesData = charges.data || [];
    const payoutsData = payouts.data || [];
    const refundsData = refunds.data || [];
    const subscriptionsData = subscriptions.data || [];

    const successfulPayments = paymentsData.filter((p: any) => p.status === "succeeded");
    const failedPayments = paymentsData.filter((p: any) => p.status === "canceled" || p.status === "requires_payment_method");
    const totalRevenue = successfulPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const totalRefunded = refundsData.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    const netRevenue = totalRevenue - totalRefunded;
    const totalPayouts = payoutsData.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    // Subscription metrics
    const activeSubscriptions = subscriptionsData.filter((s: any) => s.status === "active");
    const canceledSubscriptions = subscriptionsData.filter((s: any) => s.status === "canceled");
    const trialSubscriptions = subscriptionsData.filter((s: any) => s.status === "trialing");
    const mrr = activeSubscriptions.reduce((sum: number, s: any) => {
      const price = s.items?.data?.[0]?.price;
      if (price?.recurring?.interval === "month") {
        return sum + (price.unit_amount || 0);
      } else if (price?.recurring?.interval === "year") {
        return sum + ((price.unit_amount || 0) / 12);
      }
      return sum;
    }, 0);

    // Daily breakdown for charts (last 30 days if no filter)
    const dailyData: Record<string, { revenue: number; refunds: number; payouts: number; count: number }> = {};
    
    successfulPayments.forEach((p: any) => {
      const date = new Date(p.created * 1000).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { revenue: 0, refunds: 0, payouts: 0, count: 0 };
      }
      dailyData[date].revenue += p.amount || 0;
      dailyData[date].count += 1;
    });

    refundsData.forEach((r: any) => {
      const date = new Date(r.created * 1000).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { revenue: 0, refunds: 0, payouts: 0, count: 0 };
      }
      dailyData[date].refunds += r.amount || 0;
    });

    payoutsData.forEach((p: any) => {
      const date = new Date(p.created * 1000).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { revenue: 0, refunds: 0, payouts: 0, count: 0 };
      }
      dailyData[date].payouts += p.amount || 0;
    });

    const chartData = Object.entries(dailyData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    console.log("Stripe data fetched successfully:", {
      customersCount: (customers.data || []).length,
      subscriptionsCount: subscriptionsData.length,
      paymentsCount: paymentsData.length,
      chargesCount: chargesData.length,
      payoutsCount: payoutsData.length,
      refundsCount: refundsData.length
    });

    return new Response(
      JSON.stringify({
        balance: balance,
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
        },
        chartData,
        dateRange: { startDate, endDate }
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
