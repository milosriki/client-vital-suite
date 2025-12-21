# 🔍 Query Stripe Blocked IPs via Agentic System

## Quick Query

I've set up the agentic system to query Stripe for blocked IPs. Here's how to use it:

### Method 1: Via UI Component (Recommended)

1. Open the PTD Control page or Dashboard
2. Use the AI Assistant Panel or PTD Unlimited Chat
3. Ask: **"Check Stripe for blocked IP addresses. Show me any fraud alerts, Radar rules, or IP restrictions."**

The agent will:
- Query Stripe fraud/security data
- Check for IP-related blocks
- Show Radar rules
- Display any security restrictions

### Method 2: Direct Agent Invocation

Use the PTD Agent Gemini function directly:

```bash
curl -X POST "https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/ptd-agent-gemini" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Check Stripe for blocked IP addresses. Use stripe_control tool with fraud_scan action to get all security data including IP blocks.",
    "thread_id": "stripe-ip-check"
  }'
```

### Method 3: Via Stripe Forensics Function

The `stripe-forensics` function can detect security anomalies:

```bash
curl -X POST "https://ztjndilxurtsfqdsvfds.supabase.co/functions/v1/stripe-forensics" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "full-audit",
    "days": 90
  }'
```

## Important Notes

⚠️ **Stripe API Limitation:**
- Stripe's API does **NOT** directly expose blocked IP addresses
- IP blocking is managed through Stripe Radar or Dashboard settings
- IP addresses are visible in: **Stripe Dashboard > Developers > Logs**

## What the Agent Can Find

The agentic system can detect:
1. ✅ **Fraud alerts** with IP-related information
2. ✅ **Radar rules** that block IPs (if configured)
3. ✅ **Security anomalies** that might indicate IP blocks
4. ✅ **Failed payment attempts** from blocked IPs
5. ✅ **Account restrictions** that include IP blocks

## Direct Dashboard Access

For direct IP viewing:
1. Go to **Stripe Dashboard**
2. Navigate to **Developers > Logs**
3. Look for failed requests (4xx/5xx status codes)
4. Check the IP column for blocked requests

For Radar rules:
1. Go to **Stripe Dashboard**
2. Navigate to **Radar > Rules**
3. Check for IP-based blocking rules

## Agent Query Examples

**Example 1:**
```
"Show me all Stripe fraud alerts and blocked IP addresses"
```

**Example 2:**
```
"Check Stripe Radar rules for IP blocks and show me the blocked IPs"
```

**Example 3:**
```
"Run a Stripe security audit and find any IP-based restrictions"
```

## Next Steps

1. Use the UI chat interface to query blocked IPs
2. Review the agent's response for IP-related security data
3. Check Stripe Dashboard directly for complete IP logs
4. Review Radar rules for IP blocking configurations

---

*Generated automatically by the agentic intelligence system*
