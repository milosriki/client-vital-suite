import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { mode, action, message, context, history } = await req.json();
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Action: fetch-data - Get all payout-related data
    if (action === "fetch-data") {
      console.log("[STRIPE-PAYOUTS] Fetching payout data...");
      
      const [balance, payouts, transfers, balanceTransactions, treasuryTransfers] = await Promise.all([
        stripe.balance.retrieve().catch((e: Error) => {
          console.error("Balance error:", e);
          return null;
        }),
        stripe.payouts.list({ limit: 50 }).catch((e: Error) => {
          console.error("Payouts error:", e);
          return { data: [] };
        }),
        stripe.transfers.list({ limit: 50 }).catch((e: Error) => {
          console.error("Transfers error:", e);
          return { data: [] };
        }),
        stripe.balanceTransactions.list({ limit: 100 }).catch((e: Error) => {
          console.error("Balance transactions error:", e);
          return { data: [] };
        }),

        stripe.treasury.outboundTransfers.list({ limit: 50 }).catch((e: Error) => {
          console.error("Treasury transfers error:", e);
          return { data: [] };
        }),
      ]);

      console.log("[STRIPE-PAYOUTS] Data fetched:", {
        payoutsCount: payouts.data?.length || 0,
        transfersCount: transfers.data?.length || 0,
        transactionsCount: balanceTransactions.data?.length || 0,
        treasuryTransfersCount: treasuryTransfers.data?.length || 0,
      });

      return new Response(
        JSON.stringify({
          balance,
          payouts: payouts.data || [],
          transfers: transfers.data || [],
          balanceTransactions: balanceTransactions.data || [],
          treasuryTransfers: treasuryTransfers.data || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: lookup - Lookup specific charge, customer, or payout by ID
    if (action === "lookup") {
      const { chargeId, customerId, payoutId, invoiceId } = await req.json().catch(() => ({}));
      console.log("[STRIPE-PAYOUTS-AI] Looking up:", { chargeId, customerId, payoutId, invoiceId });
      
      const results: Record<string, unknown> = {};
      
      if (chargeId) {
        try {
          results.charge = await stripe.charges.retrieve(chargeId, { expand: ['customer', 'invoice', 'balance_transaction'] });
        } catch (e) {
          results.chargeError = `Charge not found: ${chargeId}`;
        }
      }
      
      if (customerId) {
        try {
          results.customer = await stripe.customers.retrieve(customerId);
          results.customerCharges = (await stripe.charges.list({ customer: customerId, limit: 20 })).data;
        } catch (e) {
          results.customerError = `Customer not found: ${customerId}`;
        }
      }
      
      if (payoutId) {
        try {
          results.payout = await stripe.payouts.retrieve(payoutId);
        } catch (e) {
          results.payoutError = `Payout not found: ${payoutId}`;
        }
      }
      
      if (invoiceId) {
        try {
          results.invoice = await stripe.invoices.retrieve(invoiceId);
        } catch (e) {
          results.invoiceError = `Invoice not found: ${invoiceId}`;
        }
      }
      
      return new Response(
        JSON.stringify({ success: true, ...results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: trace - Full transaction trace with payout discovery
    if (action === "trace") {
      const { chargeId } = await req.json().catch(() => ({}));
      console.log("[STRIPE-PAYOUTS-AI] Full trace for charge:", chargeId);
      
      if (!chargeId) {
        return new Response(
          JSON.stringify({ error: "chargeId required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      
      try {
        // Get charge with all expansions
        const charge = await stripe.charges.retrieve(chargeId, {
          expand: ['customer', 'balance_transaction', 'payment_intent', 'invoice']
        });
        
        const balanceTxn = charge.balance_transaction as any;
        let payoutInfo = null;
        
        // Find payout if balance transaction exists
        if (balanceTxn?.available_on) {
          const availableOn = balanceTxn.available_on;
          // Search payouts around that date
          const payouts = await stripe.payouts.list({ 
            limit: 20,
            arrival_date: { gte: availableOn - 86400, lte: availableOn + 86400 * 7 }
          });
          
          // Try to find which payout contains this transaction
          for (const payout of payouts.data) {
            const txns = await stripe.balanceTransactions.list({
              payout: payout.id,
              limit: 100
            });
            if (txns.data.find((t: any) => t.id === balanceTxn?.id)) {
              payoutInfo = {
                id: payout.id,
                amount: payout.amount,
                currency: payout.currency,
                status: payout.status,
                arrival_date: new Date(payout.arrival_date * 1000).toISOString().split('T')[0],
                created: new Date(payout.created * 1000).toISOString(),
                transactionCount: txns.data.length
              };
              break;
            }
          }
        }
        
        const card = charge.payment_method_details?.card as any;
        const customer = charge.customer as any;
        
        const trace = {
          charge: {
            id: charge.id,
            amount: charge.amount / 100,
            currency: charge.currency.toUpperCase(),
            status: charge.status,
            created: new Date(charge.created * 1000).toISOString()
          },
          customer: customer ? {
            id: customer.id,
            name: customer.name,
            email: customer.email
          } : null,
          paymentMethod: {
            brand: card?.brand?.toUpperCase(),
            last4: card?.last4,
            fingerprint: card?.fingerprint,
            wallet: card?.wallet?.type || null,
            walletNote: card?.wallet?.type === 'apple_pay' ? 
              '⚠️ Apple Pay tokenizes cards - physical card number may be different!' : null
          },
          balanceTransaction: balanceTxn ? {
            id: balanceTxn.id,
            gross: balanceTxn.amount / 100,
            fee: balanceTxn.fee / 100,
            net: balanceTxn.net / 100,
            currency: balanceTxn.currency?.toUpperCase(),
            availableOn: new Date(balanceTxn.available_on * 1000).toISOString().split('T')[0]
          } : null,
          payout: payoutInfo,
          timeline: [
            { event: 'Charge Created', date: new Date(charge.created * 1000).toISOString(), details: card?.wallet?.type ? `via ${card.wallet.type}` : 'Direct card' },
            balanceTxn ? { event: 'Funds Available', date: new Date(balanceTxn.available_on * 1000).toISOString().split('T')[0] } : null,
            payoutInfo ? { event: 'Included in Payout', date: payoutInfo.arrival_date, details: `Payout ${payoutInfo.id} (${payoutInfo.transactionCount} transactions)` } : null,
            payoutInfo?.status === 'paid' ? { event: 'Paid to Bank', date: payoutInfo.arrival_date, details: '✅ Complete' } : null
          ].filter(Boolean)
        };
        
        return new Response(
          JSON.stringify({ success: true, trace }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({ error: e.message }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    // Action: chat - AI chat about payouts
    if (action === "chat") {
      console.log("[STRIPE-PAYOUTS-AI] Processing chat message:", message);

      // Auto-fetch Stripe data if no context provided
      let stripeContext = context;
      if (!stripeContext || Object.keys(stripeContext).length === 0) {
        console.log("[STRIPE-PAYOUTS-AI] No context provided, auto-fetching Stripe data...");
        const [balance, payouts, transfers, balanceTransactions, treasuryTransfers, charges, customers] = await Promise.all([
          stripe.balance.retrieve().catch((e: Error) => {
            console.error("Balance error:", e);
            return { available: [], pending: [] };
          }),
          stripe.payouts.list({ limit: 20 }).catch((e: Error) => {
            console.error("Payouts error:", e);
            return { data: [] };
          }),
          stripe.transfers.list({ limit: 20 }).catch((e: Error) => {
            console.error("Transfers error:", e);
            return { data: [] };
          }),
          stripe.balanceTransactions.list({ limit: 100 }).catch((e: Error) => {
            console.error("Balance transactions error:", e);
            return { data: [] };
          }),
          stripe.treasury.outboundTransfers.list({ limit: 50 }).catch((e: Error) => {
            console.error("Treasury transfers error:", e);
            return { data: [] };
          }),
          // Add charges for detailed transaction data
          stripe.charges.list({ limit: 100, expand: ['data.customer'] }).catch((e: Error) => {
            console.error("Charges error:", e);
            return { data: [] };
          }),
          // Add customers for customer lookup
          stripe.customers.list({ limit: 100 }).catch((e: Error) => {
            console.error("Customers error:", e);
            return { data: [] };
          }),
        ]);
        stripeContext = {
          balance,
          payouts: payouts.data || [],
          transfers: transfers.data || [],
          balanceTransactions: balanceTransactions.data || [],
          treasuryTransfers: treasuryTransfers.data || [],
          charges: charges.data || [],
          customers: customers.data || [],
        };
        console.log("[STRIPE-PAYOUTS-AI] Auto-fetched data:", {
          payoutsCount: stripeContext.payouts.length,
          transactionsCount: stripeContext.balanceTransactions.length,
          chargesCount: stripeContext.charges.length,
          customersCount: stripeContext.customers.length,
        });
      }

      // Use direct Gemini API (LOVABLE_API_KEY is optional, only for fallback)
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const useDirectGemini = !!GEMINI_API_KEY;
      
      if (!GEMINI_API_KEY && !LOVABLE_API_KEY) {
        throw new Error("No AI API key configured. Set GEMINI_API_KEY (or GOOGLE_API_KEY)");
      }
      console.log(`🤖 Using ${useDirectGemini ? 'Direct Gemini API' : 'Lovable Gateway (fallback)'}`);

      // Check LangSmith configuration status
      const langsmithKey = Deno.env.get("LANGSMITH_API_KEY");
      const langsmithConfigured = !!langsmithKey;

      const systemPrompt = `You are a Stripe financial assistant specialized in payouts, transfers, and balance management. 

=== SYSTEM INTEGRATION STATUS ===
When users ask about "LangSmith", "LangChain", "tracing", or "AI connection status":
- LangSmith/LangChain Tracing: ${langsmithConfigured ? "✅ CONFIGURED AND ACTIVE" : "❌ NOT CONFIGURED"}
- This AI is powered by: ${GEMINI_API_KEY ? "Google Gemini API (Direct)" : "Lovable AI Gateway"}
- AI Model: gemini-2.0-flash / gemini-2.5-flash

If asked about LangSmith/LangChain: ${langsmithConfigured 
  ? "Tell the user: 'Yes! LangSmith is configured and active. All AI conversations are being traced for monitoring and debugging.'"
  : "Tell the user: 'LangSmith is NOT configured. The LANGSMITH_API_KEY secret needs to be added to enable tracing.'"}

=== CRITICAL ANTI-HALLUCINATION RULES ===
YOU MUST FOLLOW THESE RULES WITHOUT EXCEPTION:

1. **ONLY USE DATA FROM THE PROVIDED CONTEXT** - Never invent, estimate, or calculate values not explicitly present in the data.
2. **NO MADE-UP FEE CALCULATIONS** - Do NOT calculate fees unless the actual fee amount is in the balance_transactions data. Stripe fees are in the "fee" field of each transaction.
3. **CITE ACTUAL DATA** - Every number you report MUST come from the context. Format: "Value: X (from: field_name)"
4. **SAY "NOT IN DATA"** - If information isn't in the context, explicitly say "This information is not available in the current data."
5. **NO PERCENTAGE ASSUMPTIONS** - Never assume fee percentages like "2.9% + 30 cents". Only report actual fees from the data.

=== PERIOD/DATE RANGE AWARENESS ===
IMPORTANT: The user is viewing data for a specific time period. Check the dateRange in the context:
- dateRange.preset: The preset name (e.g., "All time", "Last 7 days", "Last 30 days", "This month")
- dateRange.description: Human-readable date range
- dateRange.from / dateRange.to: ISO date strings

When the user asks "what period" or "which period", answer with the dateRange.preset and dateRange.description from the context.
If dateRange is missing or null, say "You're viewing ALL TIME data (no date filter applied)."

AVAILABLE DATA IN CONTEXT:
- Balance: Available and pending amounts (in smallest currency unit, divide by 100)
- Payouts: Money sent from Stripe to bank accounts - check "status", "amount", "arrival_date"
- Transfers: Money moved between Stripe accounts (Connect)
- Treasury Outbound Transfers: Money sent from Stripe Treasury to external accounts
- Balance Transactions: All money movements - this contains ACTUAL fees in the "fee" field
- Metrics: totalRevenue, totalRefunded, netRevenue, totalPayouts, successfulPaymentsCount, etc.
- Charges: Individual payment transactions with charge IDs (ch_xxx), amounts, customer info, card details
- Customers: Customer records with IDs (cus_xxx), names, emails, and metadata

HOW TO REPORT FEES CORRECTLY:
- Look at balance_transactions in the context
- Each transaction has: amount, fee, net, type
- "fee" field = the actual Stripe fee for that transaction
- "net" field = amount after fee deduction
- Sum the "fee" fields to get total fees - DO NOT calculate or estimate

Current Stripe Data Context:
${JSON.stringify(stripeContext, null, 2)}

Your job is to:
1. Answer questions about payouts, transfers, and balance using ONLY the provided data
2. Report actual fees from balance_transactions, never calculate them
3. Identify any suspicious or unusual transactions
4. Help track where money went and when
5. Explain payout schedules and statuses
6. Alert about any failed or pending payouts
7. Answer "which period" questions using the dateRange context

Be concise but thorough. Format amounts properly (divide by 100 for major currency units).
If data is missing, say so explicitly.`;


      const messages = [
        { role: "system", content: systemPrompt },
        ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ];

      // Call AI API - Direct Gemini or Lovable fallback
      const aiUrl = useDirectGemini 
        ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
        : "https://ai.gateway.lovable.dev/v1/chat/completions";
      const aiKey = useDirectGemini ? GEMINI_API_KEY : LOVABLE_API_KEY;
      const aiModel = useDirectGemini ? "gemini-2.0-flash" : "google/gemini-2.5-flash";

      console.log("[STRIPE-PAYOUTS-AI] Calling AI API:", { url: aiUrl, model: aiModel });

      const response = await fetch(aiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${aiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: aiModel,
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[STRIPE-PAYOUTS-AI] AI Gateway error:", response.status, errorText);
        
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required" }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      console.log("[STRIPE-PAYOUTS-AI] Streaming response started");

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    throw new Error("Invalid action");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[STRIPE-PAYOUTS-AI] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
