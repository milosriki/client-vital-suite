# HubSpot Conversations API

Complete guide to HubSpot's Conversations API for WhatsApp messaging.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Sending Messages](#sending-messages)
4. [Receiving Messages (Webhooks)](#receiving-messages-webhooks)
5. [Thread Management](#thread-management)
6. [WhatsApp-Specific Considerations](#whatsapp-specific-considerations)
7. [Actor IDs](#actor-ids)
8. [Error Handling](#error-handling)
9. [Rate Limits](#rate-limits)
10. [Best Practices](#best-practices)
11. [Signature Verification](#signature-verification)

## Overview

HubSpot Conversations API enables two-way messaging with contacts through connected WhatsApp accounts.

**Features**:

- Send/receive WhatsApp messages
- Thread-based conversations
- Multi-channel support (email, chat, WhatsApp)
- Integration with CRM

## Authentication

```typescript
import { Client } from "@hubspot/api-client";

const hubspot = new Client({
  accessToken: Deno.env.get("HUBSPOT_API_KEY"),
});
```

## Sending Messages

### Basic Message

```typescript
const threadId = "123456789"; // From webhook or CRM

await hubspot.apiRequest({
  method: "POST",
  path: `/conversations/v3/conversations/threads/${threadId}/messages`,
  body: {
    type: "MESSAGE",
    text: "Hello! How can I help you?",
  },
});
```

### With Sender

```typescript
await hubspot.apiRequest({
  method: "POST",
  path: `/conversations/v3/conversations/threads/${threadId}/messages`,
  body: {
    type: "MESSAGE",
    text: "Your booking is confirmed!",
    senderActorId: "A-12345", // Bot/user actor ID
  },
});
```

### Rich Text (Limited Support)

```typescript
// WhatsApp supports emojis but not HTML
const message = {
  type: "MESSAGE",
  text: "🎉 Booking confirmed!\n\n✅ Monday at 6pm\n📍 Main Gym",
};
```

## Receiving Messages (Webhooks)

### Webhook Configuration

1. Go to HubSpot → Settings → Data Management → Webhooks
2. Create subscription
3. Select events:
   - `conversation.newMessage`
   - `conversation.creation`
   - `conversation.deletion`

### Webhook Payload

```json
[
  {
    "objectId": 123456789,
    "propertyName": "hs_thread_id",
    "propertyValue": "thread-123",
    "changeSource": "INTEGRATION",
    "eventId": 1,
    "subscriptionId": 789,
    "portalId": 456,
    "appId": 789,
    "occurredAt": 1738660800000,
    "subscriptionType": "conversation.newMessage",
    "attemptNumber": 0,
    "messageId": "msg-123",
    "threadId": "thread-123",
    "messageText": "I want to book a session",
    "senderName": "John Doe",
    "timestamp": 1738660800000
  }
]
```

### Webhook Handler

```typescript
// supabase/functions/hubspot-webhook-receiver/index.ts
Deno.serve(async (req) => {
  const events = await req.json();

  for (const event of events) {
    if (event.subscriptionType === "conversation.newMessage") {
      await handleNewMessage({
        messageId: event.messageId,
        threadId: event.threadId,
        text: event.messageText,
        senderName: event.senderName,
        timestamp: event.timestamp,
      });
    }
  }

  return new Response("OK");
});
```

## Thread Management

### Get Thread Details

```typescript
const thread = await hubspot.apiRequest({
  method: "GET",
  path: `/conversations/v3/conversations/threads/${threadId}`,
});

console.log(thread.status); // 'OPEN', 'CLOSED'
console.log(thread.latestMessageTimestamp);
```

### List Messages in Thread

```typescript
const messages = await hubspot.apiRequest({
  method: "GET",
  path: `/conversations/v3/conversations/threads/${threadId}/messages`,
});

for (const msg of messages.results) {
  console.log(`${msg.senderType}: ${msg.text}`);
}
```

### Close Thread

```typescript
await hubspot.apiRequest({
  method: "PATCH",
  path: `/conversations/v3/conversations/threads/${threadId}`,
  body: {
    status: "CLOSED",
  },
});
```

## WhatsApp-Specific Considerations

### Phone Number Format

HubSpot requires E.164 format:

- ✅ `+12065551234`
- ❌ `(206) 555-1234`
- ❌ `2065551234`

```typescript
function formatPhoneE164(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, "");

  // Add + prefix if missing
  return digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
}
```

### Media Limitations

HubSpot Conversations API for WhatsApp:

- ❌ No image sending
- ❌ No video sending
- ❌ No file sending
- ✅ Can receive media (via webhook)

Use AISensy for media support.

### Message Length

- Max: 4096 characters
- Recommended: <300 characters (WhatsApp UX)

```typescript
function truncateMessage(text: string, maxLength = 300): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}
```

## Actor IDs

### Get Bot Actor ID

```typescript
// List all actors
const actors = await hubspot.apiRequest({
  method: "GET",
  path: "/conversations/v3/actors",
});

// Find bot actor
const botActor = actors.results.find((a) => a.name === "PTD Sales Bot");
console.log(botActor.id); // Use as senderActorId
```

### Create Bot Actor

```typescript
await hubspot.apiRequest({
  method: "POST",
  path: "/conversations/v3/actors",
  body: {
    name: "PTD Sales Bot",
    type: "BOT",
  },
});
```

## Error Handling

### Common Errors

| Status | Error             | Solution              |
| ------ | ----------------- | --------------------- |
| 400    | Invalid thread ID | Verify thread exists  |
| 401    | Unauthorized      | Check API key         |
| 404    | Thread not found  | Thread may be deleted |
| 429    | Rate limit        | Implement backoff     |

### Retry Logic

```typescript
async function sendMessageWithRetry(
  threadId: string,
  text: string,
  maxRetries = 3,
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await hubspot.apiRequest({
        method: "POST",
        path: `/conversations/v3/conversations/threads/${threadId}/messages`,
        body: { type: "MESSAGE", text },
      });
    } catch (error: any) {
      if (error.statusCode === 429 && attempt < maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

## Rate Limits

- **10 requests/second** (burst)
- **100,000 requests/day**
- **150 writes/second** per conversation

Implement queuing:

```typescript
import PQueue from "p-queue";

const queue = new PQueue({
  concurrency: 5,
  interval: 1000,
  intervalCap: 10,
});

await queue.add(() => sendMessage(threadId, text));
```

## Best Practices

✅ **DO**:

- Store threadId → phone mapping in database
- Implement retry logic for API calls
- Use bot actor for automated messages
- Keep messages under 300 chars
- Close threads when conversation ends

❌ **DON'T**:

- Send messages to closed threads
- Exceed rate limits (use queue)
- Send media (not supported)
- Hardcode threadIds

## Signature Verification

```typescript
import { createHmac } from "node:crypto";

function verifyHubSpotSignature(
  body: string,
  signature: string,
  secret: string,
): boolean {
  const hmac = createHmac("sha256", secret);
  hmac.update(body);
  const expected = hmac.digest("hex");
  return signature === expected;
}

// In webhook handler
const signature = req.headers.get("X-HubSpot-Signature") || "";
const body = await req.text();
const isValid = verifyHubSpotSignature(body, signature, WEBHOOK_SECRET);

if (!isValid) {
  return new Response("Unauthorized", { status: 401 });
}
```

## Status

**Integration**: ✅ Deployed
**Webhooks**: ✅ Configured
**Media Support**: ❌ Limited (text only)
**Rate Limiting**: ⏳ Implement if needed
