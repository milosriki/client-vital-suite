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

interface MoneyFlowEvent {
  id: string;
  type: 'inflow' | 'outflow' | 'internal';
  category: string;
  amount: number;
  currency: string;
  timestamp: number;
  source: string;
  destination: string;
  description: string;
  metadata: any;
  status: string;
  traceId?: string;
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
    const { action, days = 30 } = await req.json();

    console.log("[STRIPE-FORENSICS] Action:", action);

    // Calculate timestamps
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
    const daysAgo = now - (days * 24 * 60 * 60);

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

    // ==================== MONEY FLOW TRACKER ====================
    if (action === "money-flow") {
      console.log("[STRIPE-FORENSICS] Fetching complete money flow...");

      const [
        balance,
        payouts,
        balanceTransactions,
        charges,
        refunds,
        transfers,
        topups,
        account
      ] = await Promise.all([
        stripe.balance.retrieve().catch(() => null),
        fetchAllStripe(stripe.payouts, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.balanceTransactions, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.charges, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.refunds, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.transfers, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        stripe.topups.list({ limit: 100, created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        stripe.accounts.retrieve().catch(() => null)
      ]);

      // Try to fetch Issuing data (may fail if not enabled)
      let issuingCards: any[] = [];
      let issuingTransactions: any[] = [];
      let issuingAuthorizations: any[] = [];
      
      try {
        const [cards, txns, auths] = await Promise.all([
          stripe.issuing.cards.list({ limit: 100 }),
          stripe.issuing.transactions.list({ limit: 100, created: { gte: daysAgo } }),
          stripe.issuing.authorizations.list({ limit: 100, created: { gte: daysAgo } })
        ]);
        issuingCards = cards.data || [];
        issuingTransactions = txns.data || [];
        issuingAuthorizations = auths.data || [];
        console.log("[STRIPE-FORENSICS] Issuing data fetched:", { 
          cards: issuingCards.length, 
          transactions: issuingTransactions.length 
        });
      } catch (e) {
        console.log("[STRIPE-FORENSICS] Issuing not enabled or no access");
      }

      // Build unified money flow timeline
      const moneyFlow: MoneyFlowEvent[] = [];

      // INFLOWS: Charges (payments received)
      (charges.data || []).forEach((charge: any) => {
        if (charge.status === 'succeeded') {
          moneyFlow.push({
            id: charge.id,
            type: 'inflow',
            category: 'payment',
            amount: charge.amount,
            currency: charge.currency,
            timestamp: charge.created,
            source: charge.billing_details?.email || charge.customer || 'customer',
            destination: 'stripe_balance',
            description: `Payment received${charge.description ? ': ' + charge.description : ''}`,
            metadata: {
              paymentMethod: charge.payment_method_details?.type,
              cardBrand: charge.payment_method_details?.card?.brand,
              cardLast4: charge.payment_method_details?.card?.last4,
              country: charge.payment_method_details?.card?.country,
              customer: charge.customer,
              receiptUrl: charge.receipt_url
            },
            status: charge.status
          });
        }
      });

      // INFLOWS: Top-ups
      (topups.data || []).forEach((topup: any) => {
        if (topup.status === 'succeeded') {
          moneyFlow.push({
            id: topup.id,
            type: 'inflow',
            category: 'topup',
            amount: topup.amount,
            currency: topup.currency,
            timestamp: topup.created,
            source: topup.source?.bank_name || 'bank_account',
            destination: 'stripe_balance',
            description: `Balance top-up from bank`,
            metadata: {
              bankName: topup.source?.bank_name,
              last4: topup.source?.last4,
              statementDescriptor: topup.statement_descriptor
            },
            status: topup.status
          });
        }
      });

      // OUTFLOWS: Payouts (money leaving to bank/card)
      (payouts.data || []).forEach((payout: any) => {
        moneyFlow.push({
          id: payout.id,
          type: 'outflow',
          category: payout.method === 'instant' ? 'instant_payout' : 'payout',
          amount: payout.amount,
          currency: payout.currency,
          timestamp: payout.created,
          source: 'stripe_balance',
          destination: payout.destination || 'external_account',
          description: `Payout to ${payout.type === 'card' ? 'debit card' : 'bank account'}`,
          metadata: {
            method: payout.method,
            type: payout.type,
            arrivalDate: payout.arrival_date,
            statementDescriptor: payout.statement_descriptor,
            automatic: payout.automatic,
            destinationId: payout.destination
          },
          status: payout.status,
          traceId: payout.trace_id?.value
        });
      });

      // OUTFLOWS: Refunds
      (refunds.data || []).forEach((refund: any) => {
        moneyFlow.push({
          id: refund.id,
          type: 'outflow',
          category: 'refund',
          amount: refund.amount,
          currency: refund.currency,
          timestamp: refund.created,
          source: 'stripe_balance',
          destination: refund.destination_details?.card?.last4 || 'customer',
          description: `Refund${refund.reason ? ': ' + refund.reason : ''}`,
          metadata: {
            reason: refund.reason,
            chargeId: refund.charge,
            receiptNumber: refund.receipt_number
          },
          status: refund.status
        });
      });

      // OUTFLOWS: Transfers (Connect payouts to connected accounts)
      (transfers.data || []).forEach((transfer: any) => {
        moneyFlow.push({
          id: transfer.id,
          type: 'outflow',
          category: 'transfer',
          amount: transfer.amount,
          currency: transfer.currency,
          timestamp: transfer.created,
          source: 'stripe_balance',
          destination: transfer.destination || 'connected_account',
          description: `Transfer to connected account`,
          metadata: {
            destinationAccount: transfer.destination,
            sourceTransaction: transfer.source_transaction,
            reversals: transfer.reversals?.total_count || 0
          },
          status: transfer.reversed ? 'reversed' : 'completed'
        });
      });

      // OUTFLOWS: Issuing Transactions (card spend)
      issuingTransactions.forEach((txn: any) => {
        moneyFlow.push({
          id: txn.id,
          type: 'outflow',
          category: 'card_spend',
          amount: Math.abs(txn.amount),
          currency: txn.currency,
          timestamp: txn.created,
          source: txn.card || 'issued_card',
          destination: txn.merchant_data?.name || 'merchant',
          description: `Card purchase: ${txn.merchant_data?.name || 'Unknown merchant'}`,
          metadata: {
            cardId: txn.card,
            merchantName: txn.merchant_data?.name,
            merchantCategory: txn.merchant_data?.category,
            merchantCity: txn.merchant_data?.city,
            merchantCountry: txn.merchant_data?.country,
            authorizationId: txn.authorization
          },
          status: txn.type
        });
      });

      // Sort by timestamp descending
      moneyFlow.sort((a, b) => b.timestamp - a.timestamp);

      // Calculate summaries
      const totalInflow = moneyFlow
        .filter(f => f.type === 'inflow')
        .reduce((sum, f) => sum + f.amount, 0);
      
      const totalOutflow = moneyFlow
        .filter(f => f.type === 'outflow')
        .reduce((sum, f) => sum + f.amount, 0);

      const flowByCategory: Record<string, { count: number; amount: number }> = {};
      moneyFlow.forEach(f => {
        if (!flowByCategory[f.category]) {
          flowByCategory[f.category] = { count: 0, amount: 0 };
        }
        flowByCategory[f.category].count++;
        flowByCategory[f.category].amount += f.amount;
      });

      // Destination analysis (who received money)
      const destinationAnalysis: Record<string, { count: number; amount: number; type: string }> = {};
      moneyFlow.filter(f => f.type === 'outflow').forEach(f => {
        const dest = f.destination;
        if (!destinationAnalysis[dest]) {
          destinationAnalysis[dest] = { count: 0, amount: 0, type: f.category };
        }
        destinationAnalysis[dest].count++;
        destinationAnalysis[dest].amount += f.amount;
      });

      return new Response(
        JSON.stringify({
          moneyFlow,
          summary: {
            totalInflow: totalInflow / 100,
            totalOutflow: totalOutflow / 100,
            netFlow: (totalInflow - totalOutflow) / 100,
            transactionCount: moneyFlow.length,
            flowByCategory: Object.fromEntries(
              Object.entries(flowByCategory).map(([k, v]) => [k, { ...v, amount: v.amount / 100 }])
            ),
            destinationAnalysis: Object.fromEntries(
              Object.entries(destinationAnalysis)
                .sort(([, a], [, b]) => b.amount - a.amount)
                .slice(0, 20)
                .map(([k, v]) => [k, { ...v, amount: v.amount / 100 }])
            )
          },
          balance,
          issuing: {
            enabled: issuingCards.length > 0 || issuingTransactions.length > 0,
            cards: issuingCards.map((c: any) => ({
              id: c.id,
              last4: c.last4,
              brand: c.brand,
              type: c.type,
              status: c.status,
              cardholder: c.cardholder?.name,
              spendingControls: c.spending_controls
            })),
            transactions: issuingTransactions.length,
            pendingAuthorizations: issuingAuthorizations.filter((a: any) => a.status === 'pending').length
          },
          period: { days, from: new Date(daysAgo * 1000).toISOString(), to: new Date().toISOString() }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== FULL AUDIT ====================
    if (action === "full-audit") {
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