# Stripe API Capabilities: A Complete Architecture Analysis

**Five interconnected Stripe APIs form a powerful financial infrastructure** enabling businesses to manage cash balances, issue cards, process terminal payments, execute payouts, and track inbound transfers with comprehensive audit trails. The 2025-11-17.preview API version introduces significant improvements including the v2 Money Management suite with `transfer_history` fields for complete state tracking.

---

## The complete money flow: How these five APIs connect

Understanding how these APIs interconnect reveals Stripe's underlying architecture for money movement. Here's the definitive relationship map:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL WORLD                                        │
│   [Bank Accounts]    [Debit Cards]    [Card Networks]    [Terminals]           │
└────────┬──────────────────┬────────────────┬─────────────────┬─────────────────┘
         │                  │                │                 │
         │ ACH Debit        │ Instant        │ Card            │ In-Person
         │                  │ Payout         │ Transactions    │ Payments
         ▼                  ▼                ▼                 ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                        STRIPE PLATFORM LAYER                                    │
│                                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐          │
│  │ INBOUND         │────►│ FINANCIAL       │────►│ PAYOUTS         │          │
│  │ TRANSFERS (v2)  │     │ ACCOUNT         │     │                 │          │
│  │                 │     │ (Treasury)      │     │ po_xxx          │          │
│  │ ibt_xxx         │     │ fa_xxx          │     └────────┬────────┘          │
│  │ transfer_history│     │                 │              │                    │
│  └─────────────────┘     │  ┌───────────┐  │              │                    │
│                          │  │ CARD      │  │              │                    │
│  ┌─────────────────┐     │  │ ISSUING   │◄─┼──────────────┘                    │
│  │ CASH BALANCE    │     │  │           │  │  Cards funded from               │
│  │                 │     │  │ ic_xxx    │  │  Financial Account               │
│  │ cus_xxx         │     │  └───────────┘  │                                   │
│  │ (per customer)  │     └─────────────────┘                                   │
│  │                 │                                                            │
│  │ reconciliation: │     ┌─────────────────┐                                   │
│  │ auto/manual     │     │ TERMINAL        │                                   │
│  └────────┬────────┘     │ CONFIGURATION   │                                   │
│           │              │                 │                                   │
│           │              │ tmc_xxx         │                                   │
│           │              │ reader_security │                                   │
│           ▼              └─────────────────┘                                   │
│  ┌─────────────────┐              │                                            │
│  │ PAYMENT         │◄─────────────┘                                            │
│  │ INTENTS         │   Terminal payments                                       │
│  │ pi_xxx          │   create PaymentIntents                                   │
│  └────────┬────────┘                                                           │
│           │                                                                     │
│           ▼                                                                     │
│  ┌─────────────────┐                                                           │
│  │ STRIPE BALANCE  │ ◄─── All successful payments flow here                    │
│  │                 │ ───► Payouts draw from here                               │
│  └─────────────────┘                                                           │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Critical interconnection patterns

**Cash Balance → Payouts**: Cash Balance funds cannot directly create Payouts. The flow requires: Customer Cash Balance → Applied to PaymentIntent → Stripe Balance → Payout. Cash balance is customer-specific, while payouts draw from the merchant's Stripe balance.

**Financial Account ↔ Card Issuing**: Cards created with the `financial_account` parameter draw directly from that account's balance. When authorization requests arrive (`issuing_authorization.request`), Stripe checks the Financial Account balance rather than the main Stripe balance.

**Inbound Transfers → Financial Accounts → Payouts**: The cleanest money flow uses Treasury: Inbound Transfer credits a Financial Account, which can then fund issued cards or be converted to outbound transfers. For standard payouts, funds must move to the main Stripe balance first.

**Terminal → PaymentIntents → Balance**: Terminal configurations define how payments are collected, but the actual funds flow through PaymentIntents to the Stripe balance, from which payouts are made.

---

## Cash Balance API: Customer-level prepaid funds

The Cash Balance API manages real funds customers send via bank transfer before allocation to payments. This is distinct from invoice credits—cash balance represents actual money in transit.

### Configuration parameters

| Parameter | Values | Impact |
|-----------|--------|--------|
| `settings.reconciliation_mode` | `automatic` | Stripe auto-matches funds to open PaymentIntents/Invoices |
| | `manual` | Funds held until explicitly applied via API |
| | `merchant_default` | Inherit account-level setting |

### Available data tracking

The system tracks every balance change through **Cash Balance Transactions** (`ccsbtxn_xxx`):

- **Funded transactions**: Include `bank_transfer.sender_name`, `iban_last4`, `bic`, `reference`
- **Applied/refunded**: Link to specific PaymentIntent or Refund IDs
- **Balance snapshots**: `ending_balance` after each transaction
- **Multi-currency**: Separate balances per currency tracked independently

### Audit capabilities

Cash Balance provides **transactional audit trails** but **no user attribution** for API actions. The `customer_cash_balance_transaction.created` webhook fires for every balance change, including:

```json
{
  "type": "funded",
  "net_amount": 5000,
  "ending_balance": 15000,
  "funded": {
    "bank_transfer": {
      "sender_name": "Acme Corp",
      "reference": "INV-2024-001"
    }
  }
}
```

For "who made the API call" tracking, you must use Stripe Dashboard → Developers → Logs or implement application-level logging.

**Key limitation**: The Cash Balance object itself does **not support custom metadata**. Store tracking data on the related Customer or PaymentIntent objects instead.

---

## Treasury Financial Account Features: Enterprise fund management

Financial Accounts represent the core of Stripe Treasury, enabling platforms to provide banking-like services to connected accounts. The **features API** controls which capabilities are active.

### Complete feature matrix

| Feature | Capability Required | Activation Time |
|---------|---------------------|-----------------|
| `card_issuing` | `card_issuing` | **Instant** |
| `deposit_insurance` | `treasury` | Varies |
| `financial_addresses.aba` | `treasury` | Up to 30 minutes |
| `inbound_transfers.ach` | `treasury`, `us_bank_account_ach_payments` | Varies |
| `intra_stripe_flows` | `treasury` | Varies |
| `outbound_payments.ach` | `treasury`, `us_bank_account_ach_payments` | Varies |
| `outbound_payments.us_domestic_wire` | `treasury` | Varies |
| `outbound_transfers.ach` | `treasury`, `us_bank_account_ach_payments` | Varies |

### Feature status tracking

Each feature has a status lifecycle with detailed tracking:

```javascript
// Feature status structure
{
  "card_issuing": {
    "requested": true,
    "status": "active",  // active | pending | restricted
    "status_details": [] // Empty when active
  },
  "financial_addresses": {
    "aba": {
      "status": "pending",
      "status_details": [{ "code": "activating" }]
    }
  }
}
```

**Status detail codes** reveal why features aren't active:
- `activating` - Stripe is processing activation
- `requirements_past_due` - Connected account needs to fulfill requirements
- `rejected_unsupported_business` - Business type not supported
- `restricted_by_platform` - Platform applied `platform_restrictions`

### Card issuing integration

Cards linked to Financial Accounts use the FA balance directly:

```javascript
const card = await stripe.issuing.cards.create({
  cardholder: 'ich_xxxx',
  financial_account: 'fa_xxxx',  // Direct balance link
  currency: 'usd',
  type: 'virtual',
  status: 'active'
}, { stripeAccount: 'acct_connected' });
```

**Critical webhook**: `issuing_authorization.request` is synchronous—you must respond within 2 seconds to approve/decline. The authorization checks the linked Financial Account balance automatically.

---

## Terminal Configuration: Fleet-wide reader management

Terminal configurations (`tmc_xxx`) control all aspects of physical reader behavior, from tipping options to WiFi credentials and security settings.

### Complete configuration schema

```javascript
{
  // Device-specific splash screens
  "stripe_s700": { "splashscreen": "file_xxx" },
  "bbpos_wisepos_e": { "splashscreen": "file_xxx" },
  "verifone_p400": { "splashscreen": "file_xxx" },
  
  // Tipping (22 currencies supported)
  "tipping": {
    "usd": {
      "percentages": [15, 18, 20],
      "fixed_amounts": [100, 200, 500],  // In cents
      "smart_tip_threshold": 1000        // Below: fixed; Above: percentages
    }
  },
  
  // Security settings
  "reader_security": {
    "admin_menu_passcode": "1234"  // Restricts admin access
  },
  
  // Offline mode
  "offline": { "enabled": true },
  
  // Maintenance window
  "reboot_window": {
    "start_hour": 3,
    "end_hour": 5
  },
  
  // WiFi (three security types)
  "wifi": {
    "type": "enterprise_eap_peap",
    "enterprise_eap_peap": {
      "ssid": "CorpNetwork",
      "username": "terminal@company.com",
      "password": "secure_password",
      "ca_certificate_file": "file_xxx"  // Optional
    }
  }
}
```

### Configuration hierarchy

1. **Account Default** (`is_account_default: true`) - Applies fleet-wide
2. **Location Override** - Set via `terminal/locations/:id` with `configuration_overrides`

**Propagation time**: Configuration changes take **up to 10 minutes** to reach readers.

### Audit gap in Terminal

**Important finding**: Stripe does **not emit webhook events** for Terminal configuration changes. There are no `terminal.configuration.created` or `terminal.configuration.updated` events. You must implement application-level audit logging:

```javascript
async function updateTerminalConfig(configId, updates, userId) {
  const previous = await stripe.terminal.configurations.retrieve(configId);
  const updated = await stripe.terminal.configurations.update(configId, updates);
  
  await auditLog.create({
    action: 'terminal.configuration.updated',
    configId,
    previousState: previous,
    newState: updated,
    changedBy: userId,
    timestamp: new Date()
  });
  
  return updated;
}
```

---

## Payouts API: Balance-to-bank fund movement

Payouts move funds from your Stripe balance to external bank accounts or debit cards. The API offers both standard (T+2) and instant (30 minutes) options.

### Create parameters with full options

| Parameter | Type | Description |
|-----------|------|-------------|
| `amount` | integer | **Required**. In minor units (cents) |
| `currency` | string | **Required**. ISO 4217 lowercase |
| `destination` | string | External account ID (`ba_xxx` or `card_xxx`) |
| `method` | enum | `standard` (default) or `instant` |
| `source_type` | enum | `bank_account`, `card`, or `fpx` |
| `statement_descriptor` | string | Max 22 characters on bank statement |
| `metadata` | hash | Custom key-value pairs |

### Payout status lifecycle

```
pending → in_transit → paid
                    → failed (within 5 business days)
                    → canceled (manual payouts only)
```

The **critical nuance**: Some payouts initially show `paid` then change to `failed` within 5 business days. Always listen for `payout.failed` webhooks even after receiving `payout.paid`.

### Historical data access

```bash
# Filter by date range
curl -G https://api.stripe.com/v1/payouts \
  -d "arrival_date[gte]=1704067200" \
  -d "arrival_date[lte]=1706745600" \
  -d "status=paid"
```

Available filters: `arrival_date`, `created`, `destination`, `status`

### Trace ID for bank tracking

Every payout includes a `trace_id` for tracking with banks:

```json
{
  "trace_id": {
    "status": "supported",
    "value": "7UF6L35ME6bh..."
  }
}
```

This value can be provided to customers or banks to locate missing payouts.

---

## Inbound Transfers v2: The new money management standard

The v2 Inbound Transfers API represents Stripe's next-generation architecture with **comprehensive transfer_history tracking**—the most detailed audit trail available across these five APIs.

### The transfer_history advantage

Unlike other APIs, v2 Inbound Transfers provide a complete, immutable history of every state change:

```json
{
  "transfer_history": [
    {
      "id": "ibthe_test_61Q58Xw5...",
      "type": "bank_debit_queued",
      "created": "2024-03-18T18:07:12.617Z",
      "effective_at": "2024-03-18T18:07:12.617Z",
      "level": "canonical"
    },
    {
      "id": "ibthe_test_61Q58Y2i...",
      "type": "bank_debit_processing",
      "created": "2024-03-18T18:07:18.403Z",
      "effective_at": "2024-03-18T18:07:18.403Z",
      "level": "canonical"
    },
    {
      "id": "ibthe_test_61Q58Y7w...",
      "type": "bank_debit_succeeded",
      "created": "2024-03-18T18:07:23.103Z",
      "effective_at": "2024-03-18T18:07:23.103Z",
      "level": "canonical"
    }
  ]
}
```

**History entry types**: `bank_debit_queued` → `bank_debit_processing` → `bank_debit_succeeded` | `bank_debit_failed` | `bank_debit_returned`

### V2 vs V1 structural differences

| Aspect | V1 (Treasury) | V2 (Money Management) |
|--------|---------------|----------------------|
| Amount | `amount: 1000` | `amount: { value: 1000, currency: "usd" }` |
| Timestamps | Unix epoch | RFC 3339 with milliseconds |
| Tracking | `status_transitions` hash | Full `transfer_history` array |
| Events | Snapshot events | **Thin events** (ID only, fetch current state) |

### V2 list filtering with RFC 3339 timestamps

```bash
curl "https://api.stripe.com/v2/money_management/inbound_transfers?created_gte=2024-01-01T00:00:00Z&limit=10" \
  -H "Authorization: Bearer sk_test_..."
```

---

## "Who did what" tracking: The complete picture

Each API provides different levels of audit capability:

| API | Transaction History | User Attribution | Webhook Events | Custom Metadata |
|-----|---------------------|------------------|----------------|-----------------|
| Cash Balance | ✅ Full via transactions | ❌ None | ✅ 2 events | ❌ Not on CB object |
| Treasury Features | ✅ Feature status tracking | ❌ None | ✅ Feature updates | ✅ On Financial Account |
| Terminal Config | ❌ No built-in history | ❌ None | ❌ No config events | ❌ Not supported |
| Payouts | ✅ Balance transactions | ⚠️ Via metadata | ✅ 5 events | ✅ Supported |
| Inbound Transfers v2 | ✅✅ transfer_history | ⚠️ Via metadata | ✅ Thin events | ✅ Supported |

**Best practice for compliance**: Implement application-level audit logging that captures API key ID, user context, timestamp, and before/after states. The Stripe Dashboard's Developers → Logs section provides 30-day API request history including which API key made each call.

---

## Building a complete financial dashboard

To build a comprehensive dashboard monitoring all five systems:

### Required webhook subscriptions

```javascript
// Configure these 15+ events
const requiredEvents = [
  // Cash Balance
  'cash_balance.funds_available',
  'customer_cash_balance_transaction.created',
  
  // Treasury/Card Issuing
  'treasury.financial_account.features_status_updated',
  'issuing_authorization.request',
  'issuing_transaction.created',
  
  // Payouts
  'payout.created',
  'payout.paid',
  'payout.failed',
  'payout.canceled',
  
  // Terminal
  'terminal.reader.action_succeeded',
  'terminal.reader.action_failed',
  
  // V2 Money Management (thin events)
  'v2.money_management.inbound_transfer.funds_available'
];
```

### Data aggregation pattern

```javascript
async function buildFinancialDashboard(accountId) {
  const [
    balance,
    payouts,
    financialAccounts,
    terminalConfigs,
    inboundTransfers
  ] = await Promise.all([
    stripe.balance.retrieve(),
    stripe.payouts.list({ limit: 100 }),
    stripe.treasury.financialAccounts.list({}, { stripeAccount: accountId }),
    stripe.terminal.configurations.list({ limit: 100 }),
    fetchV2InboundTransfers(accountId)  // Use v2 endpoint
  ]);
  
  return {
    availableBalance: balance.available,
    pendingBalance: balance.pending,
    recentPayouts: payouts.data,
    financialAccountBalances: financialAccounts.data.map(fa => ({
      id: fa.id,
      balance: fa.balance,
      activeFeatures: fa.active_features
    })),
    terminalConfigCount: terminalConfigs.data.length,
    inboundTransferHistory: inboundTransfers.map(t => t.transfer_history)
  };
}
```

---

## 2025-11-17.preview API considerations

The preview API version introduces several important changes:

**Money Management v2**: The `transfer_history` field and thin events are preview features. When using preview:

```bash
curl https://api.stripe.com/v2/money_management/inbound_transfers \
  -H "Authorization: Bearer sk_test_..." \
  -H "Stripe-Version: 2025-11-17.preview"
```

**Treasury compatibility**: The Accounts v2 API does **not** support Financial Accounts and Issuing workflows. Continue using Accounts v1 for `treasury` and `card_issuing` capabilities.

**SDK access**: Use SDK versions with `beta` or `b` suffix for preview features.

---

## Limitations and constraints summary

| API | Key Limitations |
|-----|-----------------|
| **Cash Balance** | No metadata on CB object; cannot delete customers with balance; no direct payout creation |
| **Treasury Features** | Max 3 Financial Accounts per connected account; feature activation varies (instant to 30 min) |
| **Terminal** | No configuration webhooks; 10-minute propagation delay; zone configs in private preview |
| **Payouts** | Cannot cancel automatic payouts; instant payout limits (10/day); 5-day failure window |
| **Inbound Transfers v2** | Preview API subject to changes; ACH-only (no wire); US bank accounts only |

---

## Conclusion: Integration architecture recommendations

Three patterns emerge for connecting these five APIs effectively:

**For marketplace platforms**: Use Treasury Financial Accounts as the hub. Connect Inbound Transfers to fund accounts, enable Card Issuing for spend management, and use the v2 API's `transfer_history` for complete audit trails.

**For SaaS businesses with customer prepayments**: Cash Balance with automatic reconciliation eliminates manual payment matching. The `customer_cash_balance_transaction.created` webhook provides real-time balance updates without polling.

**For retail with physical presence**: Terminal configurations should be managed hierarchically—account defaults for common settings, location overrides for specific needs. Implement application-level audit logging since Stripe doesn't provide configuration change webhooks.

The v2 Money Management APIs represent Stripe's architectural direction: standardized amount objects, RFC 3339 timestamps, thin events, and comprehensive history tracking. New integrations should prefer v2 endpoints where available while maintaining v1 compatibility for features not yet migrated.
