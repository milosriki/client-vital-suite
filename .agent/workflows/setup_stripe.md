---
description: Complete setup guide for Stripe Webhooks and Database
---

# Stripe Webhook Full Setup Guide

This guide covers the complete setup for receiving Stripe events in your Supabase project, including database schema, edge function deployment, and Stripe configuration.

## 1. Database Setup

First, ensure all necessary tables are created in your Supabase database.

1.  Run the migration to create Stripe tables:
    ```bash
    npx supabase migration up
    ```
    _This will execute `supabase/migrations/20251222000001_ensure_stripe_tables.sql` which creates tables like `stripe_events`, `stripe_transactions`, `stripe_subscriptions`, etc._

## 2. Environment Variables

You need to set the following environment variables in your Supabase project (and locally for testing).

1.  Get your **Stripe Secret Key** (`sk_test_...` or `sk_live_...`) from the [Stripe Dashboard API Keys](https://dashboard.stripe.com/apikeys).
2.  Get your **Stripe Webhook Secret** (`whsec_...`).

    - For **Local Development**: Run `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook` (or your local port). The CLI will output a webhook secret.
    - For **Production**: Create a webhook endpoint in [Stripe Dashboard Webhooks](https://dashboard.stripe.com/webhooks) pointing to `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`. The dashboard will reveal the signing secret.

3.  Set the secrets in Supabase:
    ```bash
    npx supabase secrets set STRIPE_SECRET_KEY=sk_...
    npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
    ```

## 3. Deploy Edge Function

Deploy the `stripe-webhook` function to Supabase.

```bash
npx supabase functions deploy stripe-webhook
```

## 4. Configure Stripe Webhook

1.  Go to [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks).
2.  Click **Add endpoint**.
3.  **Endpoint URL**: `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`
4.  **Select events**: Select the events you want to listen to. Recommended set:
    - `payment_intent.succeeded`
    - `payment_intent.payment_failed`
    - `charge.succeeded`
    - `charge.failed`
    - `charge.refunded`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.payment_succeeded`
    - `invoice.payment_failed`
    - `invoice.paid`
    - `payout.paid`
    - `payout.failed`
    - `account.updated` (for Connect)
    - `person.created` (for Connect)
5.  Click **Add endpoint**.

## 5. Testing Locally

You can test the webhook locally using the Stripe CLI.

1.  Start your local Supabase instance:

    ```bash
    npx supabase start
    ```

2.  Start the Stripe listener:

    ```bash
    stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
    ```

3.  Trigger a test event in another terminal:

    ```bash
    stripe trigger payment_intent.succeeded
    ```

4.  Check the logs in your Supabase terminal or Dashboard to see the event being processed and stored in the `stripe_events` table.

## 6. Verification

Check the `stripe_events` table in your database to confirm events are being stored.

```sql
SELECT * FROM stripe_events ORDER BY created_at DESC LIMIT 5;
```

## Troubleshooting

- **Signature Verification Failed**: Ensure `STRIPE_WEBHOOK_SECRET` matches exactly what Stripe provides for that specific endpoint (local CLI secret is different from production dashboard secret).
- **Missing Tables**: Run `npx supabase migration up` again.
- **Timeout**: Ensure the function returns a 200 OK response quickly (the provided code does this).
