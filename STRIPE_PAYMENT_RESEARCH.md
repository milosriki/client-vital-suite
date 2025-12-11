# Stripe Payment Integration Research

## Table of Contents
1. [React Stripe.js Library](#react-stripejs-library)
2. [Stripe Issuing API](#stripe-issuing-api)
3. [Stripe Connect Platform](#stripe-connect-platform)
4. [Payment Elements & Checkout](#payment-elements--checkout)
5. [Redirect Flows](#redirect-flows)
6. [Implementation Recommendations](#implementation-recommendations)

---

## React Stripe.js Library

### Overview
`@stripe/react-stripe-js` is Stripe's official React library that wraps Stripe Elements for seamless payment integration.

### Key Components
- **Elements Provider**: Wrapper component that provides Stripe context
- **PaymentElement**: Modern, unified component for all payment methods
- **CardElement**: Legacy single-method input for credit card details
- **PaymentRequestButton**: Apple Pay / Google Pay integration

### Installation
```bash
npm install @stripe/react-stripe-js @stripe/stripe-js
```

### Basic Usage
```jsx
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe('your-publishable-key');

const CheckoutForm = () => {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: 'https://your-site.com/checkout-complete',
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button disabled={!stripe}>Pay</button>
    </form>
  );
};

const App = () => (
  <Elements stripe={stripePromise} options={{ clientSecret: 'from-backend' }}>
    <CheckoutForm />
  </Elements>
);
```

---

## Stripe Issuing API

### Overview
Stripe Issuing allows you to create, manage, and control virtual and physical cards programmatically.

### Key Features
1. **Card Creation**: Issue virtual cards instantly or physical cards shipped to cardholders
2. **Cardholder Management**: Create and manage cardholder profiles
3. **Spend Controls**: Set dynamic spending limits by amount, merchant category, or geography
4. **Real-Time Authorizations**: Monitor and approve/decline transactions in real-time
5. **Digital Wallet Support**: Cards can be added to Apple Pay, Google Pay, Samsung Pay

### API Endpoints

#### Create a Cardholder
```bash
POST /v1/issuing/cardholders
-d "name"="John Doe"
-d "email"="john@example.com"
-d "phone_number"="+14155551234"
-d "type"="individual"
-d "billing[address][line1]"="123 Main St"
-d "billing[address][city]"="San Francisco"
-d "billing[address][state]"="CA"
-d "billing[address][postal_code]"="94111"
-d "billing[address][country]"="US"
```

#### Create a Virtual Card
```bash
POST /v1/issuing/cards
-d "cardholder"="ich_1234567890"
-d "currency"="usd"
-d "type"="virtual"
-d "spending_controls[spending_limits][0][amount]"=50000
-d "spending_controls[spending_limits][0][interval]"="monthly"
```

#### Create a Physical Card
```bash
POST /v1/issuing/cards
-d "cardholder"="ich_1234567890"
-d "currency"="usd"
-d "type"="physical"
-d "shipping[name]"="John Doe"
-d "shipping[address][line1]"="123 Main St"
-d "shipping[address][city]"="San Francisco"
-d "shipping[address][state]"="CA"
-d "shipping[address][postal_code]"="94111"
-d "shipping[address][country]"="US"
```

### Spend Controls
```javascript
// Spending limits structure
spending_controls: {
  spending_limits: [
    { amount: 50000, interval: 'monthly' },       // $500/month
    { amount: 10000, interval: 'per_authorization' } // $100 max per transaction
  ],
  allowed_categories: ['restaurants', 'hotels'],  // Restrict to categories
  blocked_categories: ['gambling', 'adult_entertainment']
}
```

### Webhook Events
- `issuing_authorization.created` - New authorization request
- `issuing_authorization.request` - Real-time authorization (approve/decline)
- `issuing_transaction.created` - Completed transaction
- `issuing_card.created` - New card issued
- `issuing_cardholder.created` - New cardholder created

### Cost (US)
- Virtual Cards: $0.10 per card
- Physical Cards: $3.00 per card + shipping
- Transaction Fees: Included in interchange

---

## Stripe Connect Platform

### Overview
Stripe Connect enables platforms and marketplaces to manage payments between multiple parties.

### Account Types
1. **Standard**: Full Stripe Dashboard access for sellers
2. **Express**: Stripe-managed compliance with platform fee control
3. **Custom**: Fully platform-controlled experience

### Charge Types

#### 1. Destination Charges
Platform collects payment, sends funds to connected account.
```bash
POST /v1/payment_intents
-d "amount"=10000
-d "currency"="usd"
-d "application_fee_amount"=1000
-d "transfer_data[destination]"="{{CONNECTED_ACCOUNT_ID}}"
```

#### 2. Separate Charges and Transfers
Platform charges then transfers to multiple accounts.
```bash
# Step 1: Create charge
POST /v1/payment_intents
-d "amount"=10000
-d "currency"="usd"

# Step 2: Create transfer(s)
POST /v1/transfers
-d "amount"=7000
-d "currency"="usd"
-d "destination"="{{CONNECTED_ACCOUNT_1}}"

POST /v1/transfers
-d "amount"=2000
-d "currency"="usd"
-d "destination"="{{CONNECTED_ACCOUNT_2}}"
```

#### 3. Direct Charges
Connected account charges directly, platform receives fee.
```bash
POST /v1/payment_intents
-H "Stripe-Account: {{CONNECTED_ACCOUNT_ID}}"
-d "amount"=10000
-d "currency"="usd"
-d "application_fee_amount"=1000
```

### Payouts to Connected Accounts
```bash
# Manual payout
POST /v1/payouts
-H "Stripe-Account: {{CONNECTED_ACCOUNT_ID}}"
-d "amount"=50000
-d "currency"="usd"

# Instant payout (if eligible)
POST /v1/payouts
-H "Stripe-Account: {{CONNECTED_ACCOUNT_ID}}"
-d "amount"=50000
-d "currency"="usd"
-d "method"="instant"
```

### Webhook Events
- `account.updated` - Connected account status change
- `transfer.created` - Transfer initiated
- `transfer.paid` - Transfer completed
- `payout.created` - Payout initiated
- `payout.paid` - Payout completed
- `payout.failed` - Payout failed

---

## Payment Elements & Checkout

### Payment Element (Recommended)
The unified payment component supporting multiple methods:
- Credit/Debit Cards
- Digital Wallets (Apple Pay, Google Pay)
- Bank Transfers (ACH, SEPA)
- Buy Now Pay Later (Klarna, Afterpay)
- Local Payment Methods (iDEAL, Bancontact, etc.)

### Appearance API
```javascript
const appearance = {
  theme: 'stripe', // or 'night', 'flat'
  variables: {
    colorPrimary: '#0570de',
    colorBackground: '#ffffff',
    colorText: '#30313d',
    fontFamily: 'Ideal Sans, system-ui, sans-serif',
    borderRadius: '4px'
  },
  rules: {
    '.Input': {
      border: '1px solid #e6e6e6'
    }
  }
};
```

### Checkout Session (Hosted)
For redirect-based checkout:
```bash
POST /v1/checkout/sessions
-d "mode"="payment"
-d "line_items[0][price]"="price_1234"
-d "line_items[0][quantity]"=1
-d "success_url"="https://example.com/success?session_id={CHECKOUT_SESSION_ID}"
-d "cancel_url"="https://example.com/cancel"
```

---

## Redirect Flows

### Payment Redirect
```javascript
const { error } = await stripe.confirmPayment({
  elements,
  confirmParams: {
    return_url: 'https://your-site.com/payment-complete',
  },
  redirect: 'if_required' // or 'always'
});

// After redirect, on return_url page:
const { paymentIntent, error } = await stripe.retrievePaymentIntent(clientSecret);
```

### Checkout Redirect
```javascript
// Frontend: Redirect to Stripe Checkout
stripe.redirectToCheckout({ sessionId: 'cs_test_...' });

// Backend: Create session
const session = await stripe.checkout.sessions.create({
  success_url: 'https://example.com/success',
  cancel_url: 'https://example.com/cancel',
  mode: 'payment',
  line_items: [{ price: 'price_123', quantity: 1 }]
});
```

### Supported Redirect Payment Methods
- iDEAL (Netherlands)
- Bancontact (Belgium)
- Sofort (Germany, Austria)
- giropay (Germany)
- EPS (Austria)
- P24 (Poland)
- 3D Secure Authentication (Cards)

---

## Implementation Recommendations

### For This Project

#### 1. Add Stripe Issuing Support
- Create edge function for cardholder/card management
- Build UI component for viewing and managing issued cards
- Implement spend controls configuration

#### 2. Enhance Payment Dashboard
- Add Payment Element integration for in-app checkout
- Support redirect-based payment flows
- Display connected account information

#### 3. Add Connect Monitoring
- Track connected accounts
- Monitor transfers between accounts
- Display payout status and history

#### 4. Security Considerations
- Never expose card numbers in logs
- Use webhook secrets for verification
- Implement idempotency keys for critical operations
- Monitor for suspicious issuing activity

### API Keys Required
- `STRIPE_SECRET_KEY` - Server-side operations
- `STRIPE_PUBLISHABLE_KEY` - Client-side Stripe.js
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification

### Edge Function Structure
```
supabase/functions/
├── stripe-issuing/          # Card issuance management
├── stripe-connect/          # Connect platform operations
├── stripe-checkout/         # Checkout session creation
├── stripe-dashboard-data/   # Existing dashboard data
├── stripe-forensics/        # Existing forensics
└── stripe-payouts-ai/       # Existing payouts AI
```

---

## References
- [React Stripe.js Docs](https://docs.stripe.com/sdks/stripejs-react)
- [Stripe Issuing Docs](https://docs.stripe.com/issuing)
- [Stripe Connect Docs](https://docs.stripe.com/connect)
- [Payment Element Docs](https://docs.stripe.com/payments/payment-element)
- [Checkout Sessions Docs](https://docs.stripe.com/payments/checkout)
