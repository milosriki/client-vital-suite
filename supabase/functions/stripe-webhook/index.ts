import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { verifyWebhookSignature, parseStripeAmount, parseStripeTimestamp } from "../_shared/stripe.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// Use Stripe's official event type for proper typing
type StripeEvent = Stripe.Event;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the raw body and signature
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    // CRITICAL: Verify webhook signature to prevent forged events
    // This uses Stripe.webhooks.constructEvent under the hood
    let event: StripeEvent;
    try {
      event = await verifyWebhookSignature(body, signature);
      console.log("✅ Webhook signature verified successfully");
    } catch (verifyError) {
      const errorMessage = verifyError instanceof Error ? verifyError.message : "Unknown verification error";
      console.error("🚨 SECURITY: Webhook signature verification FAILED:", errorMessage);

      // Return 400 to indicate the webhook should not be retried
      return new Response(
        JSON.stringify({
          error: "Webhook signature verification failed",
          received: false,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log(`📨 Received Stripe event: ${event.type} (${event.id})`);

    // Store the event in database (using verified event)
    const { error: insertError } = await supabase
      .from("stripe_events")
      .insert({
        event_id: event.id,
        event_type: event.type,
        api_version: event.api_version || null,
        livemode: event.livemode,
        created_at: parseStripeTimestamp(event.created),
        data: event.data.object,
        request_id: event.request?.id || null,
        idempotency_key: event.request?.idempotency_key || null,
        raw_event: event as unknown as Record<string, unknown>,
      });

    if (insertError) {
      console.error("❌ Error storing event:", insertError);
      // Continue processing even if storage fails
    }

    // Handle specific event types
    let result = { processed: true, action: "stored" };

    // Account Events (Fraud Detection Priority)
    if (event.type.startsWith("v2.core.account")) {
      result = await handleAccountEvent(supabase, event);
      // Run fraud check on account changes
      await checkAccountFraud(supabase, event);
    }
    // Account Person Events
    else if (event.type.includes("account_person")) {
      result = await handleAccountPersonEvent(supabase, event);
      await checkAccountFraud(supabase, event);
    }
    // Money Management Events (High Fraud Risk)
    else if (event.type.startsWith("v2.money_management")) {
      result = await handleMoneyManagementEvent(supabase, event);
      await checkMoneyManagementFraud(supabase, event);
    }
    // Financial Account Events
    else if (event.type.includes("financial_account")) {
      result = await handleFinancialAccountEvent(supabase, event);
    }
    // Billing Meter Events
    else if (event.type.includes("billing.meter")) {
      result = await handleBillingMeterEvent(supabase, event);
    }
    // Payment Events
    else if (event.type.includes("payment_intent")) {
      if (event.type.includes("succeeded")) {
        result = await handlePaymentSucceeded(supabase, event);
      } else {
        result = await handlePaymentFailed(supabase, event);
      }
      await checkPaymentFraud(supabase, event);
    }
    // Charge Events
    else if (event.type.includes("charge")) {
      if (event.type.includes("succeeded")) {
        result = await handleChargeSucceeded(supabase, event);
      } else {
        result = await handleChargeFailed(supabase, event);
      }
      await checkPaymentFraud(supabase, event);
    }
    // Subscription Events
    else if (event.type.includes("subscription")) {
      result = await handleSubscriptionChange(supabase, event);
    }
    // Invoice Events
    else if (event.type.includes("invoice")) {
      result = await handleInvoiceEvent(supabase, event);
    }
    // Payout Events
    else if (event.type.includes("payout")) {
      result = await handlePayoutEvent(supabase, event);
      await checkPayoutFraud(supabase, event);
    }
    // Account Link Events
    else if (event.type.includes("account_link")) {
      result = await handleAccountLinkEvent(supabase, event);
      await checkAccountFraud(supabase, event);
    }
    // Default handler
    else {
      console.log(`ℹ️  Event type ${event.type} received but no specific handler`);
      // Still run general fraud check
      await checkGeneralFraud(supabase, event);
    }

    return new Response(
      JSON.stringify({
        received: true,
        event_id: event.id,
        event_type: event.type,
        ...result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("❌ Webhook error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        received: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

// Event Handlers

async function handlePaymentSucceeded(supabase: any, event: StripeEvent) {
  const paymentIntent = event.data.object;
  
  console.log(`✅ Payment succeeded: ${paymentIntent.id} - ${paymentIntent.amount / 100} ${paymentIntent.currency}`);
  
  // Update or create transaction record
  await supabase
    .from("stripe_transactions")
    .upsert({
      stripe_id: paymentIntent.id,
      customer_id: paymentIntent.customer,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      status: "succeeded",
      payment_method: paymentIntent.payment_method,
      metadata: paymentIntent.metadata,
      created_at: new Date(paymentIntent.created * 1000).toISOString(),
    }, {
      onConflict: "stripe_id"
    });

  return { processed: true, action: "payment_succeeded" };
}

async function handlePaymentFailed(supabase: any, event: StripeEvent) {
  const paymentIntent = event.data.object;
  
  console.log(`❌ Payment failed: ${paymentIntent.id}`);
  
  await supabase
    .from("stripe_transactions")
    .upsert({
      stripe_id: paymentIntent.id,
      customer_id: paymentIntent.customer,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      status: "failed",
      failure_reason: paymentIntent.last_payment_error?.message,
      metadata: paymentIntent.metadata,
      created_at: new Date(paymentIntent.created * 1000).toISOString(),
    }, {
      onConflict: "stripe_id"
    });

  return { processed: true, action: "payment_failed" };
}

async function handleChargeSucceeded(supabase: any, event: StripeEvent) {
  const charge = event.data.object;
  
  console.log(`💳 Charge succeeded: ${charge.id}`);
  
  // Update transaction with charge details
  await supabase
    .from("stripe_transactions")
    .upsert({
      stripe_id: charge.payment_intent || charge.id,
      charge_id: charge.id,
      customer_id: charge.customer,
      amount: charge.amount / 100,
      currency: charge.currency,
      status: charge.status,
      description: charge.description,
      metadata: charge.metadata,
      created_at: new Date(charge.created * 1000).toISOString(),
    }, {
      onConflict: "stripe_id"
    });

  return { processed: true, action: "charge_succeeded" };
}

async function handleChargeFailed(supabase: any, event: StripeEvent) {
  const charge = event.data.object;
  
  console.log(`❌ Charge failed: ${charge.id}`);
  
  await supabase
    .from("stripe_transactions")
    .upsert({
      stripe_id: charge.payment_intent || charge.id,
      charge_id: charge.id,
      customer_id: charge.customer,
      amount: charge.amount / 100,
      currency: charge.currency,
      status: "failed",
      failure_reason: charge.failure_message,
      metadata: charge.metadata,
      created_at: new Date(charge.created * 1000).toISOString(),
    }, {
      onConflict: "stripe_id"
    });

  return { processed: true, action: "charge_failed" };
}

async function handleSubscriptionChange(supabase: any, event: StripeEvent) {
  const subscription = event.data.object;
  
  console.log(`📅 Subscription ${event.type}: ${subscription.id}`);
  
  await supabase
    .from("stripe_subscriptions")
    .upsert({
      stripe_id: subscription.id,
      customer_id: subscription.customer,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      metadata: subscription.metadata,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "stripe_id"
    });

  return { processed: true, action: "subscription_updated" };
}

async function handleInvoiceEvent(supabase: any, event: StripeEvent) {
  const invoice = event.data.object;
  
  console.log(`📄 Invoice ${event.type}: ${invoice.id}`);
  
  await supabase
    .from("stripe_invoices")
    .upsert({
      stripe_id: invoice.id,
      customer_id: invoice.customer,
      subscription_id: invoice.subscription,
      amount_paid: invoice.amount_paid / 100,
      amount_due: invoice.amount_due / 100,
      currency: invoice.currency,
      status: invoice.status,
      paid: invoice.paid,
      metadata: invoice.metadata,
      created_at: new Date(invoice.created * 1000).toISOString(),
    }, {
      onConflict: "stripe_id"
    });

  return { processed: true, action: "invoice_processed" };
}

async function handlePayoutEvent(supabase: any, event: StripeEvent) {
  const payout = event.data.object;
  
  console.log(`💰 Payout ${event.type}: ${payout.id}`);
  
  await supabase
    .from("stripe_payouts")
    .upsert({
      stripe_id: payout.id,
      amount: payout.amount / 100,
      currency: payout.currency,
      status: payout.status,
      arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
      destination: payout.destination,
      metadata: payout.metadata,
      created_at: new Date(payout.created * 1000).toISOString(),
    }, {
      onConflict: "stripe_id"
    });

  return { processed: true, action: "payout_processed" };
}

// ============= FRAUD DETECTION HANDLERS =============

async function checkAccountFraud(supabase: any, event: StripeEvent) {
  const account = event.data.object;
  const fraudSignals: string[] = [];
  let riskScore = 0;

  // Check for suspicious account changes
  if (event.type.includes("account.closed")) {
    fraudSignals.push("Account closed unexpectedly");
    riskScore += 30;
  }

  if (event.type.includes("account.created")) {
    // Check if multiple accounts created quickly
    const { count } = await supabase
      .from("stripe_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "v2.core.account.created")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (count && count > 3) {
      fraudSignals.push("Multiple accounts created in 24h");
      riskScore += 40;
    }
  }

  if (event.type.includes("requirements.updated")) {
    // Check if requirements changed suspiciously
    if (account.requirements?.currently_due?.length === 0 && 
        account.requirements?.past_due?.length > 0) {
      fraudSignals.push("Requirements cleared after being past due");
      riskScore += 25;
    }
  }

  if (riskScore > 0) {
    await createFraudAlert(supabase, {
      event_id: event.id,
      event_type: event.type,
      risk_score: riskScore,
      signals: fraudSignals,
      account_id: account.id,
      severity: riskScore > 50 ? "high" : riskScore > 30 ? "medium" : "low",
    });
  }
}

async function checkMoneyManagementFraud(supabase: any, event: StripeEvent) {
  const transaction = event.data.object;
  const fraudSignals: string[] = [];
  let riskScore = 0;

  // Check for failed transfers (potential fraud)
  if (event.type.includes("failed") || event.type.includes("returned")) {
    fraudSignals.push(`Transaction ${event.type} - potential fraud`);
    riskScore += 20;

    // Check for pattern of failures
    const { count } = await supabase
      .from("stripe_events")
      .select("*", { count: "exact", head: true })
      .or(`event_type.ilike.%failed%,event_type.ilike.%returned%`)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (count && count > 5) {
      fraudSignals.push("Multiple failures in last hour");
      riskScore += 40;
    }
  }

  // Check for large outbound transfers
  if (event.type.includes("outbound") && transaction.amount) {
    const amount = transaction.amount / 100;
    if (amount > 10000) {
      fraudSignals.push(`Large outbound transfer: ${amount}`);
      riskScore += 30;
    }
  }

  // Check for rapid transactions
  if (event.type.includes("transaction.created")) {
    const { count } = await supabase
      .from("stripe_events")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "v2.money_management.transaction.created")
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (count && count > 10) {
      fraudSignals.push("Rapid transaction pattern detected");
      riskScore += 35;
    }
  }

  if (riskScore > 0) {
    await createFraudAlert(supabase, {
      event_id: event.id,
      event_type: event.type,
      risk_score: riskScore,
      signals: fraudSignals,
      transaction_id: transaction.id,
      amount: transaction.amount ? transaction.amount / 100 : null,
      severity: riskScore > 50 ? "high" : riskScore > 30 ? "medium" : "low",
    });
  }
}

async function checkPaymentFraud(supabase: any, event: StripeEvent) {
  const payment = event.data.object;
  const fraudSignals: string[] = [];
  let riskScore = 0;

  // Check for failed payment pattern
  if (event.type.includes("failed")) {
    // Check recent failures from same customer
    const { count } = await supabase
      .from("stripe_events")
      .select("*", { count: "exact", head: true })
      .or(`event_type.ilike.%failed%,event_type.ilike.%payment_failed%`)
      .eq("data->>customer_id", payment.customer)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (count && count > 3) {
      fraudSignals.push("Multiple payment failures from same customer");
      riskScore += 35;
    }
  }

  // Check for test-then-drain pattern
  if (event.type.includes("succeeded")) {
    const amount = payment.amount / 100;
    
    // Check if small payment followed by large payment
    const { data: recentPayments } = await supabase
      .from("stripe_events")
      .select("data")
      .eq("event_type", "payment_intent.succeeded")
      .eq("data->>customer_id", payment.customer)
      .order("created_at", { ascending: false })
      .limit(5);

    if (recentPayments && recentPayments.length > 1) {
      const previousAmount = recentPayments[1]?.data?.amount / 100;
      if (previousAmount < 10 && amount > 1000) {
        fraudSignals.push("Test-then-drain pattern detected");
        riskScore += 50;
      }
    }
  }

  if (riskScore > 0) {
    await createFraudAlert(supabase, {
      event_id: event.id,
      event_type: event.type,
      risk_score: riskScore,
      signals: fraudSignals,
      customer_id: payment.customer,
      amount: payment.amount / 100,
      severity: riskScore > 50 ? "high" : riskScore > 30 ? "medium" : "low",
    });
  }
}

async function checkPayoutFraud(supabase: any, event: StripeEvent) {
  const payout = event.data.object;
  const fraudSignals: string[] = [];
  let riskScore = 0;

  if (event.type.includes("failed")) {
    fraudSignals.push("Payout failed - investigate");
    riskScore += 25;
  }

  // Check for instant payout pattern (potential fraud)
  if (event.type.includes("paid")) {
    const payoutDate = new Date(payout.arrival_date * 1000);
    const createdDate = new Date(payout.created * 1000);
    const hoursDiff = (payoutDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60);

    if (hoursDiff < 24) {
      fraudSignals.push("Instant payout detected");
      riskScore += 20;
    }

    // Check for multiple payouts to same destination
    const { count } = await supabase
      .from("stripe_payouts")
      .select("*", { count: "exact", head: true })
      .eq("destination", payout.destination)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (count && count > 5) {
      fraudSignals.push("Multiple payouts to same destination");
      riskScore += 30;
    }
  }

  if (riskScore > 0) {
    await createFraudAlert(supabase, {
      event_id: event.id,
      event_type: event.type,
      risk_score: riskScore,
      signals: fraudSignals,
      payout_id: payout.id,
      amount: payout.amount / 100,
      destination: payout.destination,
      severity: riskScore > 50 ? "high" : riskScore > 30 ? "medium" : "low",
    });
  }
}

async function checkGeneralFraud(supabase: any, event: StripeEvent) {
  // General fraud check for any event
  const fraudSignals: string[] = [];
  let riskScore = 0;

  // Check for error events
  if (event.type.includes("error") || event.type.includes("failure")) {
    fraudSignals.push("Error event detected");
    riskScore += 10;
  }

  if (riskScore > 0) {
    await createFraudAlert(supabase, {
      event_id: event.id,
      event_type: event.type,
      risk_score: riskScore,
      signals: fraudSignals,
      severity: "low",
    });
  }
}

async function createFraudAlert(supabase: any, alert: any) {
  console.log(`🚨 FRAUD ALERT: ${alert.event_type} - Risk Score: ${alert.risk_score}`);
  
  await supabase
    .from("stripe_fraud_alerts")
    .insert({
      event_id: alert.event_id,
      event_type: alert.event_type,
      risk_score: alert.risk_score,
      signals: alert.signals,
      account_id: alert.account_id,
      customer_id: alert.customer_id,
      transaction_id: alert.transaction_id,
      payout_id: alert.payout_id,
      amount: alert.amount,
      destination: alert.destination,
      severity: alert.severity,
      status: "active",
      created_at: new Date().toISOString(),
    });

  // Also create notification
  await supabase
    .from("notifications")
    .insert({
      type: "fraud_alert",
      title: `🚨 Fraud Alert: ${alert.severity.toUpperCase()} Risk`,
      message: `${alert.event_type}: ${alert.signals.join(", ")}`,
      priority: alert.severity,
      metadata: alert,
      created_at: new Date().toISOString(),
    });
}

// ============= NEW EVENT HANDLERS =============

async function handleAccountEvent(supabase: any, event: StripeEvent) {
  const account = event.data.object;
  
  console.log(`🏢 Account event ${event.type}: ${account.id || account.object?.id}`);
  
  await supabase
    .from("stripe_accounts")
    .upsert({
      stripe_id: account.id || account.object?.id,
      type: account.type,
      country: account.country,
      email: account.email,
      business_type: account.business_type,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      requirements: account.requirements,
      metadata: account.metadata,
      created_at: new Date(account.created * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "stripe_id"
    });

  return { processed: true, action: "account_event" };
}

async function handleAccountPersonEvent(supabase: any, event: StripeEvent) {
  const person = event.data.object;
  
  console.log(`👤 Account person event ${event.type}: ${person.id}`);
  
  await supabase
    .from("stripe_account_persons")
    .upsert({
      stripe_id: person.id,
      account_id: person.account,
      email: person.email,
      first_name: person.first_name,
      last_name: person.last_name,
      relationship: person.relationship,
      verification: person.verification,
      metadata: person.metadata,
      created_at: new Date(person.created * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "stripe_id"
    });

  return { processed: true, action: "account_person_event" };
}

async function handleMoneyManagementEvent(supabase: any, event: StripeEvent) {
  const transaction = event.data.object;
  
  console.log(`💰 Money management event ${event.type}: ${transaction.id}`);
  
  await supabase
    .from("stripe_money_management")
    .upsert({
      stripe_id: transaction.id,
      type: event.type,
      financial_account: transaction.financial_account,
      amount: transaction.amount ? transaction.amount / 100 : null,
      currency: transaction.currency || "AED",
      status: transaction.status,
      flow_type: transaction.flow_type,
      description: transaction.description,
      metadata: transaction.metadata,
      created_at: new Date(transaction.created * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "stripe_id"
    });

  return { processed: true, action: "money_management_event" };
}

async function handleFinancialAccountEvent(supabase: any, event: StripeEvent) {
  const account = event.data.object;
  
  console.log(`🏦 Financial account event ${event.type}: ${account.id}`);
  
  await supabase
    .from("stripe_financial_accounts")
    .upsert({
      stripe_id: account.id,
      status: account.status,
      supported_payment_method_types: account.supported_payment_method_types,
      features: account.features,
      metadata: account.metadata,
      created_at: new Date(account.created * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "stripe_id"
    });

  return { processed: true, action: "financial_account_event" };
}

async function handleBillingMeterEvent(supabase: any, event: StripeEvent) {
  const meter = event.data.object;
  
  console.log(`📊 Billing meter event ${event.type}`);
  
  await supabase
    .from("stripe_billing_meters")
    .insert({
      event_type: event.type,
      meter_id: meter.id || meter.meter_id,
      error_details: meter.error || meter.details,
      created_at: new Date().toISOString(),
    });

  return { processed: true, action: "billing_meter_event" };
}

async function handleAccountLinkEvent(supabase: any, event: StripeEvent) {
  const link = event.data.object;
  
  console.log(`🔗 Account link event ${event.type}: ${link.id}`);
  
  await supabase
    .from("stripe_account_links")
    .upsert({
      stripe_id: link.id,
      account: link.account,
      return_url: link.return_url,
      expires_at: link.expires_at ? new Date(link.expires_at * 1000).toISOString() : null,
      created_at: new Date(link.created * 1000).toISOString(),
    }, {
      onConflict: "stripe_id"
    });

  return { processed: true, action: "account_link_event" };
}

