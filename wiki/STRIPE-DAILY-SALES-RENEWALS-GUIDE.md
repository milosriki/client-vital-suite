# Stripe Daily Sales & Renewals - Complete Guide

## What Was Built

### 1. Database Tables (Created)
- `stripe_subscriptions` - Stores subscription data from webhooks
- `stripe_invoices` - Stores invoice data (including renewals)
- `stripe_transactions` - Stores transaction data for sales tracking

### 2. Enhanced Webhook Handler (`stripe-webhook`)
- **Signature Verification**: Now enforces Stripe webhook signature verification (requires `STRIPE_WEBHOOK_SECRET`)
- **Renewal Tracking**: Automatically tracks `invoice.payment_succeeded` events as renewals
- **Renewal Fraud Detection**: Checks for multiple failed renewal attempts before success

### 3. History Function (`stripe-history`)
- **Daily Sales Extraction**: Extracts one-time payments from `payment_intent.succeeded` and `charge.succeeded` events (excludes subscription invoices)
- **Renewals Extraction**: Extracts subscription renewals from `invoice.payment_succeeded` events
- **Daily Aggregates**: Calculates today's sales and renewals totals
- **Date-Based Grouping**: Groups sales and renewals by date for trend analysis

### 4. UI Components (`StripeForensicsTab`)
- **Today's Activity Card**: Shows today's sales and renewals totals at the top
- **Sales & Renewals Tab**: New dedicated tab showing:
  - Today's summary (sales count + total, renewals count + total)
  - Recent sales table (last 50 transactions)
  - Recent renewals table (last 50 renewals with subscription periods)
- **History Tab**: Enhanced with sales/renewals data

## How It Works

### Data Flow
1. **Stripe → Webhook** → Events arrive at `/functions/v1/stripe-webhook`
2. **Webhook → Database** → Events stored in `stripe_events` table
3. **Database → History Function** → `stripe-history` queries stored events
4. **History Function → UI** → Frontend displays daily sales/renewals

### Event Types Tracked

**Sales (One-time payments):**
- `payment_intent.succeeded` (without invoice)
- `charge.succeeded` (without invoice)

**Renewals (Subscription payments):**
- `invoice.payment_succeeded`
- `payment_intent.succeeded` (with invoice reference)

## Daily Usage

### View Today's Sales & Renewals
1. Open **Stripe Forensics** tab in your dashboard
2. See **Today's Activity** card at the top showing:
   - Today's Sales: Total amount + transaction count
   - Today's Renewals: Total amount + renewal count

### View Detailed History
1. Click **"Sales & Renewals"** tab
2. See:
   - Today's summary cards
   - Recent sales table (last 50)
   - Recent renewals table (last 50)

### View Complete History
1. Click **"History"** tab
2. Scroll to **"Daily Sales & Renewals"** section
3. See all sales/renewals from webhook events (last 90 days by default)

## Webhook Configuration

### Required Stripe Events
Make sure your Stripe webhook endpoint subscribes to:
- `payment_intent.succeeded`
- `charge.succeeded`
- `invoice.payment_succeeded`
- `invoice.payment_failed` (for fraud detection)
- `subscription.*` (for subscription tracking)

### Verify Webhook Secret
Ensure `STRIPE_WEBHOOK_SECRET` in Supabase matches your webhook endpoint secret:
1. Go to Stripe Dashboard → Developers → Webhooks
2. Click your webhook endpoint
3. Copy the "Signing secret"
4. Set it in Supabase: `STRIPE_WEBHOOK_SECRET`

## API Usage

### Query Daily Sales & Renewals
```typescript
const { data, error } = await supabase.functions.invoke('stripe-history', {
  body: { days: 90, limit: 500 }
});

// Access:
// data.summary.today_sales.total
// data.summary.today_sales.count
// data.summary.today_renewals.total
// data.summary.today_renewals.count
// data.dailySales[] // Array of sales
// data.renewals[] // Array of renewals
// data.salesByDate // Grouped by date
// data.renewalsByDate // Grouped by date
```

## What You Can See Daily

### Sales Metrics
- **Today's Sales**: Total revenue from one-time payments
- **Sales Count**: Number of successful sales transactions
- **Recent Sales**: Last 50 sales with customer ID, amount, status

### Renewal Metrics
- **Today's Renewals**: Total revenue from subscription renewals
- **Renewal Count**: Number of successful renewals
- **Recent Renewals**: Last 50 renewals with subscription ID, period dates

### Historical Analysis
- **Sales by Date**: Daily sales totals (last 90 days)
- **Renewals by Date**: Daily renewal totals (last 90 days)
- **Trend Analysis**: Compare daily performance

## Limitations & Notes

1. **Webhook Dependency**: Data only appears if webhooks are configured and events are being received
2. **Historical Data**: Only shows data from when webhooks started storing events (not before)
3. **Currency**: Defaults to AED, but uses currency from each transaction
4. **Amount Conversion**: Amounts are stored in cents, converted to currency units in UI

## Troubleshooting

### No Sales/Renewals Showing
1. Check webhook is receiving events: Stripe Dashboard → Developers → Webhooks → Your endpoint → Activity
2. Verify `stripe_events` table has data: `SELECT COUNT(*) FROM stripe_events`
3. Check event types: Ensure `payment_intent.succeeded` and `invoice.payment_succeeded` are subscribed

### Wrong Totals
1. Check currency conversion: Amounts are in cents, divided by 100 in UI
2. Verify date filtering: Default is last 90 days, can be adjusted in API call
3. Check event filtering: Sales exclude invoices, renewals only include invoices

## Next Steps

1. **Set up webhook endpoint** in Stripe Dashboard (if not done)
2. **Verify webhook secret** matches Supabase environment variable
3. **Subscribe to required events** (see above)
4. **Test with a payment** and check if it appears in dashboard
5. **Monitor daily** via the "Today's Activity" card

## Voice/Text Query Support

You can ask your AI agent:
- "Show me today's sales"
- "How many renewals today?"
- "What's the total revenue today?"
- "Show recent sales"
- "Show recent renewals"

The agent can query `stripe-history` function and return formatted results.


