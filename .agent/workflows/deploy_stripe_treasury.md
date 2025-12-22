---
description: Deploy Stripe Treasury Features
---

# Deploy Stripe Treasury Features

This workflow deploys the new Stripe Treasury Outbound Transfer features.

## 1. Apply Database Migration

Run the following command to create the `stripe_outbound_transfers` table:

```bash
npx supabase db push
```

## 2. Deploy Edge Functions

Deploy the new `stripe-treasury` function and the updated `stripe-webhook` function:

```bash
npx supabase functions deploy stripe-treasury
npx supabase functions deploy stripe-webhook
```

## 3. Verify Deployment

1.  Go to the Stripe Intelligence page in the app.
2.  Check the new "Treasury" tab.
3.  Ensure you can see financial accounts (if any) and create transfers.
