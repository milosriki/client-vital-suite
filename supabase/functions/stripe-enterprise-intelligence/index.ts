import { withTracing, structuredLog, getCorrelationId } from "../_shared/observability.ts";
// stripe-enterprise-intelligence - ENTERPRISE GRADE
// Uses ALL available agents for multi-million dollar accuracy
// Integrates with LangSmith for prompt management and tracing

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { traceStart, traceEnd, createStripeTraceMetadata } from "../_shared/langsmith-tracing.ts";
import { pullPrompt } from "../_shared/prompt-manager.ts";
import { verifyAuth } from "../_shared/auth-middleware.ts";
import { handleError, ErrorCode } from "../_shared/error-handler.ts";
import { unifiedAI } from "../_shared/unified-ai-client.ts";
import { getConstitutionalSystemMessage } from "../_shared/constitutional-framing.ts";
import { apiSuccess, apiError, apiCorsPreFlight } from "../_shared/api-response.ts";
import { UnauthorizedError, errorToResponse } from "../_shared/app-errors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnterpriseContext {
  // Live Stripe Data
  balance: any;
  payouts: any[];
  transfers: any[];
  balanceTransactions: any[];
  charges: any[];
  customers: any[];
  subscriptions: any[];
  invoices: any[];
  disputes: any[];
  refunds: any[];
  treasuryTransfers: any[];
  
  // Calculated Metrics (REAL, not estimated)
  metrics: {
    totalRevenue: number;
    totalFees: number;
    totalNet: number;
    totalPayouts: number;
    totalRefunds: number;
    activeSubscriptionsMRR: number;
    currency: string;
  };
  
  // Cross-validated from other agents
  healthData: any;
  forensicsData: any;
  anomalies: any[];
  
  // Metadata
  fetchedAt: string;
  dataQuality: "complete" | "partial" | "error";
}

serve(async (req) => {
    try { verifyAuth(req); } catch { throw new UnauthorizedError(); } // Security Hardening
  if (req.method === "OPTIONS") {
    return apiCorsPreFlight();
  }

  // Parse request body early for tracing
  const { action, message, dateRange, history } = await req.json();
  
  // Start LangSmith trace for the entire request
  const traceRun = await traceStart(
    {
      name: `stripe-enterprise-intelligence:${action || "chat"}`,
      runType: "chain",
      metadata: createStripeTraceMetadata(action || "chat", { hasDateRange: !!dateRange, hasMessage: !!message }),
      tags: ["stripe", "enterprise-intelligence", action || "chat"],
    },
    { action, message, dateRange }
  );

  try {
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
    if (!supabaseUrl || !supabaseKey) throw new Error("Supabase not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ===================================================================
    // ACTION: fetch-enterprise-data (comprehensive data pull)
    // ===================================================================
    if (action === "fetch-enterprise-data") {
      console.log("[ENTERPRISE] Fetching comprehensive Stripe data...");
      
      const createdFilter: any = {};
      if (dateRange?.from) createdFilter.gte = Math.floor(new Date(dateRange.from).getTime() / 1000);
      if (dateRange?.to) createdFilter.lte = Math.floor(new Date(dateRange.to).getTime() / 1000);
      const hasDateFilter = Object.keys(createdFilter).length > 0;

      // PARALLEL FETCH: All Stripe data at once
      const [
        balance,
        payouts,
        transfers,
        balanceTransactions,
        charges,
        customers,
        subscriptions,
        invoices,
        disputes,
        refunds,
        treasuryResult
      ] = await Promise.all([
        stripe.balance.retrieve().catch(() => null),
        stripe.payouts.list({ limit: 100, ...(hasDateFilter && { created: createdFilter }) }).catch(() => ({ data: [] })),
        stripe.transfers.list({ limit: 100, ...(hasDateFilter && { created: createdFilter }) }).catch(() => ({ data: [] })),
        stripe.balanceTransactions.list({ limit: 100, ...(hasDateFilter && { created: createdFilter }) }).catch(() => ({ data: [] })),
        stripe.charges.list({ limit: 100, ...(hasDateFilter && { created: createdFilter }) }).catch(() => ({ data: [] })),
        stripe.customers.list({ limit: 100 }).catch(() => ({ data: [] })),
        stripe.subscriptions.list({ limit: 100, status: "all" }).catch(() => ({ data: [] })),
        stripe.invoices.list({ limit: 100, ...(hasDateFilter && { created: createdFilter }) }).catch(() => ({ data: [] })),
        stripe.disputes.list({ limit: 50 }).catch(() => ({ data: [] })),
        stripe.refunds.list({ limit: 100, ...(hasDateFilter && { created: createdFilter }) }).catch(() => ({ data: [] })),
        stripe.treasury.outboundTransfers.list({ limit: 100 }).catch(() => ({ data: [] }))
      ]);

      // CALCULATE REAL METRICS from balance_transactions
      const transactions = balanceTransactions.data || [];
      let totalRevenue = 0;
      let totalFees = 0;
      let totalNet = 0;
      
      for (const tx of transactions) {
        if (tx.type === "charge" || tx.type === "payment") {
          totalRevenue += tx.amount || 0;
          totalFees += tx.fee || 0;
          totalNet += tx.net || 0;
        }
      }

      const totalPayouts = (payouts.data || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const totalRefunds = (refunds.data || []).reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
      
      // Calculate MRR from active subscriptions
      const activeSubscriptions = (subscriptions.data || []).filter((s: any) => s.status === "active");
      let activeSubscriptionsMRR = 0;
      for (const sub of activeSubscriptions) {
        const item = sub.items?.data?.[0];
        if (item?.price?.recurring?.interval === "month") {
          activeSubscriptionsMRR += item.price.unit_amount || 0;
        } else if (item?.price?.recurring?.interval === "year") {
          activeSubscriptionsMRR += Math.round((item.price.unit_amount || 0) / 12);
        }
      }

      // CROSS-VALIDATE: Fetch from other agents
      let healthData = null;
      let forensicsData = null;
      let anomalies: any[] = [];

      try {
        const { data: healthResult } = await supabase.functions.invoke("health-calculator", { body: { mode: "summary" } });
        healthData = healthResult;
      } catch (e) {
        console.log("[ENTERPRISE] Health calculator unavailable:", e);
      }

      try {
        const { data: forensicsResult } = await supabase.functions.invoke("stripe-forensics", { body: { action: "quick-scan" } });
        forensicsData = forensicsResult;
        anomalies = forensicsResult?.anomalies || [];
      } catch (e) {
        console.log("[ENTERPRISE] Forensics unavailable:", e);
      }

      const context: EnterpriseContext = {
        balance,
        payouts: payouts.data || [],
        transfers: transfers.data || [],
        balanceTransactions: transactions,
        charges: charges.data || [],
        customers: customers.data || [],
        subscriptions: subscriptions.data || [],
        invoices: invoices.data || [],
        disputes: disputes.data || [],
        refunds: refunds.data || [],
        treasuryTransfers: treasuryResult.data || [],
        metrics: {
          totalRevenue,
          totalFees,
          totalNet,
          totalPayouts,
          totalRefunds,
          activeSubscriptionsMRR,
          currency: balance?.available?.[0]?.currency || "aed"
        },
        healthData,
        forensicsData,
        anomalies,
        fetchedAt: new Date().toISOString(),
        dataQuality: transactions.length > 0 ? "complete" : "partial"
      };

      console.log("[ENTERPRISE] Data summary:", {
        transactions: transactions.length,
        payouts: (payouts.data || []).length,
        charges: (charges.data || []).length,
        totalRevenue: totalRevenue / 100,
        totalFees: totalFees / 100,
        currency: context.metrics.currency
      });

      // End trace with success
      await traceEnd(traceRun, { action: "fetch-enterprise-data", transactionCount: transactions.length, dataQuality: context.dataQuality });

      return apiSuccess(context);
    }

    // ===================================================================
    // ACTION: enterprise-chat (AI with FULL context + anti-hallucination)
    // ===================================================================
    if (action === "enterprise-chat") {
      const context = message.context as EnterpriseContext;
      
      // Try to pull prompt from LangSmith (ptdbooking or stripe-enterprise)
      let langsmithPrompt = await pullPrompt("ptdbooking");
      if (!langsmithPrompt) {
        langsmithPrompt = await pullPrompt("stripe-enterprise");
      }
      
      // Build context data for injection
      const contextData = {
        balance_available: `${(context?.balance?.available?.[0]?.amount || 0) / 100} ${context?.balance?.available?.[0]?.currency?.toUpperCase() || 'AED'}`,
        balance_pending: `${(context?.balance?.pending?.[0]?.amount || 0) / 100} ${context?.balance?.pending?.[0]?.currency?.toUpperCase() || 'AED'}`,
        total_revenue: `${(context?.metrics?.totalRevenue || 0) / 100}`,
        total_fees: `${(context?.metrics?.totalFees || 0) / 100}`,
        total_net: `${(context?.metrics?.totalNet || 0) / 100}`,
        total_payouts: `${(context?.metrics?.totalPayouts || 0) / 100}`,
        total_refunds: `${(context?.metrics?.totalRefunds || 0) / 100}`,
        mrr: `${(context?.metrics?.activeSubscriptionsMRR || 0) / 100}`,
        currency: context?.metrics?.currency?.toUpperCase() || 'AED',
        transaction_count: context?.balanceTransactions?.length || 0,
        payout_count: context?.payouts?.length || 0,
        customer_count: context?.customers?.length || 0,
        active_subscriptions: context?.subscriptions?.filter((s: any) => s.status === 'active')?.length || 0,
        disputes: context?.disputes?.length || 0,
        refunds_count: context?.refunds?.length || 0,
        treasury_count: context?.treasuryTransfers?.length || 0,
        anomalies: context?.anomalies?.length || 0,
        data_quality: context?.dataQuality || 'unknown'
      };

      // Use LangSmith prompt if available, otherwise use local
      let systemPrompt: string;
      
      if (langsmithPrompt) {
        console.log("[ENTERPRISE] Using LangSmith prompt");
        // Replace variables in LangSmith prompt template
        systemPrompt = langsmithPrompt;
        for (const [key, value] of Object.entries(contextData)) {
          systemPrompt = systemPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
        }
      } else {
        console.log("[ENTERPRISE] Using local prompt (LangSmith unavailable)");
        systemPrompt = `You are ATLAS, the Enterprise Financial Intelligence System for PTD Fitness - a multi-million dollar Dubai-based premium fitness business.

=== CRITICAL ANTI-HALLUCINATION PROTOCOL ===
YOU ARE FORBIDDEN FROM:
❌ Inventing numbers not in the data
❌ Calculating fees using percentages (like "2.9% + 30 cents")
❌ Estimating or guessing any values
❌ Providing generic advice without data backing

YOU MUST:
✅ ONLY report values explicitly present in the context
✅ Use the "fee" field from balance_transactions for actual fees
✅ Say "This data is not available" if information is missing
✅ Cite the source for every number: (from: field_name)

=== REAL DATA FROM STRIPE ===

BALANCE:
- Available: ${contextData.balance_available}
- Pending: ${contextData.balance_pending}

REAL METRICS (calculated from actual balance_transactions):
- Total Revenue: ${contextData.total_revenue} ${contextData.currency} (from: balance_transactions.amount)
- Total Actual Fees: ${contextData.total_fees} ${contextData.currency} (from: balance_transactions.fee)
- Total Net: ${contextData.total_net} ${contextData.currency} (from: balance_transactions.net)
- Total Payouts: ${contextData.total_payouts} ${contextData.currency}
- Total Refunds: ${contextData.total_refunds} ${contextData.currency}
- Active Subscriptions MRR: ${contextData.mrr} ${contextData.currency}

DATA COUNTS:
- Transactions analyzed: ${contextData.transaction_count}
- Payouts: ${contextData.payout_count}
- Customers: ${contextData.customer_count}
- Active Subscriptions: ${contextData.active_subscriptions}
- Disputes: ${contextData.disputes}
- Refunds: ${contextData.refunds_count}
- Treasury Transfers: ${contextData.treasury_count}

ANOMALIES DETECTED: ${contextData.anomalies}
DATA QUALITY: ${contextData.data_quality}

RECENT BALANCE TRANSACTIONS (with ACTUAL fees):
${(context?.balanceTransactions || []).slice(0, 10).map((tx: any) => 
  `- ${tx.type}: ${tx.amount/100} ${tx.currency.toUpperCase()}, Fee: ${tx.fee/100}, Net: ${tx.net/100} (${new Date(tx.created * 1000).toLocaleDateString()})`
).join('\n')}

=== YOUR ROLE ===
Provide enterprise-grade financial analysis. Every number you report MUST come from the data above with source citation.`;
      }

      const aiResult = await unifiedAI.chat(
        [
          { role: "system", content: `${getConstitutionalSystemMessage()}\n\n${systemPrompt}` },
          ...(history || []).map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
          { role: "user", content: message.query }
        ],
        { functionName: "stripe-enterprise-intelligence" }
      );

      await traceEnd(traceRun, { action: "enterprise-chat", model: aiResult.model });

      // Return as SSE stream format for backward compatibility with frontend
      const encoder = new TextEncoder();
      const ssePayload = `data: ${JSON.stringify({ choices: [{ delta: { content: aiResult.content } }] })}\n\ndata: [DONE]\n\n`;
      return new Response(encoder.encode(ssePayload), {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" }
      });
    }

    throw new Error("Invalid action. Use: fetch-enterprise-data, enterprise-chat");

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[ENTERPRISE] Error:", msg);
    
    // End trace with error
    await traceEnd(traceRun, { error: msg }, msg);
    
    return apiError("INTERNAL_ERROR", JSON.stringify({ error: msg }), 500);
  }
});
