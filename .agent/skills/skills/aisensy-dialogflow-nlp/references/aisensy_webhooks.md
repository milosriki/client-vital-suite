# AISensy Webhook Configuration

Complete guide to setting up and handling AISensy webhooks for real-time WhatsApp message notifications.

## Setup in AISensy Dashboard

1. Log into AISensy → **Manage** → **Webhooks**
2. **Add New Webhook**:
   - **Endpoint URL**: Your Edge Function URL (e.g., `https://<project>.supabase.co/functions/v1/aisensy-webhook-receiver`)
   - **Select Topics**: Choose events to subscribe to
   - **Save**

3. **Test**: Send test message to trigger webhook

## Webhook Topics (Events)

| Topic                 | Description             | When Fired                        |
| --------------------- | ----------------------- | --------------------------------- |
| `contact.created`     | New contact added       | User sends first message          |
| `contact.tag.updated` | Tag assigned to contact | Chatbot applies tag or manual tag |
| `message.created`     | New message received    | Customer sends WhatsApp message   |
| `message.sent`        | Message delivered       | Your message successfully sent    |
| `order.placed`        | WhatsApp Pay order      | Customer completes payment        |

**Most Common**: `message.created` for incoming messages

## Webhook Request Format

### Headers

```
Content-Type: application/json
X-AiSensy-Signature: <signature_for_verification>
X-AiSensy-API-Version: v2
```

### Body Structure

```json
{
  "notification_id": "unique-notification-id",
  "timestamp": 1673001234,
  "topic": "message.created",
  "delivery_attempt": 1,
  "data": {
    "message": {
      "id": "msg-123456",
      "text": "I want to book a PT session",
      "media_url": "",
      "media_type": "",
      "contact": {
        "id": "contact-789",
        "mobile": "+917428526285",
        "name": "Nazem Arja",
        "tags": ["lead", "interested"],
        "attributes": {
          "companyname": "Acme Corp",
          "source": "Website"
        }
      }
    }
  }
}
```

## Edge Function Implementation

```typescript
// supabase/functions/aisensy-webhook-receiver/index.ts
Deno.serve(async (req) => {
  // 1. Verify signature (security)
  const signature = req.headers.get("X-AiSensy-Signature");
  if (!verifySignature(req, signature)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Parse payload
  const payload = await req.json();
  const { topic, data } = payload;

  // 3. Handle different topics
  if (topic === "message.created") {
    const { message, contact } = data;

    // Extract message details
    const customerMessage = message.text;
    const phone = contact.mobile;
    const name = contact.name;

    // 4. Process with AI (Dialogflow or Gemini)
    const intent = await detectIntent(customerMessage);
    const response = await generateResponse(intent, { name, phone });

    // 5. Send reply via AISensy API
    await sendAISensyMessage(phone, response, { name });
  }

  // Must return 2xx status
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

## Signature Verification (Security)

```typescript
import { createHmac } from "node:crypto";

function verifySignature(req: Request, signature: string): boolean {
  const secret = Deno.env.get("AISENSY_WEBHOOK_SECRET");
  const body = await req.text();

  const hmac = createHmac("sha256", secret);
  hmac.update(body);
  const expectedSignature = hmac.digest("hex");

  return signature === expectedSignature;
}
```

## Response Requirements

- **Status Code**: Must return `2xx` (200, 201, 204)
- **Timeout**: Must respond within 30 seconds
- **Retry Logic**: AISensy retries failed webhooks with exponential backoff

## Error Handling

```typescript
try {
  await processWebhook(payload);
  return new Response(JSON.stringify({ status: "success" }), {
    status: 200,
  });
} catch (error) {
  console.error("Webhook processing failed:", error);

  // Log to database for debugging
  await logWebhookError(payload, error);

  // Return 200 to prevent retries (already logged)
  return new Response(
    JSON.stringify({
      status: "error",
      message: "Logged for manual review",
    }),
    {
      status: 200,
    },
  );
}
```

## Testing Locally

```bash
# Use ngrok to expose local server
ngrok http 54321

# Update AISensy webhook URL to ngrok URL
https://abc123.ngrok.io/functions/v1/aisensy-webhook-receiver

# Send test message
# Check ngrok logs
```

## Best Practices

✅ **DO**:

- Verify webhook signatures for security
- Return 200 quickly (process async if needed)
- Log all webhook payloads for debugging
- Implement idempotency (check `notification_id`)
- Handle all topics gracefully

❌ **DON'T**:

- Take >30s to respond (causes timeout/retry)
- Return non-2xx for expected errors (causes unnecessary retries)
- Skip signature verification
- Block webhook processing (use async queues for heavy work)
