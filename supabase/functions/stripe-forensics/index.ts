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

  // Get IP address from request headers (for IP restriction detection)
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                   req.headers.get("x-real-ip") || 
                   "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

    if (!STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" });
    
    let body: any = {};
    try {
      const bodyText = await req.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch (e) {
      console.log("[STRIPE-FORENSICS] Error parsing body:", e);
    }
    
    const action = body?.action;
    const days = body?.days ? Number(body.days) : 30;

    console.log(`[STRIPE-FORENSICS] Action: ${action}, Days: ${days}, Client IP: ${clientIP}, User-Agent: ${userAgent}`);

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Action is required. Available actions: account-verification, full-audit, complete-intelligence, money-flow, events-timeline" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate timestamps (only if needed)
    const now = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
    const daysAgo = action !== "account-verification" ? now - (days * 24 * 60 * 60) : undefined;

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
      let cashBalances: any[] = [];
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
        // Group by destination
        const destinationGroups: Record<string, { count: number; amount: number }> = {};
        chargesWithTransfer.forEach((c: any) => {
          const dest = c.transfer_data.destination;
          if (!destinationGroups[dest]) destinationGroups[dest] = { count: 0, amount: 0 };
          destinationGroups[dest].count++;
          destinationGroups[dest].amount += (c.transfer_data?.amount || c.amount);
        });

        anomalies.push({
          type: "TRANSFER_MONEY_REDIRECT",
          severity: "high",
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
      const [balance, payouts, balanceTransactions, payments, refunds, charges, transfers, events, webhookEndpoints, account, customers, disputes] = await Promise.all([
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
        fetchAllStripe(stripe.disputes, {}).catch(() => ({ data: [] }))
      ]);

      const anomalies: AnomalyResult[] = [];

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
          anomalies, securityScore: Math.max(0, securityScore), auditTimestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "account-verification") {
      console.log("[STRIPE-FORENSICS] Fetching Account Verification & Person Data...");
      
      let account: any = null;
      let persons: any[] = [];
      let accountRequirements: any = null;
      
      try {
        // Try to retrieve account (works for both standard and Connect accounts)
        account = await stripe.accounts.retrieve();
      } catch (e: any) {
        const errorMessage = e.message || String(e);
        const errorType = e.type || 'unknown';
        const errorCode = e.code || 'unknown';
        
        console.log(`[STRIPE-FORENSICS] Error retrieving account: ${errorMessage} (Type: ${errorType}, Code: ${errorCode})`);
        console.log(`[STRIPE-FORENSICS] Client IP: ${clientIP}`);
        
        // Check for IP restriction errors
        if (errorMessage.includes('IP') || errorMessage.includes('ip') || errorMessage.includes('restricted') || errorMessage.includes('blocked') || errorCode === 'ip_address_rejected') {
          return new Response(
            JSON.stringify({
              success: false,
              error: "IP_ADDRESS_RESTRICTED",
              message: `Stripe API call blocked by IP restriction. Your IP address (${clientIP}) is not allowed.`,
              details: {
                client_ip: clientIP,
                error_code: errorCode,
                error_type: errorType,
                error_message: errorMessage,
                solution: "Add this IP address to Stripe's IP allowlist in Dashboard > Settings > API > IP Allowlist",
                stripe_dashboard_url: "https://dashboard.stripe.com/settings/security",
              },
              request_info: {
                client_ip: clientIP,
                user_agent: userAgent,
                timestamp: new Date().toISOString(),
              },
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // For standard accounts, try retrieving without ID
        try {
          account = await stripe.accounts.retrieve({});
        } catch (e2: any) {
          const errorMessage2 = e2.message || String(e2);
          const errorType2 = e2.type || 'unknown';
          const errorCode2 = e2.code || 'unknown';
          
          console.log(`[STRIPE-FORENSICS] Alternative account retrieval failed: ${errorMessage2} (Type: ${errorType2}, Code: ${errorCode2})`);
          
          // Check for IP restriction in second attempt
          if (errorMessage2.includes('IP') || errorMessage2.includes('ip') || errorMessage2.includes('restricted') || errorMessage2.includes('blocked') || errorCode2 === 'ip_address_rejected') {
            return new Response(
              JSON.stringify({
                success: false,
                error: "IP_ADDRESS_RESTRICTED",
                message: `Stripe API call blocked by IP restriction. Your IP address (${clientIP}) is not allowed.`,
                details: {
                  client_ip: clientIP,
                  error_code: errorCode2,
                  error_type: errorType2,
                  error_message: errorMessage2,
                  solution: "Add this IP address to Stripe's IP allowlist in Dashboard > Settings > API > IP Allowlist",
                  stripe_dashboard_url: "https://dashboard.stripe.com/settings/security",
                },
                request_info: {
                  client_ip: clientIP,
                  user_agent: userAgent,
                  timestamp: new Date().toISOString(),
                },
              }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
      
      if (account) {
        // Get account requirements
        accountRequirements = {
          currently_due: account.requirements?.currently_due || [],
          past_due: account.requirements?.past_due || [],
          eventually_due: account.requirements?.eventually_due || [],
          disabled_reason: account.requirements?.disabled_reason,
          verification: account.verification,
          details_submitted: account.details_submitted,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
        };
        
        // Safe date conversion helper
        const safeDate = (timestamp: number | undefined | null): string | null => {
          if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) return null;
          try {
            return new Date(timestamp * 1000).toISOString();
          } catch (e) {
            console.log("[STRIPE-FORENSICS] Date conversion error:", e, "timestamp:", timestamp);
            return null;
          }
        };

        // Get all persons associated with the account
        try {
          const personsList = await stripe.accounts.listPersons(account.id, { limit: 100 });
          persons = personsList.data.map((p: any) => ({
            id: p.id,
            email: p.email,
            first_name: p.first_name,
            last_name: p.last_name,
            relationship: p.relationship,
            verification: {
              status: p.verification?.status,
              document: {
                front: p.verification?.document?.front ? "Uploaded" : "Missing",
                back: p.verification?.document?.back ? "Uploaded" : "Missing",
              },
              additional_document: p.verification?.additional_document,
            },
            created: safeDate(p.created),
            dob: p.dob,
            address: p.address,
            phone: p.phone,
            metadata: p.metadata,
          }));
        } catch (e: any) {
          const errorMessage = e.message || String(e);
          const errorCode = e.code || 'unknown';
          
          console.log(`[STRIPE-FORENSICS] Error fetching persons with account ID: ${errorMessage} (Code: ${errorCode})`);
          console.log(`[STRIPE-FORENSICS] Client IP: ${clientIP}`);
          
          // Check for IP restriction
          if (errorMessage.includes('IP') || errorMessage.includes('ip') || errorMessage.includes('restricted') || errorMessage.includes('blocked') || errorCode === 'ip_address_rejected') {
            return new Response(
              JSON.stringify({
                success: false,
                error: "IP_ADDRESS_RESTRICTED",
                message: `Stripe API call blocked by IP restriction. Your IP address (${clientIP}) is not allowed.`,
                details: {
                  client_ip: clientIP,
                  error_code: errorCode,
                  error_message: errorMessage,
                  solution: "Add this IP address to Stripe's IP allowlist in Dashboard > Settings > API > IP Allowlist",
                  stripe_dashboard_url: "https://dashboard.stripe.com/settings/security",
                },
                request_info: {
                  client_ip: clientIP,
                  user_agent: userAgent,
                  timestamp: new Date().toISOString(),
                },
              }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          // For standard accounts, try without account ID
          try {
            const personsList = await stripe.accounts.listPersons({ limit: 100 });
            persons = personsList.data.map((p: any) => ({
              id: p.id,
              email: p.email,
              first_name: p.first_name,
              last_name: p.last_name,
              relationship: p.relationship,
              verification: {
                status: p.verification?.status,
                document: {
                  front: p.verification?.document?.front ? "Uploaded" : "Missing",
                  back: p.verification?.document?.back ? "Uploaded" : "Missing",
                },
              },
              created: safeDate(p.created),
            }));
          } catch (e2: any) {
            const errorMessage2 = e2.message || String(e2);
            const errorCode2 = e2.code || 'unknown';
            
            console.log(`[STRIPE-FORENSICS] Alternative persons fetch failed: ${errorMessage2} (Code: ${errorCode2})`);
            
            // Check for IP restriction in second attempt
            if (errorMessage2.includes('IP') || errorMessage2.includes('ip') || errorMessage2.includes('restricted') || errorMessage2.includes('blocked') || errorCode2 === 'ip_address_rejected') {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: "IP_ADDRESS_RESTRICTED",
                  message: `Stripe API call blocked by IP restriction. Your IP address (${clientIP}) is not allowed.`,
                  details: {
                    client_ip: clientIP,
                    error_code: errorCode2,
                    error_message: errorMessage2,
                    solution: "Add this IP address to Stripe's IP allowlist in Dashboard > Settings > API > IP Allowlist",
                    stripe_dashboard_url: "https://dashboard.stripe.com/settings/security",
                  },
                  request_info: {
                    client_ip: clientIP,
                    user_agent: userAgent,
                    timestamp: new Date().toISOString(),
                  },
                }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
      }
      
      // Safe date conversion helper
      const safeDate = (timestamp: number | undefined | null): string | null => {
        if (!timestamp || typeof timestamp !== 'number' || isNaN(timestamp)) return null;
        try {
          return new Date(timestamp * 1000).toISOString();
        } catch (e) {
          console.log("[STRIPE-FORENSICS] Date conversion error:", e, "timestamp:", timestamp);
          return null;
        }
      };

      return new Response(
        JSON.stringify({
          success: true,
          account: account ? {
            id: account.id,
            type: account.type,
            country: account.country,
            email: account.email,
            business_type: account.business_type,
            created: safeDate(account.created),
          } : null,
          account_requirements: accountRequirements,
          verified_persons: persons,
          summary: {
            total_persons: persons.length,
            verified_count: persons.filter((p: any) => p.verification?.status === "verified").length,
            pending_verification: persons.filter((p: any) => p.verification?.status === "pending").length,
            unverified_count: persons.filter((p: any) => p.verification?.status === "unverified").length,
          },
          request_info: {
            client_ip: clientIP,
            user_agent: userAgent,
            timestamp: new Date().toISOString(),
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    throw new Error("Invalid action: " + action);
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const errorType = error?.type || 'unknown';
    const errorCode = error?.code || 'unknown';
    
    console.error(`[STRIPE-FORENSICS] Error: ${errorMessage} (Type: ${errorType}, Code: ${errorCode})`);
    console.error(`[STRIPE-FORENSICS] Client IP: ${clientIP}, User-Agent: ${userAgent}`);
    console.error(`[STRIPE-FORENSICS] Stack:`, error?.stack);
    
    // Check for IP restriction errors
    if (errorMessage.includes('IP') || errorMessage.includes('ip') || errorMessage.includes('restricted') || errorMessage.includes('blocked') || errorCode === 'ip_address_rejected') {
      return new Response(
        JSON.stringify({
          success: false,
          error: "IP_ADDRESS_RESTRICTED",
          message: `Stripe API call blocked by IP restriction. Your IP address (${clientIP}) is not allowed.`,
          details: {
            client_ip: clientIP,
            error_code: errorCode,
            error_type: errorType,
            error_message: errorMessage,
            solution: "Add this IP address to Stripe's IP allowlist in Dashboard > Settings > API > IP Allowlist",
            stripe_dashboard_url: "https://dashboard.stripe.com/settings/security",
            how_to_add_ip: [
              "1. Go to Stripe Dashboard > Settings > API",
              "2. Scroll to 'IP Allowlist' section",
              `3. Click 'Add IP' and enter: ${clientIP}`,
              "4. Save changes",
              "5. Wait 1-2 minutes for changes to propagate",
            ],
          },
          request_info: {
            client_ip: clientIP,
            user_agent: userAgent,
            timestamp: new Date().toISOString(),
          },
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: "STRIPE_API_ERROR",
        message: errorMessage,
        details: {
          error_code: errorCode,
          error_type: errorType,
          client_ip: clientIP,
        },
        request_info: {
          client_ip: clientIP,
          user_agent: userAgent,
          timestamp: new Date().toISOString(),
        },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
// Force deploy Thu Dec 11 23:41:12 PST 2025
