import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { RunTree } from "https://esm.sh/langsmith";

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

    // Action: chat - AI chat about payouts
    if (action === "chat") {
      console.log("[STRIPE-PAYOUTS-AI] Processing chat message:", message);

      const parentRun = new RunTree({
        name: "stripe_payouts_chat",
        run_type: "chain",
        inputs: { message, context, history },
        project_name: Deno.env.get("LANGCHAIN_PROJECT") || "ptd-fitness-agent",
      });
      await parentRun.postRun();

      try {

      // Use direct Gemini API (LOVABLE_API_KEY is optional, only for fallback)
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const useDirectGemini = !!GEMINI_API_KEY;
      
      if (!GEMINI_API_KEY && !LOVABLE_API_KEY) {
        throw new Error("No AI API key configured. Set GEMINI_API_KEY (or GOOGLE_API_KEY)");
      }
      console.log(`🤖 Using ${useDirectGemini ? 'Direct Gemini API' : 'Lovable Gateway (fallback)'}`);

      const systemPrompt = `You are a Stripe financial assistant specialized in payouts, transfers, and balance management. 
You have access to the user's Stripe data including:
- Balance: Available and pending amounts
- Payouts: Money sent from Stripe to bank accounts
- Transfers: Money moved between Stripe accounts (Connect)
- Treasury Outbound Transfers: Money sent from Stripe Treasury to external accounts
- Balance Transactions: All money movements including charges, refunds, fees

Current Stripe Data Context:
${JSON.stringify(context, null, 2)}

Your job is to:
1. Answer questions about payouts, transfers, and balance
2. Identify any suspicious or unusual transactions
3. Help track where money went and when
4. Explain payout schedules and statuses
5. Alert about any failed or pending payouts
6. Help investigate if someone transferred money without authorization
7. If the user asks for "deep history" or older data (e.g., 12 months), explain that you can analyze the provided data but for a full 12-month export they should check the Treasury tab or request a specific date range report.

Be concise but thorough. Format amounts properly. Highlight any concerns.
If asked about authorized persons or suspicious activity, analyze the transfer destinations and patterns.`;

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

      const childRun = await parentRun.createChild({
        name: "ai_gateway_call",
        run_type: "llm",
        inputs: { messages, model: aiModel },
      });
      await childRun.postRun();

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
        
        await childRun.end({ error: `AI Gateway error: ${response.status} - ${errorText}` });
        await childRun.patchRun();
        await parentRun.end({ error: `AI Gateway error: ${response.status}` });
        await parentRun.patchRun();
        
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

      await childRun.end({ outputs: { status: "streaming_started" } });
      await childRun.patchRun();
      await parentRun.end({ outputs: { status: "streaming_started" } });
      await parentRun.patchRun();

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
      } catch (error: any) {
        await parentRun.end({ error: error.message });
        await parentRun.patchRun();
        throw error;
      }
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
