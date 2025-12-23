import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// LangGraph-style state machine for deep analysis
interface AgentState {
  query: string;
  findings: Finding[];
  knowledge: KnowledgeItem[];
  tokens: any[];
  anomalies: Anomaly[];
  recommendations: string[];
  confidence: number;
  iteration: number;
}

interface Finding {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  evidence: any;
  timestamp: string;
}

interface KnowledgeItem {
  key: string;
  value: any;
  category: string;
  learned_at: string;
  usage_count: number;
}

interface Anomaly {
  type: string;
  description: string;
  data: any;
  risk_score: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { action = "full-discovery", query } = await req.json().catch(() => ({}));
    console.log(`[stripe-deep-agent] Action: ${action}, Query: ${query}`);

    // Initialize agent state
    const state: AgentState = {
      query: query || action,
      findings: [],
      knowledge: [],
      tokens: [],
      anomalies: [],
      recommendations: [],
      confidence: 0,
      iteration: 0,
    };

    // Load existing knowledge from database
    const { data: existingKnowledge } = await supabase
      .from('agent_knowledge')
      .select('*')
      .eq('category', 'stripe')
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
      .limit(50);
    
    if (existingKnowledge) {
      state.knowledge = existingKnowledge.map(k => ({
        key: k.title,
        value: k.structured_data,
        category: k.subcategory || 'general',
        learned_at: k.created_at,
        usage_count: k.usage_count || 0
      }));
    }

    // === GRAPH NODE 1: Collect All Data ===
    console.log("[stripe-deep-agent] Node 1: Collecting all Stripe data...");
    
    const [
      accountResult,
      balanceResult,
      payoutsResult,
      chargesResult,
      refundsResult,
      disputesResult,
      customersResult,
      subscriptionsResult,
      invoicesResult,
      eventsResult,
      paymentMethodsResult,
      setupIntentsResult,
      webhooksResult,
      transfersResult,
    ] = await Promise.allSettled([
      stripe.accounts.retrieve(),
      stripe.balance.retrieve(),
      stripe.payouts.list({ limit: 100 }),
      stripe.charges.list({ limit: 100 }),
      stripe.refunds.list({ limit: 100 }),
      stripe.disputes.list({ limit: 100 }),
      stripe.customers.list({ limit: 100 }),
      stripe.subscriptions.list({ limit: 100, status: 'all' }),
      stripe.invoices.list({ limit: 100 }),
      stripe.events.list({ limit: 100 }),
      stripe.paymentMethods.list({ limit: 100, type: 'card' }),
      stripe.setupIntents.list({ limit: 100 }),
      stripe.webhookEndpoints.list({ limit: 100 }),
      stripe.transfers.list({ limit: 100 }).catch(() => ({ data: [] })),
    ]);

    const account = accountResult.status === 'fulfilled' ? accountResult.value : null;
    const balance = balanceResult.status === 'fulfilled' ? balanceResult.value : null;
    const payouts = payoutsResult.status === 'fulfilled' ? payoutsResult.value.data : [];
    const charges = chargesResult.status === 'fulfilled' ? chargesResult.value.data : [];
    const refunds = refundsResult.status === 'fulfilled' ? refundsResult.value.data : [];
    const disputes = disputesResult.status === 'fulfilled' ? disputesResult.value.data : [];
    const customers = customersResult.status === 'fulfilled' ? customersResult.value.data : [];
    const subscriptions = subscriptionsResult.status === 'fulfilled' ? subscriptionsResult.value.data : [];
    const invoices = invoicesResult.status === 'fulfilled' ? invoicesResult.value.data : [];
    const events = eventsResult.status === 'fulfilled' ? eventsResult.value.data : [];
    const paymentMethods = paymentMethodsResult.status === 'fulfilled' ? paymentMethodsResult.value.data : [];
    const setupIntents = setupIntentsResult.status === 'fulfilled' ? setupIntentsResult.value.data : [];
    const webhooks = webhooksResult.status === 'fulfilled' ? webhooksResult.value.data : [];
    const transfers = transfersResult.status === 'fulfilled' ? (transfersResult.value as any).data || [] : [];

    // === GRAPH NODE 2: Extract ALL Tokens (Payment Methods = Tokenized Cards) ===
    console.log("[stripe-deep-agent] Node 2: Extracting all tokens...");
    
    const allTokens: any[] = [];
    
    // Get all payment methods from customers
    for (const customer of customers.slice(0, 50)) {
      try {
        const customerPMs = await stripe.paymentMethods.list({
          customer: customer.id,
          type: 'card',
          limit: 100,
        });
        
        for (const pm of customerPMs.data) {
          allTokens.push({
            id: pm.id,
            type: 'payment_method',
            customer_id: customer.id,
            customer_email: customer.email,
            card: {
              brand: pm.card?.brand,
              last4: pm.card?.last4,
              exp_month: pm.card?.exp_month,
              exp_year: pm.card?.exp_year,
              country: pm.card?.country,
              funding: pm.card?.funding,
              fingerprint: pm.card?.fingerprint,
              wallet: pm.card?.wallet,
            },
            created: pm.created,
            created_date: new Date(pm.created * 1000).toISOString(),
            billing_details: pm.billing_details,
            metadata: pm.metadata,
          });
        }
      } catch (e) {
        // Customer might not have payment methods
      }
    }

    // Also get setup intents (cards set up for future use)
    for (const si of setupIntents) {
      if (si.payment_method && typeof si.payment_method === 'string') {
        try {
          const pm = await stripe.paymentMethods.retrieve(si.payment_method);
          if (pm.card) {
            const existing = allTokens.find(t => t.id === pm.id);
            if (!existing) {
              allTokens.push({
                id: pm.id,
                type: 'setup_intent_token',
                setup_intent_id: si.id,
                customer_id: si.customer,
                status: si.status,
                card: {
                  brand: pm.card?.brand,
                  last4: pm.card?.last4,
                  exp_month: pm.card?.exp_month,
                  exp_year: pm.card?.exp_year,
                  country: pm.card?.country,
                  funding: pm.card?.funding,
                  fingerprint: pm.card?.fingerprint,
                },
                created: pm.created,
                created_date: new Date(pm.created * 1000).toISOString(),
              });
            }
          }
        } catch (e) {
          // Payment method might be deleted
        }
      }
    }

    // Check for Issuing tokens if enabled
    let issuingTokens: any[] = [];
    let issuingCards: any[] = [];
    try {
      const cards = await stripe.issuing.cards.list({ limit: 100 });
      issuingCards = cards.data;
      
      for (const card of issuingCards) {
        try {
          const tokens = await stripe.issuing.tokens.list({ card: card.id, limit: 100 });
          for (const token of tokens.data) {
            issuingTokens.push({
              id: token.id,
              type: 'issuing_token',
              card_id: card.id,
              card_last4: card.last4,
              status: token.status,
              network: token.network,
              wallet_provider: token.wallet_provider,
              created: token.created,
              created_date: new Date(token.created * 1000).toISOString(),
            });
          }
        } catch (e) {
          // Token listing might fail
        }
      }
    } catch (e) {
      console.log("[stripe-deep-agent] Issuing not enabled or no access");
    }

    state.tokens = [...allTokens, ...issuingTokens];

    // === GRAPH NODE 3: Deep Analysis & Anomaly Detection ===
    console.log("[stripe-deep-agent] Node 3: Analyzing patterns and anomalies...");

    // Analyze charges for patterns
    const chargesByCard: Record<string, any[]> = {};
    const chargesByCountry: Record<string, number> = {};
    const highRiskCharges: any[] = [];
    const failedCharges: any[] = [];
    
    for (const charge of charges) {
      const cardFingerprint = charge.payment_method_details?.card?.fingerprint || 'unknown';
      if (!chargesByCard[cardFingerprint]) chargesByCard[cardFingerprint] = [];
      chargesByCard[cardFingerprint].push(charge);
      
      const country = charge.payment_method_details?.card?.country || 'unknown';
      chargesByCountry[country] = (chargesByCountry[country] || 0) + 1;
      
      if (charge.outcome?.risk_level === 'elevated' || charge.outcome?.risk_level === 'highest') {
        highRiskCharges.push(charge);
      }
      
      if (charge.status === 'failed') {
        failedCharges.push(charge);
      }
    }

    // Find duplicate fingerprints (same card used multiple times)
    const duplicateCards = Object.entries(chargesByCard)
      .filter(([_, charges]) => charges.length > 5)
      .map(([fingerprint, charges]) => ({
        fingerprint,
        count: charges.length,
        total_amount: charges.reduce((sum, c) => sum + c.amount, 0),
        customers: [...new Set(charges.map(c => c.customer))],
      }));

    // Analyze refunds
    const refundRate = charges.length > 0 ? (refunds.length / charges.length) * 100 : 0;
    const largeRefunds = refunds.filter((r: any) => r.amount > 100000); // > 1000 AED

    // Analyze payouts
    const instantPayouts = payouts.filter((p: any) => p.method === 'instant');
    const failedPayouts = payouts.filter((p: any) => p.status === 'failed');
    const pendingPayouts = payouts.filter((p: any) => p.status === 'pending' || p.status === 'in_transit');

    // Build anomalies
    if (disputes.length > 0) {
      state.anomalies.push({
        type: 'disputes',
        description: `${disputes.length} disputes found`,
        data: disputes.map((d: any) => ({
          id: d.id,
          amount: d.amount,
          reason: d.reason,
          status: d.status,
          created: new Date(d.created * 1000).toISOString(),
        })),
        risk_score: Math.min(100, disputes.length * 20),
      });
    }

    if (highRiskCharges.length > 0) {
      state.anomalies.push({
        type: 'high_risk_charges',
        description: `${highRiskCharges.length} high-risk charges detected`,
        data: highRiskCharges.slice(0, 10).map(c => ({
          id: c.id,
          amount: c.amount,
          risk_level: c.outcome?.risk_level,
          risk_score: c.outcome?.risk_score,
        })),
        risk_score: Math.min(100, highRiskCharges.length * 15),
      });
    }

    if (refundRate > 10) {
      state.anomalies.push({
        type: 'high_refund_rate',
        description: `Refund rate of ${refundRate.toFixed(1)}% exceeds 10% threshold`,
        data: { refund_count: refunds.length, charge_count: charges.length, rate: refundRate },
        risk_score: Math.min(100, refundRate * 5),
      });
    }

    if (duplicateCards.length > 0) {
      state.anomalies.push({
        type: 'duplicate_card_usage',
        description: `${duplicateCards.length} cards used excessively`,
        data: duplicateCards,
        risk_score: Math.min(100, duplicateCards.length * 10),
      });
    }

    if (instantPayouts.length > 3) {
      state.anomalies.push({
        type: 'instant_payouts',
        description: `${instantPayouts.length} instant payouts detected (higher fraud risk)`,
        data: instantPayouts.map((p: any) => ({
          id: p.id,
          amount: p.amount,
          arrival_date: new Date(p.arrival_date * 1000).toISOString(),
        })),
        risk_score: Math.min(100, instantPayouts.length * 15),
      });
    }

    // === GRAPH NODE 4: Generate Findings ===
    console.log("[stripe-deep-agent] Node 4: Generating findings...");

    // Account findings
    state.findings.push({
      id: 'account_status',
      type: 'account',
      severity: 'info',
      title: 'Account Configuration',
      description: `${account?.business_profile?.name || 'Unknown'} (${account?.country})`,
      evidence: {
        id: account?.id,
        type: account?.type,
        charges_enabled: account?.charges_enabled,
        payouts_enabled: account?.payouts_enabled,
        capabilities: account?.capabilities,
      },
      timestamp: new Date().toISOString(),
    });

    // Balance findings
    const availableBalance = balance?.available?.[0]?.amount || 0;
    const pendingBalance = balance?.pending?.[0]?.amount || 0;
    if (availableBalance < 0) {
      state.findings.push({
        id: 'negative_balance',
        type: 'financial',
        severity: 'critical',
        title: 'Negative Available Balance',
        description: `Balance is negative: ${(availableBalance / 100).toFixed(2)} ${balance?.available?.[0]?.currency?.toUpperCase()}`,
        evidence: { available: availableBalance, pending: pendingBalance },
        timestamp: new Date().toISOString(),
      });
    }

    // Token findings
    state.findings.push({
      id: 'tokens_summary',
      type: 'tokens',
      severity: 'info',
      title: 'All Tokens Discovered',
      description: `Found ${allTokens.length} payment method tokens, ${issuingTokens.length} issuing tokens`,
      evidence: {
        payment_method_tokens: allTokens.length,
        issuing_tokens: issuingTokens.length,
        issuing_cards: issuingCards.length,
        unique_fingerprints: Object.keys(chargesByCard).length,
      },
      timestamp: new Date().toISOString(),
    });

    // Customer findings
    const customersWithMultiplePMs = customers.filter((c: any) => {
      const tokens = allTokens.filter(t => t.customer_id === c.id);
      return tokens.length > 3;
    });
    if (customersWithMultiplePMs.length > 0) {
      state.findings.push({
        id: 'multiple_payment_methods',
        type: 'customers',
        severity: 'medium',
        title: 'Customers with Many Payment Methods',
        description: `${customersWithMultiplePMs.length} customers have 4+ saved cards`,
        evidence: customersWithMultiplePMs.slice(0, 10).map((c: any) => ({
          id: c.id,
          email: c.email,
          card_count: allTokens.filter(t => t.customer_id === c.id).length,
        })),
        timestamp: new Date().toISOString(),
      });
    }

    // Webhook findings
    const disabledWebhooks = webhooks.filter((w: any) => w.status === 'disabled');
    if (disabledWebhooks.length > 0) {
      state.findings.push({
        id: 'disabled_webhooks',
        type: 'webhooks',
        severity: 'high',
        title: 'Disabled Webhooks',
        description: `${disabledWebhooks.length} webhook endpoints are disabled`,
        evidence: disabledWebhooks.map((w: any) => ({ id: w.id, url: w.url, status: w.status })),
        timestamp: new Date().toISOString(),
      });
    }

    // === GRAPH NODE 5: Store Knowledge ===
    console.log("[stripe-deep-agent] Node 5: Persisting knowledge...");

    const knowledgeToStore = [
      {
        title: 'stripe_tokens_count',
        category: 'stripe',
        subcategory: 'tokens',
        content: `Total tokens: ${state.tokens.length}`,
        structured_data: {
          payment_methods: allTokens.length,
          issuing_tokens: issuingTokens.length,
          last_updated: new Date().toISOString(),
        },
      },
      {
        title: 'stripe_anomalies',
        category: 'stripe',
        subcategory: 'anomalies',
        content: `Anomalies detected: ${state.anomalies.length}`,
        structured_data: {
          anomalies: state.anomalies,
          total_risk_score: state.anomalies.reduce((sum, a) => sum + a.risk_score, 0),
        },
      },
      {
        title: 'stripe_metrics',
        category: 'stripe',
        subcategory: 'metrics',
        content: `Key Stripe metrics snapshot`,
        structured_data: {
          customers: customers.length,
          charges: charges.length,
          refunds: refunds.length,
          refund_rate: refundRate,
          disputes: disputes.length,
          subscriptions: subscriptions.length,
          active_subs: subscriptions.filter((s: any) => s.status === 'active').length,
        },
      },
    ];

    for (const knowledge of knowledgeToStore) {
      const { error } = await supabase.from('agent_knowledge').upsert({
        ...knowledge,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'title' });
      if (error) console.log('Knowledge upsert error:', error);
    }

    // === GRAPH NODE 6: Generate Response ===
    console.log("[stripe-deep-agent] Node 6: Generating response...");

    // Calculate overall risk score
    const overallRiskScore = Math.min(100, state.anomalies.reduce((sum, a) => sum + a.risk_score, 0) / Math.max(1, state.anomalies.length));
    state.confidence = 100 - overallRiskScore;

    // Generate recommendations
    if (disputes.length > 0) {
      state.recommendations.push(`Review ${disputes.length} disputes and prepare evidence for chargeback defense`);
    }
    if (highRiskCharges.length > 0) {
      state.recommendations.push(`Investigate ${highRiskCharges.length} high-risk charges for potential fraud`);
    }
    if (refundRate > 5) {
      state.recommendations.push(`Refund rate (${refundRate.toFixed(1)}%) is elevated - review product/service quality`);
    }
    if (disabledWebhooks.length > 0) {
      state.recommendations.push(`Re-enable ${disabledWebhooks.length} disabled webhooks to ensure event delivery`);
    }

    const response = {
      success: true,
      agent_version: "2.0-langgraph",
      timestamp: new Date().toISOString(),
      
      // All tokens discovered
      tokens: {
        total: state.tokens.length,
        payment_methods: allTokens.length,
        issuing_tokens: issuingTokens.length,
        issuing_cards: issuingCards.length,
        all_tokens: state.tokens,
      },
      
      // All findings
      findings: state.findings,
      
      // All anomalies
      anomalies: state.anomalies,
      
      // Metrics summary
      metrics: {
        customers: customers.length,
        charges: charges.length,
        refunds: refunds.length,
        refund_rate: `${refundRate.toFixed(2)}%`,
        disputes: disputes.length,
        subscriptions: {
          total: subscriptions.length,
          active: subscriptions.filter((s: any) => s.status === 'active').length,
          canceled: subscriptions.filter((s: any) => s.status === 'canceled').length,
        },
        payouts: {
          total: payouts.length,
          instant: instantPayouts.length,
          failed: failedPayouts.length,
          pending: pendingPayouts.length,
        },
        webhooks: {
          total: webhooks.length,
          disabled: disabledWebhooks.length,
        },
        balance: {
          available: availableBalance,
          pending: pendingBalance,
          currency: balance?.available?.[0]?.currency,
        },
      },
      
      // Card analysis
      card_analysis: {
        unique_fingerprints: Object.keys(chargesByCard).length,
        by_country: chargesByCountry,
        duplicate_usage: duplicateCards,
        high_risk_charges: highRiskCharges.length,
        failed_charges: failedCharges.length,
      },
      
      // Risk assessment
      risk_assessment: {
        overall_score: overallRiskScore,
        confidence: state.confidence,
        anomaly_count: state.anomalies.length,
      },
      
      // Recommendations
      recommendations: state.recommendations,
      
      // Knowledge base stats
      knowledge: {
        existing_items: existingKnowledge?.length || 0,
        new_items_stored: knowledgeToStore.length,
      },
    };

    return new Response(JSON.stringify(response, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[stripe-deep-agent] Error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
