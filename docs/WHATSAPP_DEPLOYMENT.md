# Elite WhatsApp Sales Agent - Deployment Guide

## 🎯 What We Built

A complete, professional WhatsApp sales agent system that prevents information leaks and optimizes for booking conversions.

### Core Components

1. **`send-hubspot-message`** - Sends AI responses to customers via HubSpot
2. **Content Filter** - Sanitizes responses to prevent leaks
3. **Professional Sales Prompts** - Conversion-optimized messaging
4. **Updated `ptd-agent-gemini`** - WhatsApp-aware AI with safety filters

---

## 🚀 Quick Deployment

```bash
# Navigate to project
cd /Users/milosvukovic/client-vital-suite

# Run deployment script
./scripts/deploy_whatsapp_agent.sh
```

---

## 📋 Manual Deployment Steps

### 1. Apply Database Migration

```bash
cd /Users/milosvukovic/client-vital-suite
supabase db push
```

This creates:

- `message_delivery_log` - Tracks all sent messages
- `response_safety_log` - Monitors content filter triggers

### 2. Deploy Edge Functions

```bash
# Deploy message sender
supabase functions deploy send-hubspot-message --no-verify-jwt

# Deploy updated AI agent
supabase functions deploy ptd-agent-gemini --no-verify-jwt
```

### 3. Verify Environment Variables

In Supabase Dashboard → Project Settings → Edge Functions → Secrets:

- ✅ `HUBSPOT_API_KEY` - HubSpot private app token
- ✅ `GEMINI_API_KEY` or `GOOGLE_API_KEY` - For AI
- ✅ `SUPABASE_URL` - Auto-configured
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Auto-configured

### 4. Update Webhook Receiver

**File to modify**: `supabase/functions/hubspot-webhook-receiver/index.ts`

**Current** (lines 81-102):

```typescript
// Fire and forget - NO DELIVERY
EdgeRuntime.waitUntil(
  supabase.functions.invoke("agent-manager", { ... }),
);
```

**Replace with**:

```typescript
// Complete delivery flow
if (
  subscriptionType === "conversation.newMessage" ||
  subscriptionType === "conversation.creation"
) {
  console.log(`💬 New Message in Thread ${objectId}`);

  // 1. Fetch the actual message from HubSpot
  const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");
  const messageUrl = `https://api.hubapi.com/conversations/v3/conversations/threads/${objectId}/messages`;

  try {
    const msgResponse = await fetch(messageUrl, {
      headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` },
    });
    const messages = await msgResponse.json();
    const latestMessage = messages.results?.[0]?.text || "New message";

    // 2. Get AI response
    const { data: aiResponse } = await supabase.functions.invoke(
      "agent-manager",
      {
        body: {
          query: latestMessage,
          context: { source: "whatsapp", threadId: objectId },
        },
      },
    );

    // 3. Send response back to customer
    if (aiResponse?.response) {
      await supabase.functions.invoke("send-hubspot-message", {
        body: {
          threadId: objectId,
          message: aiResponse.response,
        },
      });
    }
  } catch (error) {
    console.error("WhatsApp flow error:", error);
  }
}
```

Then deploy:

```bash
supabase functions deploy hubspot-webhook-receiver --no-verify-jwt
```

---

## ✅ Testing Checklist

### Pre-Production

- [ ] **Database tables exist** - Check Supabase Table Editor
- [ ] **Functions deployed** - Check Edge Functions dashboard
- [ ] **Secrets configured** - Verify HUBSPOT_API_KEY is set
- [ ] **Webhook updated** - Message sending logic added

### Staging Tests

- [ ] **Send test WhatsApp message** - "Hi, I want to lose 10kg"
- [ ] **Verify AI responds** - Professional, friendly, sales-focused
- [ ] **Check no leaks** - No "CAPABILITIES", "SKILL", or technical jargon
- [ ] **Confirm delivery** - Message appears in WhatsApp
- [ ] **Monitor logs** - Check `message_delivery_log` for success

### Safety Validation

- [ ] **Run content filter tests** - Ensure sanitization works
- [ ] **Check safety log** - Verify `response_safety_log` captures issues
- [ ] **Test edge cases** - Complex queries, technical questions
- [ ] **Response time** - Should be < 3 seconds

---

## 📊 Monitoring

### Key Metrics

**Supabase Dashboard → Table Editor**:

```sql
-- Message delivery success rate
SELECT
  status,
  COUNT(*) as count,
  ROUND(AVG(delivery_time_ms)) as avg_time_ms
FROM message_delivery_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Safety issues detected
SELECT
  unnest(issues) as issue_type,
  COUNT(*) as occurrences
FROM response_safety_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY issue_type
ORDER BY occurrences DESC;
```

### Alerts to Set Up

1. **Failed Deliveries** - Alert if delivery_log has >5% failures
2. **Safety Triggers** - Alert on any response_safety_log entries
3. **Response Time** - Alert if avg delivery_time_ms > 5000ms
4. **Function Errors** - Monitor Edge Function logs for errors

---

## 🔒 Security Review

✅ **Implemented**:

- Content sanitization removes sensitive patterns
- Safety validation on every WhatsApp response
- Separate prompts for internal vs customer-facing
- Skills disabled for WhatsApp conversations
- Logging for audit trails

⚠️ **Still Needed**:

- Rate limiting on message sending
- Abuse detection (spam, inappropriate content)
- Human escalation triggers
- Business hours enforcement

---

## 🐛 Troubleshooting

### Messages not sending?

1. Check `message_delivery_log` for error messages
2. Verify `HUBSPOT_API_KEY` has Conversations API access
3. Check Edge Function logs for errors
4. Confirm webhook receiver is updated and deployed

### AI responses sound generic?

1. Review sales prompts in `whatsapp-sales-prompts.ts`
2. Add more context to RAG knowledge base
3. Fine-tune WHATSAPP_SALES_PERSONA
4. Check conversation history is being passed

### Information leaks detected?

1. Check `response_safety_log` for patterns
2. Update content filter patterns in `content-filter.ts`
3. Review and strengthen `formatSkillPrompt` separation
4. Test with various edge cases

---

## 📚 Resources

- **Walkthrough**: [`brain/walkthrough.md`](file:///Users/milosvukovic/.gemini/antigravity/brain/4cec8d79-e452-44c5-b08a-009750615849/walkthrough.md)
- **Implementation Plan**: [`brain/implementation_plan.md`](file:///Users/milosvukovic/.gemini/antigravity/brain/4cec8d79-e452-44c5-b08a-009750615849/implementation_plan.md)
- **Task Breakdown**: [`brain/task.md`](file:///Users/milosvukovic/.gemini/antigravity/brain/4cec8d79-e452-44c5-b08a-009750615849/task.md)

---

## 🎓 Team Training

Share with your team:

1. **Sales Reps**: How the AI handles conversations (see sales prompts)
2. **DevOps**: Monitoring and alerting setup
3. **Support**: How to check delivery logs and troubleshoot
4. **Management**: Success metrics and KPIs to track

---

**Status**: ✅ Code complete, ready for deployment and testing  
**Next**: Update webhook receiver → Test → Deploy to production
