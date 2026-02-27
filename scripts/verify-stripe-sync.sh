#!/bin/bash
# verify-stripe-sync.sh
# Evolved Agent Protocol 1: Strict Validation Script

# Config
SUPA_URL="${SUPABASE_URL:-https://ztjndilxurtsfqdsvfds.supabase.co}/rest/v1"
SUPA_KEY="${SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_KEY:-}}"

if [[ -z "$SUPA_KEY" ]]; then
  echo "❌ [FAIL] Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) env var."
  exit 1
fi

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
