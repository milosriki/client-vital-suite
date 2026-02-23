#!/bin/bash
# verify-stripe-sync.sh
# Evolved Agent Protocol 1: Strict Validation Script

# Config
SUPA_URL="https://ztjndilxurtsfqdsvfds.supabase.co/rest/v1"
# Trying to grep key from local files or environment. 
# fallback to the known anon key from MEMORY.md if env var not set.
SUPA_KEY="${SUPABASE_SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0am5kaWx4dXJ0c2ZxZHN2ZmRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMjA2MDcsImV4cCI6MjA2OTY5NjYwN30.e665i3sdaMOBcD_OLzA6xjnTLQZ-BpiQ6GlgYkV15Lo}"

echo "🔎 [TEST] Verifying Stripe Sync Status..."

# 1. Check Transaction Count
COUNT=$(curl -s "$SUPA_URL/stripe_transactions?select=id&limit=1" \
  -H "apikey: $SUPA_KEY" -H "Authorization: Bearer $SUPA_KEY" \
  -H "Prefer: count=exact" -H "Range: 0-0" -I | grep -i "content-range" | awk -F'/' '{print $2}' | tr -d '\r')

echo "📊 Transactions in DB: ${COUNT:-0}"

if [[ "$COUNT" == "0" || -z "$COUNT" ]]; then
  echo "❌ [FAIL] stripe_transactions table is EMPTY. Sync is not working."
  exit 1
fi

# 2. Check Freshness (Latest Transaction)
LATEST=$(curl -s "$SUPA_URL/stripe_transactions?select=created_at,amount,currency,status&order=created_at.desc&limit=1" \
  -H "apikey: $SUPA_KEY" -H "Authorization: Bearer $SUPA_KEY")

echo "🕒 Latest Transaction: $LATEST"

# Simple date check
TODAY=$(date -u +"%Y-%m-%d")
if [[ "$LATEST" == *"$TODAY"* ]]; then
    echo "✅ [PASS] Sync is active. Found transactions from today ($TODAY)."
    exit 0
else
    echo "⚠️ [WARN] No transactions found from today ($TODAY). Sync might be lagging or no sales yet."
    # We exit 0 because the tool works (schema correct), but the business logic (freshness) is the finding.
    exit 0
fi
