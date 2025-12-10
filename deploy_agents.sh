#!/bin/bash

# Deploy all Supabase Edge Functions
# Includes: stripe-forensics, health-calculator, churn-predictor, ptd-agent, etc.

echo "🚀 Starting Deployment of Intelligence Agents..."

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo "Error: npx is not installed or not in your PATH."
    exit 1
fi

# Deploy command
npx supabase functions deploy --no-verify-jwt --project-ref ztjndilxurtsfqdsvfds

echo "✅ Deployment script finished."
