import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { traceStart, traceEnd, createStripeTraceMetadata } from "../_shared/langsmith-tracing.ts";

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

  // Start LangSmith trace for the entire request
  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { action = "health-check", days = 30, includeSetupIntents = true } = body;

  const traceRun = await traceStart(
    {
      name: `stripe-forensics:${action}`,
      runType: "chain",
      metadata: createStripeTraceMetadata(action, { days, includeSetupIntents }),
      tags: ["stripe", "forensics", action],
    },
    { action, days, includeSetupIntents }
  );

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    console.log("[STRIPE-FORENSICS] Action:", action);

    // Quick health check for system monitoring
    if (action === "health-check") {
      const account = await stripe.accounts.retrieve().catch(() => null);
      return new Response(
        JSON.stringify({
          ok: true,
          connected: !!account,
          accountId: account?.id,
          timestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // ==================== COMPLETE MONEY INTELLIGENCE ====================
    if (action === "complete-intelligence") {
      console.log("[STRIPE-FORENSICS] Running Complete Money Intelligence...");

      // Core data fetch
      const [
        balance,
        payouts,
        balanceTransactions,
        charges,
        refunds,
        transfers,
        topups,
        account,
        disputes,
        customers,
        events
      ] = await Promise.all([
        stripe.balance.retrieve().catch(() => null),
        fetchAllStripe(stripe.payouts, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.balanceTransactions, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.charges, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.refunds, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.transfers, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        stripe.topups.list({ limit: 100, created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        stripe.accounts.retrieve().catch(() => null),
        fetchAllStripe(stripe.disputes, {}).catch(() => ({ data: [] })),
        stripe.customers.list({ limit: 100 }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.events, { created: { gte: sevenDaysAgo } }).catch(() => ({ data: [] }))
      ]);

      // ====== ISSUING (Card Spend Tracking) ======
      let issuing = {
        enabled: false,
        cards: [] as any[],
        cardholders: [] as any[],
        transactions: [] as any[],
        authorizations: [] as any[],
        disputes: [] as any[],
        totalSpend: 0,
        pendingAuth: 0
      };

      try {
        const [cards, cardholders, txns, auths, issuingDisputes] = await Promise.all([
          stripe.issuing.cards.list({ limit: 100 }),
          stripe.issuing.cardholders.list({ limit: 100 }),
          stripe.issuing.transactions.list({ limit: 100, created: { gte: daysAgo } }),
          stripe.issuing.authorizations.list({ limit: 100, created: { gte: daysAgo } }),
          stripe.issuing.disputes.list({ limit: 100 }).catch(() => ({ data: [] }))
        ]);
        
        issuing = {
          enabled: true,
          cards: cards.data.map((c: any) => ({
            id: c.id,
            last4: c.last4,
            brand: c.brand,
            type: c.type,
            status: c.status,
            cardholderName: c.cardholder?.name,
            cardholderId: c.cardholder?.id,
            spendingControls: c.spending_controls,
            created: c.created,
            expMonth: c.exp_month,
            expYear: c.exp_year
          })),
          cardholders: cardholders.data.map((ch: any) => ({
            id: ch.id,
            name: ch.name,
            email: ch.email,
            phone: ch.phone_number,
            status: ch.status,
            type: ch.type,
            created: ch.created,
            company: ch.company?.name
          })),
          transactions: txns.data.map((t: any) => ({
            id: t.id,
            amount: t.amount,
            currency: t.currency,
            type: t.type,
            cardId: t.card,
            cardLast4: t.card?.last4,
            merchantName: t.merchant_data?.name,
            merchantCategory: t.merchant_data?.category,
            merchantCategoryCode: t.merchant_data?.category_code,
            merchantCity: t.merchant_data?.city,
            merchantCountry: t.merchant_data?.country,
            merchantPostalCode: t.merchant_data?.postal_code,
            created: t.created,
            authorizationId: t.authorization
          })),
          authorizations: auths.data.map((a: any) => ({
            id: a.id,
            amount: a.amount,
            currency: a.currency,
            status: a.status,
            approved: a.approved,
            cardId: a.card?.id,
            cardLast4: a.card?.last4,
            merchantName: a.merchant_data?.name,
            merchantCategory: a.merchant_data?.category,
            merchantCity: a.merchant_data?.city,
            merchantCountry: a.merchant_data?.country,
            created: a.created,
            authorizationMethod: a.authorization_method
          })),
          disputes: issuingDisputes.data || [],
          totalSpend: txns.data.reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0),
          pendingAuth: auths.data.filter((a: any) => a.status === 'pending').length
        };
        console.log("[STRIPE-FORENSICS] Issuing data fetched:", { 
          cards: issuing.cards.length, 
          transactions: issuing.transactions.length,
          cardholders: issuing.cardholders.length
        });
      } catch (e) {
        console.log("[STRIPE-FORENSICS] Issuing not enabled:", e);
      }

      // ====== TREASURY (Financial Accounts) ======
      let treasury = {
        enabled: false,
        financialAccounts: [] as any[],
        transactions: [] as any[],
        inboundTransfers: [] as any[],
        outboundTransfers: [] as any[],
        outboundPayments: [] as any[],
        receivedCredits: [] as any[],
        receivedDebits: [] as any[],
        totalBalance: 0
      };

      try {
        const [financialAccounts] = await Promise.all([
          stripe.treasury.financialAccounts.list({ limit: 100 })
        ]);
        
        if (financialAccounts.data.length > 0) {
          const faIds = financialAccounts.data.map((fa: any) => fa.id);
          
          // Fetch transactions for each FA
          const allTxns: any[] = [];
          const allInbound: any[] = [];
          const allOutbound: any[] = [];
          const allOutboundPayments: any[] = [];
          const allReceivedCredits: any[] = [];
          const allReceivedDebits: any[] = [];

          for (const faId of faIds) {
            try {
              const [txns, inbound, outbound, outPay, recCred, recDeb] = await Promise.all([
                stripe.treasury.transactions.list({ financial_account: faId, limit: 100 }).catch(() => ({ data: [] })),
                stripe.treasury.inboundTransfers.list({ financial_account: faId, limit: 100 }).catch(() => ({ data: [] })),
                stripe.treasury.outboundTransfers.list({ financial_account: faId, limit: 100 }).catch(() => ({ data: [] })),
                stripe.treasury.outboundPayments.list({ financial_account: faId, limit: 100 }).catch(() => ({ data: [] })),
                stripe.treasury.receivedCredits.list({ financial_account: faId, limit: 100 }).catch(() => ({ data: [] })),
                stripe.treasury.receivedDebits.list({ financial_account: faId, limit: 100 }).catch(() => ({ data: [] }))
              ]);
              allTxns.push(...(txns.data || []));
              allInbound.push(...(inbound.data || []));
              allOutbound.push(...(outbound.data || []));
              allOutboundPayments.push(...(outPay.data || []));
              allReceivedCredits.push(...(recCred.data || []));
              allReceivedDebits.push(...(recDeb.data || []));
            } catch (e) {
              console.log(`[STRIPE-FORENSICS] Error fetching Treasury data for ${faId}:`, e);
            }
          }

          treasury = {
            enabled: true,
            financialAccounts: financialAccounts.data.map((fa: any) => ({
              id: fa.id,
              status: fa.status,
              balance: fa.balance,
              supportedCurrencies: fa.supported_currencies,
              activeFeatures: fa.active_features,
              pendingFeatures: fa.pending_features,
              restrictedFeatures: fa.restricted_features,
              financialAddresses: fa.financial_addresses,
              livemode: fa.livemode,
              created: fa.created
            })),
            transactions: allTxns.map((t: any) => ({
              id: t.id,
              amount: t.amount,
              currency: t.currency,
              status: t.status,
              flowType: t.flow_type,
              flowDetails: t.flow_details,
              created: t.created,
              description: t.description
            })),
            inboundTransfers: allInbound.map((t: any) => ({
              id: t.id,
              amount: t.amount,
              currency: t.currency,
              status: t.status,
              originPaymentMethod: t.origin_payment_method,
              originPaymentMethodDetails: t.origin_payment_method_details,
              created: t.created,
              statementDescriptor: t.statement_descriptor,
              failureDetails: t.failure_details
            })),
            outboundTransfers: allOutbound.map((t: any) => ({
              id: t.id,
              amount: t.amount,
              currency: t.currency,
              status: t.status,
              destination: t.destination_payment_method,
              created: t.created,
              expectedArrivalDate: t.expected_arrival_date,
              statementDescriptor: t.statement_descriptor,
              trackingDetails: t.tracking_details
            })),
            outboundPayments: allOutboundPayments.map((p: any) => ({
              id: p.id,
              amount: p.amount,
              currency: p.currency,
              status: p.status,
              destinationType: p.destination_payment_method_details?.type,
              created: p.created,
              expectedArrivalDate: p.expected_arrival_date,
              statementDescriptor: p.statement_descriptor
            })),
            receivedCredits: allReceivedCredits,
            receivedDebits: allReceivedDebits,
            totalBalance: financialAccounts.data.reduce((sum: number, fa: any) => {
              return sum + (fa.balance?.cash?.usd || 0) + (fa.balance?.inbound_pending?.usd || 0);
            }, 0)
          };
          console.log("[STRIPE-FORENSICS] Treasury data fetched:", { 
            accounts: treasury.financialAccounts.length,
            transactions: treasury.transactions.length,
            inbound: treasury.inboundTransfers.length,
            outbound: treasury.outboundTransfers.length
          });
        }
      } catch (e) {
        console.log("[STRIPE-FORENSICS] Treasury not enabled:", e);
      }

      // ====== TERMINAL (POS Configuration) ======
      let terminal = {
        enabled: false,
        readers: [] as any[],
        locations: [] as any[],
        configurations: [] as any[],
        connectionTokens: 0
      };

      try {
        const [readers, locations, configs] = await Promise.all([
          stripe.terminal.readers.list({ limit: 100 }),
          stripe.terminal.locations.list({ limit: 100 }),
          stripe.terminal.configurations.list({ limit: 100 })
        ]);
        
        terminal = {
          enabled: true,
          readers: readers.data.map((r: any) => ({
            id: r.id,
            deviceType: r.device_type,
            label: r.label,
            status: r.status,
            location: r.location,
            serialNumber: r.serial_number,
            deviceSwVersion: r.device_sw_version,
            ipAddress: r.ip_address,
            lastSeenAt: r.last_seen_at,
            livemode: r.livemode
          })),
          locations: locations.data.map((l: any) => ({
            id: l.id,
            displayName: l.display_name,
            address: l.address,
            configurationOverrides: l.configuration_overrides,
            livemode: l.livemode
          })),
          configurations: configs.data.map((c: any) => ({
            id: c.id,
            isAccountDefault: c.is_account_default,
            name: c.name,
            offline: c.offline,
            rebootWindow: c.reboot_window,
            tipping: c.tipping,
            livemode: c.livemode
          })),
          connectionTokens: 0
        };
        console.log("[STRIPE-FORENSICS] Terminal data fetched:", {
          readers: terminal.readers.length,
          locations: terminal.locations.length,
          configs: terminal.configurations.length
        });
      } catch (e) {
        console.log("[STRIPE-FORENSICS] Terminal not enabled:", e);
      }

      // ====== CASH BALANCE (Customer Prepaid Funds) ======
      const cashBalances: any[] = [];
      try {
        // Fetch customers with cash balance
        const customersWithCash = (customers.data || []).filter((c: any) => c.cash_balance);
        
        for (const customer of customersWithCash.slice(0, 20)) {
          try {
            const cashBalance = await stripe.customers.retrieveCashBalance(customer.id);
            const cashTxns = await stripe.customers.listCashBalanceTransactions(customer.id, { limit: 50 });
            
            cashBalances.push({
              customerId: customer.id,
              customerEmail: customer.email,
              customerName: customer.name,
              balance: cashBalance.available,
              livemode: cashBalance.livemode,
              transactions: (cashTxns.data || []).map((t: any) => ({
                id: t.id,
                type: t.type,
                amount: t.net_amount,
                currency: t.currency,
                endingBalance: t.ending_balance,
                created: t.created,
                funded: t.funded,
                appliedToPayment: t.applied_to_payment,
                refunded: t.refunded_from_payment
              }))
            });
          } catch (e) {
            // Skip if cash balance not available
          }
        }
        console.log("[STRIPE-FORENSICS] Cash balances fetched:", cashBalances.length);
      } catch (e) {
        console.log("[STRIPE-FORENSICS] Cash balance fetch error:", e);
      }

      // ====== BUILD UNIFIED MONEY FLOW TIMELINE ======
      const moneyFlow: MoneyFlowEvent[] = [];

      // INFLOWS: Charges
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
              cardCountry: charge.payment_method_details?.card?.country,
              cardFunding: charge.payment_method_details?.card?.funding,
              customer: charge.customer,
              receiptUrl: charge.receipt_url,
              riskScore: charge.outcome?.risk_score,
              riskLevel: charge.outcome?.risk_level
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

      // INFLOWS: Treasury Inbound Transfers
      treasury.inboundTransfers.forEach((t: any) => {
        moneyFlow.push({
          id: t.id,
          type: 'inflow',
          category: 'treasury_inbound',
          amount: t.amount,
          currency: t.currency,
          timestamp: t.created,
          source: t.originPaymentMethodDetails?.us_bank_account?.bank_name || 'external_bank',
          destination: 'financial_account',
          description: `Treasury inbound transfer`,
          metadata: t,
          status: t.status
        });
      });

      // INFLOWS: Treasury Received Credits
      treasury.receivedCredits.forEach((c: any) => {
        moneyFlow.push({
          id: c.id,
          type: 'inflow',
          category: 'treasury_credit',
          amount: c.amount,
          currency: c.currency,
          timestamp: c.created,
          source: c.initiating_payment_method_details?.type || 'external',
          destination: 'financial_account',
          description: `Treasury received credit`,
          metadata: c,
          status: c.status
        });
      });

      // OUTFLOWS: Payouts
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
            destinationId: payout.destination,
            failureCode: payout.failure_code,
            failureMessage: payout.failure_message
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

      // OUTFLOWS: Transfers
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

      // OUTFLOWS: Issuing Transactions
      issuing.transactions.forEach((txn: any) => {
        moneyFlow.push({
          id: txn.id,
          type: 'outflow',
          category: 'card_spend',
          amount: Math.abs(txn.amount),
          currency: txn.currency,
          timestamp: txn.created,
          source: `card_${txn.cardLast4}`,
          destination: txn.merchantName || 'merchant',
          description: `Card purchase: ${txn.merchantName || 'Unknown merchant'}`,
          metadata: {
            cardId: txn.cardId,
            merchantName: txn.merchantName,
            merchantCategory: txn.merchantCategory,
            merchantCategoryCode: txn.merchantCategoryCode,
            merchantCity: txn.merchantCity,
            merchantCountry: txn.merchantCountry,
            authorizationId: txn.authorizationId
          },
          status: txn.type
        });
      });

      // OUTFLOWS: Treasury Outbound Transfers
      treasury.outboundTransfers.forEach((t: any) => {
        moneyFlow.push({
          id: t.id,
          type: 'outflow',
          category: 'treasury_outbound',
          amount: t.amount,
          currency: t.currency,
          timestamp: t.created,
          source: 'financial_account',
          destination: t.destination || 'external_bank',
          description: `Treasury outbound transfer`,
          metadata: t,
          status: t.status,
          traceId: t.trackingDetails?.ach?.trace_number
        });
      });

      // OUTFLOWS: Treasury Outbound Payments
      treasury.outboundPayments.forEach((p: any) => {
        moneyFlow.push({
          id: p.id,
          type: 'outflow',
          category: 'treasury_payment',
          amount: p.amount,
          currency: p.currency,
          timestamp: p.created,
          source: 'financial_account',
          destination: p.destinationType || 'external',
          description: `Treasury outbound payment`,
          metadata: p,
          status: p.status
        });
      });

      // Sort by timestamp descending
      moneyFlow.sort((a, b) => b.timestamp - a.timestamp);

      // Calculate summaries
      const totalInflow = moneyFlow.filter(f => f.type === 'inflow').reduce((sum, f) => sum + f.amount, 0);
      const totalOutflow = moneyFlow.filter(f => f.type === 'outflow').reduce((sum, f) => sum + f.amount, 0);

      const flowByCategory: Record<string, { count: number; amount: number }> = {};
      moneyFlow.forEach(f => {
        if (!flowByCategory[f.category]) {
          flowByCategory[f.category] = { count: 0, amount: 0 };
        }
        flowByCategory[f.category].count++;
        flowByCategory[f.category].amount += f.amount;
      });

      // Destination analysis
      const destinationAnalysis: Record<string, { count: number; amount: number; type: string }> = {};
      moneyFlow.filter(f => f.type === 'outflow').forEach(f => {
        const dest = String(f.destination).slice(0, 50);
        if (!destinationAnalysis[dest]) {
          destinationAnalysis[dest] = { count: 0, amount: 0, type: f.category };
        }
        destinationAnalysis[dest].count++;
        destinationAnalysis[dest].amount += f.amount;
      });

      // Anomaly detection
      const anomalies: AnomalyResult[] = [];

      // Check for instant payouts
      const instantPayouts = (payouts.data || []).filter((p: any) => p.method === 'instant');
      if (instantPayouts.length > 0) {
        anomalies.push({
          type: "INSTANT_PAYOUTS",
          severity: "high",
          message: `${instantPayouts.length} Instant Payouts detected`,
          details: {
            count: instantPayouts.length,
            totalAmount: instantPayouts.reduce((sum: number, p: any) => sum + p.amount, 0) / 100
          }
        });
      }

      // Check for high payout velocity
      const payoutDates = (payouts.data || []).map((p: any) => new Date(p.created * 1000).toDateString());
      const payoutsPerDay = payoutDates.reduce((acc: Record<string, number>, date: string) => {
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});
      Object.entries(payoutsPerDay).forEach(([date, count]) => {
        if ((count as number) > 3) {
          anomalies.push({
            type: "HIGH_VELOCITY_PAYOUTS",
            severity: "high",
            message: `${count} payouts on ${date}`,
            details: { date, count }
          });
        }
      });

      // Check for open disputes
      const openDisputes = (disputes.data || []).filter((d: any) =>
        d.status === 'needs_response' || d.status === 'under_review'
      );
      if (openDisputes.length > 0) {
        anomalies.push({
          type: "OPEN_DISPUTES",
          severity: "high",
          message: `${openDisputes.length} open disputes`,
          details: { disputes: openDisputes.map((d: any) => ({ id: d.id, amount: d.amount / 100, reason: d.reason })) }
        });
      }

      // ====== FORENSIC CHECK 1: SHADOW ADMIN DETECTION ======
      // Check if account is controlled by external platform (is_controller)
      if (account?.controller?.is_controller === true) {
        anomalies.push({
          type: "SHADOW_ADMIN_DETECTED",
          severity: "critical",
          message: "Account is controlled by an external Platform! They can initiate payouts and change settings invisible to you.",
          details: {
            controller: account.controller,
            controllerType: account.controller?.type,
            losses: account.controller?.losses,
            requirement_collection: account.controller?.requirement_collection,
            stripe_dashboard: account.controller?.stripe_dashboard
          }
        });
      }

      // ====== FORENSIC CHECK 2: MANUAL VISA APPROVAL AUDIT ======
      // Check capability.updated events for manual (non-system) approvals
      const capabilityEvents = (events.data || []).filter((e: any) =>
        e.type === 'capability.updated' || e.type === 'account.updated'
      );
      capabilityEvents.forEach((event: any) => {
        const capability = event.data?.object;
        // If request.id exists, it was a MANUAL action (API call), not system automation
        if (event.request?.id && capability?.status === 'active') {
          anomalies.push({
            type: "MANUAL_CAPABILITY_APPROVAL",
            severity: "high",
            message: `Capability '${capability?.id || 'unknown'}' was manually activated via API request`,
            details: {
              requestId: event.request.id,
              capabilityId: capability?.id,
              status: capability?.status,
              timestamp: event.created,
              eventId: event.id,
              note: "Check Dashboard > Developers > Logs for IP address of this request"
            },
            timestamp: event.created
          });
        }
      });

      // ====== FORENSIC CHECK 3: APPLICATION FEE SKIMMING ======
      // Check charges for hidden application_fee redirecting money to platform
      const chargesWithFees = (charges.data || []).filter((c: any) =>
        c.application_fee_amount && c.application_fee_amount > 0
      );
      if (chargesWithFees.length > 0) {
        const totalSkimmed = chargesWithFees.reduce((sum: number, c: any) => sum + c.application_fee_amount, 0);
        anomalies.push({
          type: "HIDDEN_FEE_SKIMMING",
          severity: "critical",
          message: `${chargesWithFees.length} charges have hidden application fees redirecting ${(totalSkimmed / 100).toFixed(2)} to a platform!`,
          details: {
            totalSkimmed: totalSkimmed / 100,
            chargeCount: chargesWithFees.length,
            samples: chargesWithFees.slice(0, 5).map((c: any) => ({
              chargeId: c.id,
              amount: c.amount / 100,
              feeSkimmed: c.application_fee_amount / 100,
              applicationId: c.application,
              created: c.created
            }))
          }
        });
      }

      // ====== FORENSIC CHECK 4: TRANSFER DATA MONEY REDIRECT ======
      // Check charges for transfer_data.destination routing funds to connected accounts
      const chargesWithTransfer = (charges.data || []).filter((c: any) =>
        c.transfer_data?.destination
      );
      if (chargesWithTransfer.length > 0) {
        const totalRedirected = chargesWithTransfer.reduce((sum: number, c: any) =>
          sum + (c.transfer_data?.amount || c.amount), 0
        );
        const totalCharged = chargesWithTransfer.reduce((sum: number, c: any) => sum + c.amount, 0);
        
        // Group by destination
        const destinationGroups: Record<string, { count: number; amount: number }> = {};
        chargesWithTransfer.forEach((c: any) => {
          const dest = c.transfer_data.destination;
          if (!destinationGroups[dest]) destinationGroups[dest] = { count: 0, amount: 0 };
          destinationGroups[dest].count++;
          destinationGroups[dest].amount += (c.transfer_data?.amount || c.amount);
        });

        // Calculate skimming percentage
        const skimPercentage = totalCharged > 0 ? ((totalCharged - totalRedirected) / totalCharged * 100).toFixed(2) : '0';
        
        anomalies.push({
          type: "TRANSFER_MONEY_REDIRECT",
          severity: skimPercentage > '5' ? "critical" : "high",
          message: `${chargesWithTransfer.length} charges have funds routed to connected accounts (${(totalRedirected / 100).toFixed(2)} total)`,
          details: {
            totalRedirected: totalRedirected / 100,
            chargeCount: chargesWithTransfer.length,
            destinations: Object.entries(destinationGroups).map(([dest, data]) => ({
              accountId: dest,
              chargeCount: data.count,
              totalAmount: data.amount / 100
            })),
            samples: chargesWithTransfer.slice(0, 5).map((c: any) => ({
              chargeId: c.id,
              amount: c.amount / 100,
              destination: c.transfer_data.destination,
              transferAmount: (c.transfer_data?.amount || c.amount) / 100,
              created: c.created
            }))
          }
        });
      }

      // ====== FORENSIC CHECK 5: PAYOUT DESTINATION VALIDATION ======
      // Check if payouts go to unauthorized bank accounts (Mule accounts)
      const accountInfo = await stripe.accounts.retrieve().catch(() => null);
      const authorizedBankAccounts = accountInfo?.external_accounts?.data?.map((ea: any) => ea.id) || [];
      
      const suspiciousPayouts = (payouts.data || []).filter((p: any) => {
        // Check if payout destination matches authorized accounts
        if (p.destination && !authorizedBankAccounts.includes(p.destination)) {
          return true;
        }
        // Check for card payouts (debit card transfers - high risk)
        if (p.type === 'card') {
          return true;
        }
        return false;
      });

      if (suspiciousPayouts.length > 0) {
        const totalSuspicious = suspiciousPayouts.reduce((sum: number, p: any) => sum + p.amount, 0);
        anomalies.push({
          type: "UNAUTHORIZED_PAYOUT_DESTINATION",
          severity: "critical",
          message: `${suspiciousPayouts.length} payouts to unauthorized destinations! Total: ${(totalSuspicious / 100).toFixed(2)}`,
          details: {
            totalAmount: totalSuspicious / 100,
            payoutCount: suspiciousPayouts.length,
            authorizedAccounts: authorizedBankAccounts,
            suspiciousPayouts: suspiciousPayouts.slice(0, 10).map((p: any) => ({
              payoutId: p.id,
              amount: p.amount / 100,
              destination: p.destination,
              destinationType: p.type,
              status: p.status,
              created: p.created,
              arrivalDate: p.arrival_date
            }))
          }
        });
      }

      // ====== FORENSIC CHECK 6: CARD TESTING ATTACKS (SetupIntents) ======
      // Detect $0.00 or $1.00 authorizations used to test stolen cards
      const setupIntents = await fetchAllStripe(stripe.setupIntents, { created: { gte: sevenDaysAgo } }).catch(() => ({ data: [] }));
      const suspiciousSetupIntents = (setupIntents.data || []).filter((si: any) => {
        // Look for multiple setup intents from same customer or card
        return si.status === 'succeeded' && si.payment_method;
      });

      if (suspiciousSetupIntents.length > 10) {
        // Group by customer or payment method
        const groupedByCustomer: Record<string, number> = {};
        suspiciousSetupIntents.forEach((si: any) => {
          const key = si.customer || si.payment_method || 'unknown';
          groupedByCustomer[key] = (groupedByCustomer[key] || 0) + 1;
        });

        const highFrequencyCustomers = Object.entries(groupedByCustomer)
          .filter(([_, count]) => count > 5)
          .map(([customer, count]) => ({ customer, count }));

        if (highFrequencyCustomers.length > 0) {
          anomalies.push({
            type: "CARD_TESTING_ATTACK",
            severity: "high",
            message: `Potential card testing attack: ${highFrequencyCustomers.length} customers with >5 setup intents`,
            details: {
              totalSetupIntents: suspiciousSetupIntents.length,
              suspiciousCustomers: highFrequencyCustomers,
              samples: suspiciousSetupIntents.slice(0, 10).map((si: any) => ({
                setupIntentId: si.id,
                customer: si.customer,
                paymentMethod: si.payment_method,
                status: si.status,
                created: si.created
              }))
            }
          });
        }
      }

      // ====== FORENSIC CHECK 7: IP ADDRESS EXTRACTION FROM EVENTS ======
      // Extract IP addresses from account.updated and capability.updated events
      const accountUpdateEvents = (events.data || []).filter((e: any) =>
        e.type === 'account.updated' || e.type === 'capability.updated'
      );

      const forensicIpAddresses: Record<string, { count: number; events: any[]; userIds: Set<string>; adminApps: Set<string> }> = {};
      accountUpdateEvents.forEach((event: any) => {
        const ip = event.request?.ip_address || event.request?.ip || null;
        const userId = event.request?.user_id || null;
        const adminApp = event.request?.admin_app_name || null;

        if (ip) {
          if (!forensicIpAddresses[ip]) {
            forensicIpAddresses[ip] = { count: 0, events: [], userIds: new Set(), adminApps: new Set() };
          }
          forensicIpAddresses[ip].count++;
          if (userId) forensicIpAddresses[ip].userIds.add(userId);
          if (adminApp) forensicIpAddresses[ip].adminApps.add(adminApp);
          forensicIpAddresses[ip].events.push({
            eventId: event.id,
            eventType: event.type,
            userId,
            adminApp,
            timestamp: event.created,
            requestId: event.request?.id
          });
        }
      });

      const forensicKnownIPs = (Deno.env.get('AUTHORIZED_IP_ADDRESSES') || '').split(',').filter(Boolean);
      const forensicUnknownIPs = Object.entries(forensicIpAddresses).filter(([ip]) => forensicKnownIPs.length > 0 && !forensicKnownIPs.includes(ip));

      if (forensicUnknownIPs.length > 0) {
        anomalies.push({
          type: "UNAUTHORIZED_IP_ACCESS",
          severity: "critical",
          message: `${forensicUnknownIPs.length} unknown IP addresses made account changes!`,
          details: {
            unknownIPs: forensicUnknownIPs.map(([ip, data]) => ({
              ipAddress: ip,
              eventCount: data.count,
              events: data.events.slice(0, 5),
              userIds: Array.from(data.userIds),
              adminApps: Array.from(data.adminApps)
            })),
            knownIPs: forensicKnownIPs,
            note: "Set AUTHORIZED_IP_ADDRESSES env var with comma-separated IPs to whitelist"
          }
        });
      }

      // (Duplicate check removed - already handled above)

      // Calculate security score
      let securityScore = 100;
      anomalies.forEach(a => {
        if (a.severity === 'critical') securityScore -= 25;
        else if (a.severity === 'high') securityScore -= 15;
        else if (a.severity === 'medium') securityScore -= 10;
        else securityScore -= 5;
      });
      securityScore = Math.max(0, securityScore);

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
          account,
          issuing,
          treasury,
          terminal,
          cashBalances,
          disputes: disputes.data || [],
          anomalies,
          securityScore,
          period: { days, from: new Date(daysAgo * 1000).toISOString(), to: new Date().toISOString() }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== MONEY FLOW TRACKER (Simplified) ====================
    if (action === "money-flow") {
      console.log("[STRIPE-FORENSICS] Fetching money flow...");

      const [balance, payouts, charges, refunds, transfers, topups] = await Promise.all([
        stripe.balance.retrieve().catch(() => null),
        fetchAllStripe(stripe.payouts, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.charges, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.refunds, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.transfers, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        stripe.topups.list({ limit: 100, created: { gte: daysAgo } }).catch(() => ({ data: [] }))
      ]);

      // Try to fetch Issuing data
      let issuingCards: any[] = [];
      let issuingTransactions: any[] = [];
      try {
        const [cards, txns] = await Promise.all([
          stripe.issuing.cards.list({ limit: 100 }),
          stripe.issuing.transactions.list({ limit: 100, created: { gte: daysAgo } })
        ]);
        issuingCards = cards.data || [];
        issuingTransactions = txns.data || [];
      } catch (e) {
        console.log("[STRIPE-FORENSICS] Issuing not enabled");
      }

      const moneyFlow: MoneyFlowEvent[] = [];

      // Build flow (simplified version of complete-intelligence)
      (charges.data || []).forEach((charge: any) => {
        if (charge.status === 'succeeded') {
          moneyFlow.push({
            id: charge.id, type: 'inflow', category: 'payment',
            amount: charge.amount, currency: charge.currency,
            timestamp: charge.created,
            source: charge.billing_details?.email || 'customer',
            destination: 'stripe_balance',
            description: `Payment${charge.description ? ': ' + charge.description : ''}`,
            metadata: { cardLast4: charge.payment_method_details?.card?.last4 },
            status: charge.status
          });
        }
      });

      (payouts.data || []).forEach((payout: any) => {
        moneyFlow.push({
          id: payout.id, type: 'outflow',
          category: payout.method === 'instant' ? 'instant_payout' : 'payout',
          amount: payout.amount, currency: payout.currency,
          timestamp: payout.created,
          source: 'stripe_balance',
          destination: payout.destination || 'bank',
          description: `Payout to ${payout.type}`,
          metadata: { method: payout.method },
          status: payout.status,
          traceId: payout.trace_id?.value
        });
      });

      (refunds.data || []).forEach((refund: any) => {
        moneyFlow.push({
          id: refund.id, type: 'outflow', category: 'refund',
          amount: refund.amount, currency: refund.currency,
          timestamp: refund.created,
          source: 'stripe_balance', destination: 'customer',
          description: `Refund${refund.reason ? ': ' + refund.reason : ''}`,
          metadata: { chargeId: refund.charge },
          status: refund.status
        });
      });

      issuingTransactions.forEach((txn: any) => {
        moneyFlow.push({
          id: txn.id, type: 'outflow', category: 'card_spend',
          amount: Math.abs(txn.amount), currency: txn.currency,
          timestamp: txn.created,
          source: 'issued_card', destination: txn.merchant_data?.name || 'merchant',
          description: `Card: ${txn.merchant_data?.name}`,
          metadata: { merchantCategory: txn.merchant_data?.category },
          status: txn.type
        });
      });

      moneyFlow.sort((a, b) => b.timestamp - a.timestamp);

      const totalInflow = moneyFlow.filter(f => f.type === 'inflow').reduce((sum, f) => sum + f.amount, 0);
      const totalOutflow = moneyFlow.filter(f => f.type === 'outflow').reduce((sum, f) => sum + f.amount, 0);

      const flowByCategory: Record<string, { count: number; amount: number }> = {};
      moneyFlow.forEach(f => {
        if (!flowByCategory[f.category]) flowByCategory[f.category] = { count: 0, amount: 0 };
        flowByCategory[f.category].count++;
        flowByCategory[f.category].amount += f.amount;
      });

      const destinationAnalysis: Record<string, { count: number; amount: number; type: string }> = {};
      moneyFlow.filter(f => f.type === 'outflow').forEach(f => {
        const dest = String(f.destination).slice(0, 50);
        if (!destinationAnalysis[dest]) destinationAnalysis[dest] = { count: 0, amount: 0, type: f.category };
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
            enabled: issuingCards.length > 0,
            cards: issuingCards.map((c: any) => ({ id: c.id, last4: c.last4, status: c.status })),
            transactions: issuingTransactions.length,
            pendingAuthorizations: 0
          },
          period: { days, from: new Date(daysAgo * 1000).toISOString(), to: new Date().toISOString() }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== FULL AUDIT ====================
    if (action === "full-audit") {
      const [balance, payouts, balanceTransactions, payments, refunds, charges, transfers, events, webhookEndpoints, account, customers, disputes, setupIntents] = await Promise.all([
        stripe.balance.retrieve().catch(() => null),
        fetchAllStripe(stripe.payouts, { created: { gte: thirtyDaysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.balanceTransactions, { created: { gte: thirtyDaysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.paymentIntents, { created: { gte: thirtyDaysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.refunds, { created: { gte: thirtyDaysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.charges, { created: { gte: thirtyDaysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.transfers, { created: { gte: thirtyDaysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.events, { created: { gte: sevenDaysAgo } }).catch(() => ({ data: [] })),
        stripe.webhookEndpoints.list({ limit: 100 }).catch(() => ({ data: [] })),
        stripe.accounts.retrieve().catch(() => null),
        fetchAllStripe(stripe.customers, { created: { gte: sevenDaysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.disputes, {}).catch(() => ({ data: [] })),
        includeSetupIntents ? fetchAllStripe(stripe.setupIntents, { created: { gte: sevenDaysAgo } }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] })
      ]);

      const anomalies: AnomalyResult[] = [];

      // Extract IP addresses from events for this audit
      const accountUpdateEventsAudit = (events.data || []).filter((e: any) =>
        e.type === 'account.updated' || e.type === 'capability.updated'
      );
      const auditIpAddresses: Record<string, { count: number; events: any[]; userIds: Set<string>; adminApps: Set<string> }> = {};
      accountUpdateEventsAudit.forEach((event: any) => {
        const ip = event.request?.ip_address || event.request?.ip || null;
        const userId = event.request?.user_id || null;
        const adminApp = event.request?.admin_app_name || null;
        if (ip) {
          if (!auditIpAddresses[ip]) auditIpAddresses[ip] = { count: 0, events: [], userIds: new Set(), adminApps: new Set() };
          auditIpAddresses[ip].count++;
          if (userId) auditIpAddresses[ip].userIds.add(userId);
          if (adminApp) auditIpAddresses[ip].adminApps.add(adminApp);
          auditIpAddresses[ip].events.push({ eventId: event.id, eventType: event.type, userId, adminApp, timestamp: event.created });
        }
      });
      const auditKnownIPs = (Deno.env.get('AUTHORIZED_IP_ADDRESSES') || '').split(',').filter(Boolean);

      // Analyze for anomalies
      const totalRevenue = (payments.data || []).reduce((sum: number, p: any) => p.status === 'succeeded' ? sum + p.amount : sum, 0);
      const totalPayouts = (payouts.data || []).reduce((sum: number, p: any) => p.status === 'paid' ? sum + p.amount : sum, 0);

      if (totalRevenue > 0 && totalPayouts > totalRevenue * 0.8) {
        anomalies.push({ type: "HIGH_PAYOUT_RATIO", severity: "critical", message: "Payouts exceed 80% of revenue", details: { ratio: (totalPayouts / totalRevenue * 100).toFixed(1) + "%" } });
      }

      const instantPayouts = (payouts.data || []).filter((p: any) => p.method === 'instant');
      if (instantPayouts.length > 0) {
        anomalies.push({ type: "INSTANT_PAYOUTS", severity: "high", message: `${instantPayouts.length} Instant Payouts`, details: { totalAmount: instantPayouts.reduce((sum: number, p: any) => sum + p.amount, 0) / 100 } });
      }

      const openDisputes = (disputes.data || []).filter((d: any) => d.status === 'needs_response');
      if (openDisputes.length > 0) {
        anomalies.push({ type: "OPEN_DISPUTES", severity: "high", message: `${openDisputes.length} open disputes`, details: { disputes: openDisputes.slice(0, 5) } });
      }

      let securityScore = 100;
      anomalies.forEach(a => {
        if (a.severity === 'critical') securityScore -= 25;
        else if (a.severity === 'high') securityScore -= 15;
        else if (a.severity === 'medium') securityScore -= 10;
        else securityScore -= 5;
      });

      return new Response(
        JSON.stringify({
          balance, payouts: payouts.data, balanceTransactions: balanceTransactions.data,
          payments: payments.data, refunds: refunds.data, charges: charges.data,
          transfers: transfers.data, events: events.data, webhookEndpoints: webhookEndpoints.data,
          disputes: disputes.data, recentCustomers: customers.data, account,
          setupIntents: setupIntents.data || [],
          ipAddresses: Object.entries(auditIpAddresses).map(([ip, data]: [string, { count: number; events: any[]; userIds: Set<string>; adminApps: Set<string> }]) => ({
            ip,
            eventCount: data.count,
            userIds: Array.from(data.userIds),
            adminApps: Array.from(data.adminApps),
            isKnown: auditKnownIPs.includes(ip)
          })),
          anomalies, securityScore: Math.max(0, securityScore), auditTimestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "events-timeline") {
      const events = await stripe.events.list({ limit: 100, created: { gte: sevenDaysAgo } });
      return new Response(
        JSON.stringify({
          events: events.data,
          categorized: {
            payments: events.data.filter((e: any) => e.type.startsWith('payment_intent') || e.type.startsWith('charge')),
            payouts: events.data.filter((e: any) => e.type.startsWith('payout')),
            transfers: events.data.filter((e: any) => e.type.startsWith('transfer')),
            issuing: events.data.filter((e: any) => e.type.startsWith('issuing')),
            treasury: events.data.filter((e: any) => e.type.startsWith('treasury')),
            disputes: events.data.filter((e: any) => e.type.includes('dispute'))
          },
          total: events.data.length
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== DEEP LLM ANALYSIS ====================
    if (action === "deep-llm-analysis") {
      console.log("[STRIPE-FORENSICS] Running Deep LLM Analysis...");

      // Fetch comprehensive data
      const [
        balance,
        payouts,
        charges,
        refunds,
        transfers,
        account,
        disputes,
        events,
        customers
      ] = await Promise.all([
        stripe.balance.retrieve().catch(() => null),
        fetchAllStripe(stripe.payouts, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.charges, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.refunds, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        fetchAllStripe(stripe.transfers, { created: { gte: daysAgo } }).catch(() => ({ data: [] })),
        stripe.accounts.retrieve().catch(() => null),
        fetchAllStripe(stripe.disputes, {}).catch(() => ({ data: [] })),
        stripe.events.list({ limit: 100, created: { gte: sevenDaysAgo } }).catch(() => ({ data: [] })),
        stripe.customers.list({ limit: 50 }).catch(() => ({ data: [] }))
      ]);

      // Check Issuing
      let issuing = { enabled: false, cards: 0, transactions: 0, totalSpend: 0 };
      try {
        const [cards, txns] = await Promise.all([
          stripe.issuing.cards.list({ limit: 100 }),
          stripe.issuing.transactions.list({ limit: 100, created: { gte: daysAgo } })
        ]);
        issuing = {
          enabled: true,
          cards: cards.data.length,
          transactions: txns.data.length,
          totalSpend: txns.data.reduce((sum: number, t: any) => sum + Math.abs(t.amount), 0) / 100
        };
      } catch {}

      // Check Treasury
      let treasury = { enabled: false, accounts: 0, totalBalance: 0 };
      try {
        const fas = await stripe.treasury.financialAccounts.list({ limit: 100 });
        if (fas.data.length > 0) {
          treasury = {
            enabled: true,
            accounts: fas.data.length,
            totalBalance: fas.data.reduce((sum: number, fa: any) => 
              sum + (fa.balance?.cash?.usd || 0) + (fa.balance?.inbound_pending?.usd || 0), 0) / 100
          };
        }
      } catch {}

      // Calculate key metrics
      const totalPayments = (charges.data || [])
        .filter((c: any) => c.status === 'succeeded')
        .reduce((sum: number, c: any) => sum + c.amount, 0) / 100;
      const totalPayouts = (payouts.data || [])
        .reduce((sum: number, p: any) => sum + p.amount, 0) / 100;
      const totalRefunds = (refunds.data || [])
        .reduce((sum: number, r: any) => sum + r.amount, 0) / 100;
      const refundRate = totalPayments > 0 ? (totalRefunds / totalPayments * 100).toFixed(2) : 0;
      
      // Instant payout analysis
      const instantPayouts = (payouts.data || []).filter((p: any) => p.method === 'instant');
      const instantPayoutTotal = instantPayouts.reduce((sum: number, p: any) => sum + p.amount, 0) / 100;
      
      // Dispute analysis
      const openDisputes = (disputes.data || []).filter((d: any) => d.status === 'needs_response' || d.status === 'warning_needs_response');
      const totalDisputeAmount = (disputes.data || []).reduce((sum: number, d: any) => sum + (d.amount || 0), 0) / 100;

      // High-risk indicators
      const highRiskCharges = (charges.data || []).filter((c: any) => 
        c.outcome?.risk_level === 'highest' || c.outcome?.risk_level === 'elevated'
      );
      
      // Prepare context for LLM
      const analysisContext = {
        period: `Last ${days} days`,
        account: {
          id: account?.id,
          country: account?.country,
          payoutsEnabled: account?.payouts_enabled,
          chargesEnabled: account?.charges_enabled,
          requirements: account?.requirements?.currently_due?.length || 0,
          capabilities: account?.capabilities
        },
        balance: {
          available: balance?.available?.map((b: any) => ({ currency: b.currency, amount: b.amount / 100 })),
          pending: balance?.pending?.map((b: any) => ({ currency: b.currency, amount: b.amount / 100 }))
        },
        metrics: {
          totalPayments,
          totalPayouts,
          totalRefunds,
          refundRate: `${refundRate}%`,
          instantPayouts: { count: instantPayouts.length, total: instantPayoutTotal },
          disputes: { open: openDisputes.length, total: disputes.data?.length || 0, amount: totalDisputeAmount },
          highRiskCharges: highRiskCharges.length,
          customers: customers.data?.length || 0
        },
        issuing,
        treasury,
        recentEvents: {
          total: events.data?.length || 0,
          byType: (events.data || []).reduce((acc: any, e: any) => {
            const type = e.type.split('.')[0];
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {})
        },
        transfers: {
          count: transfers.data?.length || 0,
          total: (transfers.data || []).reduce((sum: number, t: any) => sum + t.amount, 0) / 100
        }
      };

      // Call Lovable AI for deep analysis
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      
      if (!LOVABLE_API_KEY) {
        console.log("[STRIPE-FORENSICS] No LOVABLE_API_KEY, returning data without LLM analysis");
        return new Response(
          JSON.stringify({
            analysisContext,
            llmAnalysis: null,
            message: "LLM analysis unavailable - LOVABLE_API_KEY not configured"
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[STRIPE-FORENSICS] Calling Lovable AI for deep analysis...");
      
      const llmResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are an expert Stripe forensic analyst and fraud investigator. Analyze the provided Stripe account data and provide a comprehensive security and financial health assessment.

Your analysis MUST include:
1. EXECUTIVE SUMMARY: One paragraph overview of account health
2. CRITICAL FINDINGS: Any immediate security concerns (fraud patterns, unauthorized access, suspicious activity)
3. FINANCIAL FLOW ANALYSIS: Money movement patterns, payout velocity, refund patterns
4. RISK INDICATORS: High-risk transactions, dispute patterns, unusual behavior
5. ISSUING/TREASURY ANALYSIS: If enabled, analyze card spend and treasury flows
6. RECOMMENDATIONS: Prioritized actions to improve security and efficiency
7. RISK SCORE: 0-100 (100 = perfect health)

Be specific and actionable. Flag anything that could indicate:
- Internal fraud (employee theft, unauthorized payouts)
- External fraud (card testing, chargebacks)
- Money laundering (structuring, rapid movement)
- Account takeover (unusual patterns)

Format your response as JSON with this structure:
{
  "executiveSummary": "string",
  "criticalFindings": ["array of findings"],
  "financialAnalysis": {
    "cashFlowHealth": "string",
    "payoutPattern": "string",
    "refundAnalysis": "string"
  },
  "riskIndicators": [
    { "type": "string", "severity": "critical|high|medium|low", "description": "string", "recommendation": "string" }
  ],
  "issuingTreasuryAnalysis": "string or null",
  "recommendations": [
    { "priority": 1-5, "action": "string", "impact": "string" }
  ],
  "riskScore": number,
  "overallAssessment": "healthy|warning|critical"
}`
            },
            {
              role: "user",
              content: `Analyze this Stripe account data:\n\n${JSON.stringify(analysisContext, null, 2)}`
            }
          ],
          max_tokens: 4000
        })
      });

      if (!llmResponse.ok) {
        const errorText = await llmResponse.text();
        console.error("[STRIPE-FORENSICS] LLM API error:", errorText);
        return new Response(
          JSON.stringify({
            analysisContext,
            llmAnalysis: null,
            error: `LLM analysis failed: ${llmResponse.status}`
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const llmData = await llmResponse.json();
      let llmAnalysis = null;
      
      try {
        const content = llmData.choices?.[0]?.message?.content || "";
        // Try to parse JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          llmAnalysis = JSON.parse(jsonMatch[0]);
        } else {
          llmAnalysis = { rawAnalysis: content };
        }
      } catch (e) {
        llmAnalysis = { rawAnalysis: llmData.choices?.[0]?.message?.content || "Analysis unavailable" };
      }

      console.log("[STRIPE-FORENSICS] Deep LLM analysis complete");

      return new Response(
        JSON.stringify({
          analysisContext,
          llmAnalysis,
          timestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error("Invalid action: " + action);
  } catch (error) {
    console.error("[STRIPE-FORENSICS] Error:", error);

    // End trace with error
    await traceEnd(traceRun, { error: error instanceof Error ? error.message : "Unknown error" }, error instanceof Error ? error.message : "Unknown error");

    // Log to sync_errors for Antigravity visibility
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase.from("sync_errors").insert({
        error_type: "forensics_error",
        source: "stripe-forensics",
        error_message: error instanceof Error ? error.message : "Unknown error",
        metadata: { stack: error instanceof Error ? error.stack : null }
      });
    } catch (logError) {
      console.error("Failed to log to sync_errors:", logError);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
// Force deploy Thu Dec 11 23:41:12 PST 2025
