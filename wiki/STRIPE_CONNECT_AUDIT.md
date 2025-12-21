# Stripe Connect Embedded Components - In-House Audit

## Summary: What You Have vs What's Needed

### ✅ What You HAVE Built

#### 1. Account Event Tracking (Webhook Handler)
**Location**: `supabase/functions/stripe-webhook/index.ts`
- `handleAccountEvent()` - Tracks account updates
- Stores account data in `stripe_accounts` table
- Tracks: `charges_enabled`, `payouts_enabled`, `details_submitted`, `requirements`
- **Purpose**: Fraud detection and monitoring

#### 2. Connected Account Detection (Forensics)
**Location**: `supabase/functions/stripe-forensics/index.ts`
- Detects transfers TO connected accounts (`transfer_data.destination`)
- Detects application fees (`application_fee_amount`)
- Flags money routing to connected accounts as potential fraud
- **Purpose**: Security audit, not account management

#### 3. Account Audit Script
**Location**: `scripts/stripe_detective.ts`
- Checks for connected accounts using `stripe.accounts.list()`
- Lists accounts you control
- **Purpose**: Security audit, not account creation

#### 4. Account Person Tracking
**Location**: `supabase/functions/stripe-webhook/index.ts`
- `handleAccountPersonEvent()` - Tracks account persons
- Stores in `stripe_account_persons` table
- **Purpose**: Compliance tracking

### ❌ What You HAVE NOT Built

#### 1. Account Creation Function
**Missing**: No function to create connected accounts
- No `stripe.accounts.create()` with `controller.stripe_dashboard.type = 'none'`
- No account prefilling logic
- No capability requesting

#### 2. Account Sessions API
**Missing**: No Account Session creation
- No `stripe.accountSessions.create()` function
- No embedded component access tokens
- No component configuration (onboarding, management, etc.)

#### 3. Frontend Embedded Components
**Missing**: No ConnectJS integration
- No `@stripe/connect-js` package installed
- No `@stripe/react-connect-js` package installed
- No embedded component rendering:
  - ❌ Account Onboarding component
  - ❌ Account Management component
  - ❌ Notification Banner component
  - ❌ Payments component
  - ❌ Payouts component
  - ❌ Documents component

#### 4. Direct Charges Integration
**Missing**: No direct charge functionality
- No `Stripe-Account` header usage
- No `application_fee_amount` in PaymentIntents
- No Checkout Sessions for connected accounts

#### 5. Email Configuration
**Missing**: No embedded component URLs configured
- No URLs set in Stripe Dashboard for embedded components
- No email redirect handling

## Current Architecture

### What You're Using Now
```
Your Platform → Single Stripe Account → Direct API Calls
```

### What Connect Embedded Would Be
```
Your Platform → Multiple Connected Accounts → Embedded Components
                ↓
         Account Sessions API
                ↓
         ConnectJS Components
```

## Key Differences

| Feature | Current (Single Account) | Connect Embedded (Platform) |
|---------|-------------------------|----------------------------|
| **Account Creation** | Manual in Dashboard | API: `stripe.accounts.create()` |
| **Onboarding** | Stripe Dashboard | Embedded component in your UI |
| **Account Management** | Stripe Dashboard | Embedded component in your UI |
| **Payments** | Direct charges | Direct charges with `Stripe-Account` header |
| **Fees** | None | Application fees per transaction |
| **Risk Management** | You handle | Stripe handles for connected accounts |
| **Compliance** | You handle | Stripe handles, embedded components show requirements |

## Code Evidence

### ✅ Existing (Monitoring Only)
```typescript
// supabase/functions/stripe-webhook/index.ts:673
async function handleAccountEvent(supabase: any, event: StripeEvent) {
  // Tracks account updates - NOT creating accounts
  await supabase.from("stripe_accounts").upsert({...});
}

// supabase/functions/stripe-forensics/index.ts:780
// Detects transfers TO connected accounts (fraud detection)
const chargesWithTransfer = charges.data.filter(
  c => c.transfer_data?.destination
);
```

### ❌ Missing (Would Need to Build)
```typescript
// MISSING: Account creation
const account = await stripe.accounts.create({
  country: 'AE',
  controller: { stripe_dashboard: { type: 'none' } },
  capabilities: { card_payments: { requested: true } }
});

// MISSING: Account Session creation
const session = await stripe.accountSessions.create({
  account: 'acct_xxx',
  components: {
    account_onboarding: { enabled: true }
  }
});

// MISSING: Frontend ConnectJS
import { ConnectAccountOnboarding } from '@stripe/react-connect-js';
```

## Conclusion

**You have NOT built Stripe Connect embedded components.**

What you have:
- ✅ Account monitoring/auditing (for security)
- ✅ Detection of transfers to connected accounts (fraud detection)
- ✅ Account event tracking (compliance)

What you're missing:
- ❌ Account creation API
- ❌ Account Sessions API
- ❌ Frontend embedded components
- ❌ Direct charges integration
- ❌ Email/URL configuration

## Next Steps (If You Want to Build This)

1. **Decide if you need it**: Are you building a marketplace/platform?
2. **If yes**: This is a major new feature (2-3 weeks)
3. **If no**: Your current single-account setup is correct

## Recommendation

Based on your codebase, you appear to be:
- **Single business** using Stripe for payments
- **Not a marketplace** onboarding multiple sellers
- **Focused on forensics** and security monitoring

**You likely DON'T need Connect embedded components** unless you're planning to:
- Onboard multiple sellers/merchants
- Take fees from their transactions
- Provide them with payment processing

If you're just monitoring your own Stripe account for security, your current setup is appropriate.


