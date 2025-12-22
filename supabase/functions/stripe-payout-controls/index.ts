import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================
// 🔒 READ-ONLY PAYOUT DASHBOARD - Full Visibility Mode
// ============================================================

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
    
    const { action, ...params } = await req.json();
    console.log(`[PAYOUT-DASHBOARD] Action: ${action}`);

    // ==================== DASHBOARD OVERVIEW (READ-ONLY) ====================
    if (action === "get-dashboard" || action === "get-settings") {
      // Get current balance
      const balance = await stripe.balance.retrieve();

      // Get all payouts (recent)
      const recentPayouts = await stripe.payouts.list({ limit: 25 });

      // Get pending balance transactions for incoming money
      const pendingTransactions = await stripe.balanceTransactions.list({
        limit: 50,
      });

      // Calculate stats
      const payoutStats = {
        total_paid: 0,
        total_pending: 0,
        total_failed: 0,
        count_paid: 0,
        count_pending: 0,
        count_failed: 0,
        last_payout: null as any,
        next_payout: null as any,
      };

      recentPayouts.data.forEach(p => {
        if (p.status === 'paid') {
          payoutStats.total_paid += p.amount;
          payoutStats.count_paid++;
        } else if (p.status === 'pending' || p.status === 'in_transit') {
          payoutStats.total_pending += p.amount;
          payoutStats.count_pending++;
          if (!payoutStats.next_payout) payoutStats.next_payout = p;
        } else if (p.status === 'failed') {
          payoutStats.total_failed += p.amount;
          payoutStats.count_failed++;
        }
      });

      // Find last completed payout
      payoutStats.last_payout = recentPayouts.data.find(p => p.status === 'paid');

      // Categorize balance transactions
      const transactionsByType: Record<string, { count: number; amount: number }> = {};
      pendingTransactions.data.forEach(t => {
        if (!transactionsByType[t.type]) {
          transactionsByType[t.type] = { count: 0, amount: 0 };
        }
        transactionsByType[t.type].count++;
        transactionsByType[t.type].amount += t.amount;
      });

      return new Response(
        JSON.stringify({
          success: true,
          mode: "READ_ONLY",
          balance: {
            available: balance.available.map(b => ({
              amount: b.amount,
              currency: b.currency,
              formatted: `${(b.amount / 100).toFixed(2)} ${b.currency.toUpperCase()}`,
            })),
            pending: balance.pending.map(b => ({
              amount: b.amount,
              currency: b.currency,
              formatted: `${(b.amount / 100).toFixed(2)} ${b.currency.toUpperCase()}`,
            })),
            instant_available: balance.instant_available?.map(b => ({
              amount: b.amount,
              currency: b.currency,
              formatted: `${(b.amount / 100).toFixed(2)} ${b.currency.toUpperCase()}`,
            })) || [],
          },
          payouts: {
            recent: recentPayouts.data.map((p: any) => ({
              id: p.id,
              amount: p.amount,
              formatted_amount: `${(p.amount / 100).toFixed(2)} ${p.currency.toUpperCase()}`,
              currency: p.currency,
              status: p.status,
              method: p.method,
              type: p.type,
              arrival_date: p.arrival_date,
              arrival_date_formatted: new Date(p.arrival_date * 1000).toLocaleDateString(),
              created: p.created,
              created_formatted: new Date(p.created * 1000).toLocaleDateString(),
              destination: p.destination,
              automatic: p.automatic,
              failure_code: p.failure_code,
              failure_message: p.failure_message,
            })),
            stats: payoutStats,
            has_more: recentPayouts.has_more,
          },
          transactions: {
            recent: pendingTransactions.data.slice(0, 20).map(t => ({
              id: t.id,
              amount: t.amount,
              formatted_amount: `${(t.amount / 100).toFixed(2)} ${t.currency.toUpperCase()}`,
              net: t.net,
              fee: t.fee,
              currency: t.currency,
              type: t.type,
              status: t.status,
              available_on: t.available_on,
              available_on_formatted: new Date(t.available_on * 1000).toLocaleDateString(),
              created: t.created,
              description: t.description,
            })),
            by_type: transactionsByType,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== GET PAYOUT HISTORY (READ-ONLY) ====================
    if (action === "get-history") {
      const { limit = 50, starting_after, ending_before, status, arrival_date } = params;

      const listParams: Stripe.PayoutListParams = {
        limit: Math.min(limit, 100),
      };

      if (starting_after) listParams.starting_after = starting_after;
      if (ending_before) listParams.ending_before = ending_before;
      if (status) listParams.status = status;
      if (arrival_date) listParams.arrival_date = arrival_date;

      const payouts = await stripe.payouts.list(listParams);

      // Calculate statistics
      const stats = {
        total_count: payouts.data.length,
        total_amount: payouts.data.reduce((sum, p) => sum + p.amount, 0),
        by_status: {} as Record<string, { count: number; amount: number }>,
        by_method: {} as Record<string, { count: number; amount: number }>,
        failed_count: 0,
        pending_count: 0,
      };

      payouts.data.forEach(p => {
        // By status
        if (!stats.by_status[p.status]) {
          stats.by_status[p.status] = { count: 0, amount: 0 };
        }
        stats.by_status[p.status].count++;
        stats.by_status[p.status].amount += p.amount;

        // By method
        if (!stats.by_method[p.method]) {
          stats.by_method[p.method] = { count: 0, amount: 0 };
        }
        stats.by_method[p.method].count++;
        stats.by_method[p.method].amount += p.amount;

        if (p.status === "failed") stats.failed_count++;
        if (p.status === "pending") stats.pending_count++;
      });

      return new Response(
        JSON.stringify({
          success: true,
          payouts: payouts.data.map(p => ({
            id: p.id,
            amount: p.amount,
            currency: p.currency,
            status: p.status,
            method: p.method,
            type: p.type,
            arrival_date: p.arrival_date,
            created: p.created,
            destination: p.destination,
            automatic: p.automatic,
            failure_code: p.failure_code,
            failure_message: p.failure_message,
            statement_descriptor: p.statement_descriptor,
            balance_transaction: p.balance_transaction,
          })),
          has_more: payouts.has_more,
          stats,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== GET BALANCE DETAILS ====================
    if (action === "get-balance") {
      const balance = await stripe.balance.retrieve();
      
      // Get pending balance transactions
      const pendingTransactions = await stripe.balanceTransactions.list({
        limit: 20,
        type: "charge",
      });

      return new Response(
        JSON.stringify({
          success: true,
          balance: {
            available: balance.available.map(b => ({
              amount: b.amount,
              currency: b.currency,
              source_types: b.source_types,
            })),
            pending: balance.pending.map(b => ({
              amount: b.amount,
              currency: b.currency,
              source_types: b.source_types,
            })),
            instant_available: balance.instant_available?.map(b => ({
              amount: b.amount,
              currency: b.currency,
              net_available: b.net_available,
            })) || [],
            connect_reserved: balance.connect_reserved?.map(b => ({
              amount: b.amount,
              currency: b.currency,
            })) || [],
          },
          recent_transactions: pendingTransactions.data.slice(0, 10).map(t => ({
            id: t.id,
            amount: t.amount,
            net: t.net,
            fee: t.fee,
            currency: t.currency,
            type: t.type,
            status: t.status,
            available_on: t.available_on,
            created: t.created,
            description: t.description,
          })),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== GET CHARGES (READ-ONLY) ====================
    if (action === "get-charges") {
      const { limit = 50, starting_after } = params;

      const charges = await stripe.charges.list({
        limit: Math.min(limit, 100),
        starting_after,
      });

      // Calculate daily totals
      const dailyTotals: Record<string, { count: number; amount: number; refunded: number }> = {};
      charges.data.forEach(c => {
        const date = new Date(c.created * 1000).toLocaleDateString();
        if (!dailyTotals[date]) {
          dailyTotals[date] = { count: 0, amount: 0, refunded: 0 };
        }
        dailyTotals[date].count++;
        dailyTotals[date].amount += c.amount;
        dailyTotals[date].refunded += c.amount_refunded;
      });

      return new Response(
        JSON.stringify({
          success: true,
          charges: charges.data.map(c => ({
            id: c.id,
            amount: c.amount,
            formatted_amount: `${(c.amount / 100).toFixed(2)} ${c.currency.toUpperCase()}`,
            currency: c.currency,
            status: c.status,
            paid: c.paid,
            refunded: c.refunded,
            amount_refunded: c.amount_refunded,
            customer: c.customer,
            description: c.description,
            receipt_email: c.receipt_email,
            created: c.created,
            created_formatted: new Date(c.created * 1000).toLocaleDateString(),
          })),
          has_more: charges.has_more,
          daily_totals: dailyTotals,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== GET SUBSCRIPTIONS (READ-ONLY) ====================
    if (action === "get-subscriptions") {
      const { limit = 50, status: subStatus, starting_after } = params;

      const listParams: any = {
        limit: Math.min(limit, 100),
      };
      if (subStatus) listParams.status = subStatus;
      if (starting_after) listParams.starting_after = starting_after;

      const subscriptions = await stripe.subscriptions.list(listParams);

      // Calculate MRR (Monthly Recurring Revenue)
      let totalMRR = 0;
      subscriptions.data.forEach(s => {
        if (s.status === 'active' || s.status === 'trialing') {
          const item = s.items.data[0];
          if (item?.price?.recurring) {
            let amount = (item.price.unit_amount || 0) * (item.quantity || 1);
            // Convert to monthly
            if (item.price.recurring.interval === 'year') {
              amount = amount / 12;
            } else if (item.price.recurring.interval === 'week') {
              amount = amount * 4.33;
            }
            totalMRR += amount;
          }
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          subscriptions: subscriptions.data.map(s => ({
            id: s.id,
            status: s.status,
            customer: s.customer,
            current_period_start: s.current_period_start,
            current_period_end: s.current_period_end,
            cancel_at_period_end: s.cancel_at_period_end,
            created: s.created,
            items: s.items.data.map(i => ({
              price_id: i.price?.id,
              product_id: i.price?.product,
              amount: i.price?.unit_amount,
              currency: i.price?.currency,
              interval: i.price?.recurring?.interval,
              quantity: i.quantity,
            })),
          })),
          has_more: subscriptions.has_more,
          stats: {
            total_mrr: totalMRR,
            formatted_mrr: `${(totalMRR / 100).toFixed(2)}`,
            active_count: subscriptions.data.filter(s => s.status === 'active').length,
            trialing_count: subscriptions.data.filter(s => s.status === 'trialing').length,
            canceled_count: subscriptions.data.filter(s => s.status === 'canceled').length,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== AVAILABLE ACTIONS ====================
    if (action === "list-actions") {
      return new Response(
        JSON.stringify({
          success: true,
          mode: "READ_ONLY",
          available_actions: [
            { action: "get-dashboard", description: "Full dashboard overview with balance, payouts, transactions" },
            { action: "get-settings", description: "Alias for get-dashboard" },
            { action: "get-history", description: "Detailed payout history with stats" },
            { action: "get-balance", description: "Current balance breakdown" },
            { action: "get-charges", description: "Recent charges with daily totals" },
            { action: "get-subscriptions", description: "Active subscriptions with MRR" },
            { action: "list-actions", description: "List all available actions" },
          ],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}. Use 'list-actions' to see available actions.`);

  } catch (error: any) {
    console.error("[PAYOUT-CONTROLS] Error:", error);
    
    // Handle Stripe-specific errors
    let errorMessage = error.message;
    let statusCode = 500;
    
    if (error.type === "StripeInvalidRequestError") {
      statusCode = 400;
    } else if (error.type === "StripeAuthenticationError") {
      statusCode = 401;
      errorMessage = "Authentication failed. Check your Stripe API key.";
    } else if (error.type === "StripePermissionError") {
      statusCode = 403;
      errorMessage = "Permission denied for this operation.";
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        code: error.code,
        type: error.type,
      }),
      { status: statusCode, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

