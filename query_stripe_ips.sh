#!/bin/bash
# Query Stripe blocked IPs through agentic system
# SECURITY: Uses environment variables instead of scraping from .env files

echo "🔍 Querying Stripe for blocked IPs..."
echo ""

# Check for required environment variable
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is not set"
  echo ""
  echo "Usage:"
  echo "  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'"
  echo "  ./query_stripe_ips.sh"
  echo ""
  echo "Or run inline:"
  echo "  SUPABASE_SERVICE_ROLE_KEY='your-key' ./query_stripe_ips.sh"
  echo ""
  echo "⚠️  SECURITY: Never hardcode keys in scripts or scrape from .env files!"
  exit 1
fi

SUPABASE_URL="${SUPABASE_URL:-https://ztjndilxurtsfqdsvfds.supabase.co}"

# Use the PTD agent to query Stripe
curl -X POST "${SUPABASE_URL}/functions/v1/ptd-agent-gemini" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Check Stripe for any blocked IP addresses. Look for: 1) Fraud alerts with IP information, 2) Radar rules that block IPs, 3) Security restrictions, 4) Any IP-based blocks in account settings. Use stripe_control with fraud_scan action to get detailed security data.",
    "thread_id": "stripe-ip-check"
  }' | jq -r '.response // .'

echo ""
echo "💡 Note: For direct IP viewing, check Stripe Dashboard > Developers > Logs"
