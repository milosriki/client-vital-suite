#!/bin/bash
# Query Stripe blocked IPs through agentic system

echo "🔍 Querying Stripe for blocked IPs..."
echo ""

# Use the PTD agent to query Stripe
curl -X POST "https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/ptd-agent-gemini" \
  -H "Authorization: Bearer $(grep SUPABASE_SERVICE_ROLE_KEY .env.local 2>/dev/null | cut -d '=' -f2 || echo 'YOUR_KEY_HERE')" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Check Stripe for any blocked IP addresses. Look for: 1) Fraud alerts with IP information, 2) Radar rules that block IPs, 3) Security restrictions, 4) Any IP-based blocks in account settings. Use stripe_control with fraud_scan action to get detailed security data.",
    "thread_id": "stripe-ip-check"
  }' | jq -r '.response // .'

echo ""
echo "💡 Note: For direct IP viewing, check Stripe Dashboard > Developers > Logs"
