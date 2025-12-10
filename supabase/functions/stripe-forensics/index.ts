import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnomalyResult {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  details: any;
  timestamp?: number;
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
    const { action } = await req.json();

    console.log("[STRIPE-FORENSICS] Action:", action);

    // Calculate timestamps
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

    if (action === "full-audit") {
      // Comprehensive audit - fetch everything
      // Helper for paginated Stripe fetching
      async function fetchAllStripe(resource: any, params: any = {}) {
        let allItems: any[] = [];
        let hasMore = true;
        let startingAfter: string | undefined = undefined;

        while (hasMore) {
          const listResponse: { data: any[]; has_more: boolean } = await resource.list({
            limit: 100,
            ...params,
            starting_after: startingAfter
          });

          allItems = allItems.concat(listResponse.data);
          hasMore = listResponse.has_more;

          if (hasMore && listResponse.data.length > 0) {
            startingAfter = listResponse.data[listResponse.data.length - 1].id;
          } else {
            hasMore = false;
          }
        }
        return { data: allItems };
      }

      // Comprehensive audit - fetch everything with pagination
      const [
        balance,
        payouts,
        balanceTransactions,
        payments,
        refunds,
        charges,
        transfers,
        events,
        webhookEndpoints,
        account,
        customers,
        disputes
      ] = await Promise.all([
        stripe.balance.retrieve().catch((e: Error) => {
          console.error("Error fetching balance:", e.message);
          return null;
        }),
        fetchAllStripe(stripe.payouts, { created: { gte: thirtyDaysAgo } }).catch((e: Error) => {
          console.error("Error fetching payouts:", e.message);
          return { data: [] };
        }),
        fetchAllStripe(stripe.balanceTransactions, { created: { gte: thirtyDaysAgo } }).catch((e: Error) => {
          console.error("Error fetching balance transactions:", e.message);
          return { data: [] };
        }),
        fetchAllStripe(stripe.paymentIntents, { created: { gte: thirtyDaysAgo } }).catch((e: Error) => {
          console.error("Error fetching payments:", e.message);
          return { data: [] };
        }),
        fetchAllStripe(stripe.refunds, { created: { gte: thirtyDaysAgo } }).catch((e: Error) => {
          console.error("Error fetching refunds:", e.message);
          return { data: [] };
        }),
        fetchAllStripe(stripe.charges, { created: { gte: thirtyDaysAgo } }).catch((e: Error) => {
          console.error("Error fetching charges:", e.message);
          return { data: [] };
        }),
        fetchAllStripe(stripe.transfers, { created: { gte: thirtyDaysAgo } }).catch((e: Error) => {
          console.error("Error fetching transfers:", e.message);
          return { data: [] };
        }),
        fetchAllStripe(stripe.events, { created: { gte: sevenDaysAgo } }).catch((e: Error) => {
          console.error("Error fetching events:", e.message);
          return { data: [] };
        }),
        stripe.webhookEndpoints.list({ limit: 100 }).catch((e: Error) => {
          console.error("Error fetching webhooks:", e.message);
          return { data: [] };
        }),
        stripe.accounts.retrieve().catch((e: Error) => {
          console.error("Error fetching account:", e.message);
          return null;
        }),
        fetchAllStripe(stripe.customers, { created: { gte: sevenDaysAgo } }).catch((e: Error) => {
          console.error("Error fetching recent customers:", e.message);
          return { data: [] };
        }),
        fetchAllStripe(stripe.disputes, {}).catch((e: Error) => {
          console.error("Error fetching disputes:", e.message);
          return { data: [] };
        })
      ]);

      // Analyze for anomalies
      const anomalies: AnomalyResult[] = [];

      // 1. High Payout Ratio Analysis
      const totalRevenue = (payments.data || []).reduce((sum: number, p: any) =>
        p.status === 'succeeded' ? sum + p.amount : sum, 0);
      const totalPayouts = (payouts.data || []).reduce((sum: number, p: any) =>
        p.status === 'paid' ? sum + p.amount : sum, 0);

      if (totalRevenue > 0 && totalPayouts > totalRevenue * 0.8) {
        anomalies.push({
          type: "HIGH_PAYOUT_RATIO",
          severity: "critical",
          message: "Payouts exceed 80% of recent revenue",
          details: { totalRevenue: totalRevenue / 100, totalPayouts: totalPayouts / 100, ratio: (totalPayouts / totalRevenue * 100).toFixed(1) + "%" }
        });
      }

      // 2. Test-then-Drain Pattern
      const recentPayments = payments.data || [];
      const smallTransactions = recentPayments.filter((t: any) => t.amount < 1000);
      const largeTransactions = recentPayments.filter((t: any) => t.amount > 10000);

      if (smallTransactions.length > 5 && largeTransactions.length > 0) {
        anomalies.push({
          type: "TEST_THEN_DRAIN",
          severity: "high",
          message: "Multiple small test transactions followed by large ones detected",
          details: { smallCount: smallTransactions.length, largeCount: largeTransactions.length }
        });
      }

      // 3. Odd Hours Transactions
      const oddHoursTransactions = recentPayments.filter((t: any) => {
        const hour = new Date(t.created * 1000).getHours();
        return hour < 6 || hour > 22;
      });

      if (oddHoursTransactions.length > 5) {
        anomalies.push({
          type: "ODD_HOURS_ACTIVITY",
          severity: "medium",
          message: `${oddHoursTransactions.length} transactions during unusual hours (10PM-6AM)`,
          details: { count: oddHoursTransactions.length, transactions: oddHoursTransactions.slice(0, 5).map((t: any) => ({ id: t.id, amount: t.amount / 100, time: new Date(t.created * 1000).toISOString() })) }
        });
      }

      // 4. Large Refunds
      const largeRefunds = (refunds.data || []).filter((r: any) => r.amount > 50000);
      if (largeRefunds.length > 0) {
        anomalies.push({
          type: "LARGE_REFUNDS",
          severity: "high",
          message: `${largeRefunds.length} large refunds detected (>$500)`,
          details: { refunds: largeRefunds.map((r: any) => ({ id: r.id, amount: r.amount / 100, reason: r.reason })) }
        });
      }

      // 5. Unknown Webhook Endpoints
      const suspiciousWebhooks = (webhookEndpoints.data || []).filter((wh: any) => {
        const url = wh.url.toLowerCase();
        return !url.includes('supabase') && !url.includes('ptd') && !url.includes('lovable');
      });

      if (suspiciousWebhooks.length > 0) {
        anomalies.push({
          type: "SUSPICIOUS_WEBHOOKS",
          severity: "critical",
          message: `${suspiciousWebhooks.length} webhook endpoints pointing to unknown domains`,
          details: { webhooks: suspiciousWebhooks.map((wh: any) => ({ id: wh.id, url: wh.url, events: wh.enabled_events })) }
        });
      }

      // 6. Rapid Customer Creation
      const recentCustomers = customers.data || [];
      if (recentCustomers.length > 20) {
        anomalies.push({
          type: "RAPID_CUSTOMER_CREATION",
          severity: "medium",
          message: `${recentCustomers.length} new customers created in last 7 days`,
          details: { count: recentCustomers.length }
        });
      }

      // 7. Open Disputes
      const openDisputes = (disputes.data || []).filter((d: any) => d.status === 'needs_response' || d.status === 'under_review');
      if (openDisputes.length > 0) {
        anomalies.push({
          type: "OPEN_DISPUTES",
          severity: "high",
          message: `${openDisputes.length} open disputes requiring attention`,
          details: { disputes: openDisputes.map((d: any) => ({ id: d.id, amount: d.amount / 100, reason: d.reason, status: d.status })) }
        });
      }

      // 8. Check for suspicious events
      const sensitiveEvents = (events.data || []).filter((e: any) =>
        e.type.includes('bank_account') ||
        e.type.includes('payout') ||
        e.type.includes('transfer') ||
        e.type.includes('issuing')
      );

      // 9. Instant Payouts & Card Transfers (Forensic Check)
      const instantPayouts = (payouts.data || []).filter((p: any) => p.method === 'instant');
      if (instantPayouts.length > 0) {
        anomalies.push({
          type: "INSTANT_PAYOUTS",
          severity: "high",
          message: `${instantPayouts.length} Instant Payouts detected (High Risk)`,
          details: {
            count: instantPayouts.length,
            totalAmount: instantPayouts.reduce((sum: number, p: any) => sum + p.amount, 0) / 100,
            destinations: instantPayouts.map((p: any) => p.destination)
          }
        });
      }

      const cardPayouts = (payouts.data || []).filter((p: any) => p.type === 'card');
      if (cardPayouts.length > 0) {
        anomalies.push({
          type: "CARD_PAYOUTS",
          severity: "medium",
          message: `${cardPayouts.length} payouts to Debit/Credit Cards detected`,
          details: {
            count: cardPayouts.length,
            totalAmount: cardPayouts.reduce((sum: number, p: any) => sum + p.amount, 0) / 100
          }
        });
      }

      // 10. Payout Velocity Check (Multiple payouts in 24h)
      const payoutDates = (payouts.data || []).map((p: any) => new Date(p.created * 1000).toDateString());
      const payoutsPerDay = payoutDates.reduce((acc: any, date: string) => {
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      Object.entries(payoutsPerDay).forEach(([date, count]) => {
        if ((count as number) > 3) {
          anomalies.push({
            type: "HIGH_VELOCITY_PAYOUTS",
            severity: "high",
            message: `Unusual payout velocity: ${count} payouts on ${date}`,
            details: { date, count }
          });
        }
      });

      // Calculate security score
      let securityScore = 100;
      anomalies.forEach(a => {
        if (a.severity === 'critical') securityScore -= 25;
        else if (a.severity === 'high') securityScore -= 15;
        else if (a.severity === 'medium') securityScore -= 10;
        else securityScore -= 5;
      });
      securityScore = Math.max(0, securityScore);

      console.log("[STRIPE-FORENSICS] Audit complete:", {
        anomaliesCount: anomalies.length,
        securityScore,
        eventsCount: events.data?.length || 0
      });

      return new Response(
        JSON.stringify({
          balance,
          payouts: payouts.data || [],
          balanceTransactions: balanceTransactions.data || [],
          payments: payments.data || [],
          refunds: refunds.data || [],
          charges: charges.data || [],
          transfers: transfers.data || [],
          events: events.data || [],
          sensitiveEvents,
          webhookEndpoints: webhookEndpoints.data || [],
          disputes: disputes.data || [],
          recentCustomers: customers.data || [],
          account,
          anomalies,
          securityScore,
          auditTimestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "events-timeline") {
      // Get detailed event timeline for last 7 days
      const events = await stripe.events.list({
        limit: 100,
        created: { gte: sevenDaysAgo }
      });

      // Categorize events
      const categorized = {
        payments: events.data.filter((e: any) => e.type.startsWith('payment_intent') || e.type.startsWith('charge')),
        payouts: events.data.filter((e: any) => e.type.startsWith('payout')),
        transfers: events.data.filter((e: any) => e.type.startsWith('transfer')),
        customers: events.data.filter((e: any) => e.type.startsWith('customer')),
        subscriptions: events.data.filter((e: any) => e.type.startsWith('subscription') || e.type.startsWith('invoice')),
        security: events.data.filter((e: any) =>
          e.type.includes('bank_account') ||
          e.type.includes('external_account') ||
          e.type.includes('issuing')
        ),
        disputes: events.data.filter((e: any) => e.type.startsWith('dispute') || e.type.startsWith('charge.dispute'))
      };

      return new Response(
        JSON.stringify({
          events: events.data,
          categorized,
          total: events.data.length
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "visa-approvals") {
      // Get Visa-specific transactions
      const charges = await stripe.charges.list({
        limit: 100,
        created: { gte: sevenDaysAgo }
      });

      const visaCharges = charges.data.filter((c: any) =>
        c.payment_method_details?.card?.brand === 'visa' && c.status === 'succeeded'
      );

      return new Response(
        JSON.stringify({
          visaApprovals: visaCharges.map((c: any) => ({
            id: c.id,
            amount: c.amount / 100,
            currency: c.currency,
            created: c.created,
            customer: c.customer,
            last4: c.payment_method_details?.card?.last4,
            country: c.payment_method_details?.card?.country,
            network: c.payment_method_details?.card?.network,
            funding: c.payment_method_details?.card?.funding,
            metadata: c.metadata,
            billing_details: c.billing_details
          })),
          total: visaCharges.length
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action: " + action);
  } catch (error) {
    console.error("[STRIPE-FORENSICS] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
