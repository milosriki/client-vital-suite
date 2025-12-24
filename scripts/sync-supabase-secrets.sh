#!/bin/bash

# Load .env.local
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

echo "Syncing secrets to Supabase..."
supabase secrets set \
  STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
  STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  AGENT_API_KEY="$AGENT_API_KEY" \
  LANGSMITH_API_KEY="$LANGSMITH_API_KEY" \
  --project-ref ztjndilxurtsfqdsvfds

echo "Secrets synced!"
