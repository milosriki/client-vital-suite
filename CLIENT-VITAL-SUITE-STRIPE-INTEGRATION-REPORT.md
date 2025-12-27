# Client Vital Suite - Stripe Integration Analysis Report

**Date:** December 26, 2025
**Analyzed by:** Claude AI
**Platform:** Client Vital Suite (Vercel + Supabase Edge Functions)

---

## 🔴 CURRENT ISSUES IDENTIFIED

### Issue 1: PTD Agent Stripe Errors
From screenshots, the PTD Agent shows:
- "CRITICAL ALERTS: Stripe is returning an error"
- "Anomaly detection is failing as well"
- "There might be a system outage"

**Root Cause:** The `stripe-forensics` edge function requires `STRIPE_SECRET_KEY` but it may not be properly configured in Supabase secrets.

### Issue 2: 64% Payment Success Rate (Yellow Health Zone)
The Stripe AI Assistant shows payment processing issues that need investigation.

### Issue 3: LangSmith Not Properly Connected
From screenshots, LangSmith is showing a setup page rather than active tracing for the PTD Agent.

---

## 🏗️ ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT VITAL SUITE                           │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Vercel)          │  Backend (Supabase Edge)          │
│  ─────────────────          │  ────────────────────             │
│  FloatingChat.tsx           │  ptd-agent-gemini                 │
│  StripeAIDashboard.tsx      │  stripe-forensics                 │
│  StripeForensicsTab.tsx     │  stripe-payouts-ai                │
│  StripeCompleteIntelligence │  stripe-dashboard-data            │
│                             │  stripe-payout-controls           │
│                             │  anomaly-detector                 │
│                             │  churn-predictor                  │
└─────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────┐
                        │     STRIPE API          │
                        │  (Requires Secret Key)  │
                        └─────────────────────────┘
```

---

## 🔧 REQUIRED FIXES

### 1. Supabase Secrets Configuration

Run this to verify and set Supabase secrets:

```bash
# Check current secrets
supabase secrets list --project-ref ztjndilxurtsfqdsvfds

# Set Stripe Secret Key
supabase secrets set STRIPE_SECRET_KEY="sk_live_YOUR_KEY" --project-ref ztjndilxurtsfqdsvfds

# Required secrets for full functionality:
# - STRIPE_SECRET_KEY (live mode)
# - STRIPE_WEBHOOK_SECRET
# - OPENAI_API_KEY (for embeddings/RAG)
# - LANGSMITH_API_KEY (for tracing)
```

### 2. Vercel Environment Variables

Set in Vercel Dashboard (Settings > Environment Variables):

```
SUPABASE_URL=https://ztjndilxurtsfqdsvfds.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
AGENT_FUNCTION_NAME=ptd-agent-gemini
STRIPE_SECRET_KEY=sk_live_xxx (optional - backend uses Supabase)
```

### 3. LangSmith Configuration

For proper tracing, add to Supabase secrets:

```bash
supabase secrets set LANGSMITH_API_KEY="ls__xxx" --project-ref ztjndilxurtsfqdsvfds
supabase secrets set LANGSMITH_PROJECT="client-vital-suite" --project-ref ztjndilxurtsfqdsvfds
supabase secrets set LANGSMITH_TRACING=true --project-ref ztjndilxurtsfqdsvfds
```

---

## 📊 STRIPE EDGE FUNCTIONS INVENTORY

| Function | Purpose | Dependencies |
|----------|---------|--------------|
| stripe-forensics | Deep fraud analysis | STRIPE_SECRET_KEY |
| stripe-payouts-ai | AI-powered payout analysis | STRIPE_SECRET_KEY, OPENAI_API_KEY |
| stripe-dashboard-data | Dashboard metrics | STRIPE_SECRET_KEY |
| stripe-payout-controls | Payout controls | STRIPE_SECRET_KEY |
| stripe-history | Historical data | STRIPE_SECRET_KEY |
| enrich-with-stripe | Data enrichment | STRIPE_SECRET_KEY |
| stripe-webhook | Webhook handler | STRIPE_WEBHOOK_SECRET |

---

## 🚀 RECOMMENDED IMPROVEMENTS

### A. Better Error Handling in PTD Agent

Update `ptd-agent-gemini/index.ts` to handle Stripe errors gracefully:

```typescript
case "stripe_control": {
  try {
    const { data, error } = await supabase.functions.invoke('stripe-forensics', {
      body: { action: 'health-check' }
    });
    
    if (error || !data?.connected) {
      return {
        error: false,
        result: "⚠️ Stripe connection issue detected. Please check:\n" +
                "1. STRIPE_SECRET_KEY is set in Supabase secrets\n" +
                "2. The key has required permissions\n" +
                "3. Stripe account is active"
      };
    }
    // Continue with actual operation...
  } catch (e) {
    return { error: true, result: `Stripe check failed: ${e.message}` };
  }
}
```

### B. Add Health Check Endpoint

Create `/api/stripe/health.ts`:

```typescript
export default async function handler(req, res) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/stripe-forensics`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({ action: 'health-check' })
  });
  
  const data = await response.json();
  return res.json({
    stripe_connected: data.connected,
    account_id: data.accountId,
    timestamp: data.timestamp
  });
}
```

### C. LangSmith Integration for Better Observability

Add to agent functions:

```typescript
import { Client } from "langsmith";

const langsmith = new Client({
  apiKey: Deno.env.get("LANGSMITH_API_KEY"),
  projectName: "client-vital-suite"
});

// Wrap agent calls with tracing
const trace = await langsmith.createRun({
  name: "ptd-agent-gemini",
  inputs: { message, thread_id },
  run_type: "chain"
});

// ... agent logic ...

await trace.end({ outputs: { response } });
```

---

## 🔒 SECURITY RECOMMENDATIONS

1. **Rotate API Keys Monthly** - Especially after the fraud investigation
2. **Use Restricted Keys** - Create Stripe keys with only needed permissions
3. **IP Allowlisting** - Configure Supabase to only accept requests from known IPs
4. **Audit Logging** - Enable detailed logging in LangSmith
5. **Rate Limiting** - Already implemented in `/api/agent.ts` ✅

---

## 📈 MONITORING DASHBOARD SUGGESTIONS

For the Client Vital Suite dashboard, add:

1. **Real-time Stripe Health Widget**
   - Connection status
   - API rate limit usage
   - Last successful call timestamp

2. **Payment Flow Visualization**
   - Inflows vs Outflows chart
   - Success/Failure rate trends
   - Anomaly alerts

3. **Agent Performance Metrics**
   - Response times from LangSmith
   - Token usage
   - Error rates by tool

---

## ✅ IMMEDIATE ACTION ITEMS

- [ ] Verify STRIPE_SECRET_KEY in Supabase secrets
- [ ] Set up LANGSMITH_API_KEY for tracing
- [ ] Test stripe-forensics health-check endpoint
- [ ] Review 64% success rate causes
- [ ] Deploy improved error handling
- [ ] Connect LangSmith to langsmith-agent-builder project

---

## 🔗 RELEVANT FILES

- `/api/stripe.ts` - Vercel API route
- `/api/agent.ts` - Agent proxy
- `/src/config/api.ts` - API configuration
- `/src/components/FloatingChat.tsx` - PTD Agent UI
- `/supabase/functions/stripe-forensics/index.ts` - Main forensics function
- `/supabase/functions/ptd-agent-gemini/index.ts` - AI Agent

---

**Next Step:** Run the Supabase secrets verification command to confirm STRIPE_SECRET_KEY is configured.
