# Provider Abstraction Layer

Complete guide to building provider-agnostic WhatsApp integrations for easy platform swapping.

## Table of Contents

1. [Core Interface](#core-interface)
2. [HubSpot Provider Implementation](#hubspot-provider-implementation)
3. [AISensy Provider Implementation](#aisensy-provider-implementation)
4. [KASPO Provider (Template)](#kaspo-provider-template)
5. [Provider Factory](#provider-factory)
6. [Universal Webhook Receiver](#universal-webhook-receiver)
7. [Migration Steps](#migration-steps)
8. [Best Practices](#best-practices)
9. [Provider Feature Matrix](#provider-feature-matrix)
10. [Example: Complete Integration](#example-complete-integration)

## Core Interface

```typescript
// providers/whatsapp_provider.ts

export interface IncomingMessage {
  id: string;
  phone: string;
  name: string;
  text: string;
  mediaUrl?: string;
  timestamp: number;
}

export interface SendMessageOptions {
  name?: string;
  tags?: string[];
  attributes?: Record<string, any>;
  media?: { url: string; filename: string };
}

export interface WhatsAppProvider {
  /** Provider identifier */
  getName(): string;

  /** Send message to customer */
  sendMessage(
    phone: string,
    message: string,
    options?: SendMessageOptions,
  ): Promise<void>;

  /** Parse incoming webhook payload */
  receiveWebhook(payload: any): Promise<IncomingMessage>;

  /** Verify webhook signature (security) */
  verifySignature(request: Request, signature: string): boolean;
}
```

## HubSpot Provider Implementation

```typescript
// providers/hubspot_provider.ts
import {
  WhatsAppProvider,
  IncomingMessage,
  SendMessageOptions,
} from "./whatsapp_provider.ts";

export class HubSpotProvider implements WhatsAppProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  getName(): string {
    return "hubspot";
  }

  async sendMessage(
    phone: string,
    message: string,
    options?: SendMessageOptions,
  ): Promise<void> {
    // HubSpot uses threadId, not phone directly
    // You'll need to lookup threadId from phone number
    const threadId = await this.lookupThreadId(phone);

    const url = `https://api.hubapi.com/conversations/v3/conversations/threads/${threadId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "MESSAGE",
        text: message,
      }),
    });

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.status}`);
    }
  }

  async receiveWebhook(payload: any): Promise<IncomingMessage> {
    // HubSpot webhook format (from actual implementation)
    const event = payload[0]; // HubSpot sends array
    return {
      id: event.messageId,
      phone: await this.getPhoneFromThread(event.threadId),
      name: event.senderName || "Customer",
      text: event.messageText,
      timestamp: event.timestamp,
    };
  }

  verifySignature(request: Request, signature: string): boolean {
    // HubSpot uses X-HubSpot-Signature
    // Implementation depends on your security requirements
    return true; // Simplified for now
  }

  private async lookupThreadId(phone: string): Promise<string> {
    // Query your database or HubSpot API to find threadId for phone
    throw new Error("Not implemented");
  }

  private async getPhoneFromThread(threadId: string): Promise<string> {
    // Reverse lookup: threadId → phone
    throw new Error("Not implemented");
  }
}
```

## AISensy Provider Implementation

```typescript
// providers/aisensy_provider.ts
import {
  WhatsAppProvider,
  IncomingMessage,
  SendMessageOptions,
} from "./whatsapp_provider.ts";
import { createHmac } from "node:crypto";

export class AISensyProvider implements WhatsAppProvider {
  private apiKey: string;
  private webhookSecret: string;

  constructor(apiKey: string, webhookSecret: string) {
    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret;
  }

  getName(): string {
    return "aisensy";
  }

  async sendMessage(
    phone: string,
    message: string,
    options?: SendMessageOptions,
  ): Promise<void> {
    const url = "https://backend.aisensy.com/campaign/t1/api/v2";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: this.apiKey,
        campaignName: "PTD_AI_Sales", // Configure via env
        destination: phone, // Must include country code
        userName: options?.name || "Customer",
        templateParams: [],
        media: options?.media || {},
        tags: options?.tags || [],
        attributes: options?.attributes || {},
      }),
    });

    if (!response.ok) {
      throw new Error(`AISensy API error: ${response.status}`);
    }
  }

  async receiveWebhook(payload: any): Promise<IncomingMessage> {
    // AISensy webhook format
    const { data } = payload;
    const { message } = data;

    return {
      id: message.id,
      phone: message.contact.mobile,
      name: message.contact.name,
      text: message.text,
      mediaUrl: message.media_url,
      timestamp: payload.timestamp,
    };
  }

  verifySignature(request: Request, signature: string): boolean {
    const body = await request.text();
    const hmac = createHmac("sha256", this.webhookSecret);
    hmac.update(body);
    const expectedSignature = hmac.digest("hex");
    return signature === expectedSignature;
  }
}
```

## KASPO Provider (Template)

```typescript
// providers/kaspo_provider.ts
import {
  WhatsAppProvider,
  IncomingMessage,
  SendMessageOptions,
} from "./whatsapp_provider.ts";

export class KASPOProvider implements WhatsAppProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  getName(): string {
    return "kaspo";
  }

  async sendMessage(
    phone: string,
    message: string,
    options?: SendMessageOptions,
  ): Promise<void> {
    // TODO: Implement KASPO API integration
    throw new Error("Not implemented - add KASPO API details when available");
  }

  async receiveWebhook(payload: any): Promise<IncomingMessage> {
    // TODO: Parse KASPO webhook format
    throw new Error("Not implemented");
  }

  verifySignature(request: Request, signature: string): boolean {
    // TODO: Implement KASPO signature verification
    return false;
  }
}
```

## Provider Factory

```typescript
// providers/factory.ts
import { WhatsAppProvider } from "./whatsapp_provider.ts";
import { HubSpotProvider } from "./hubspot_provider.ts";
import { AISensyProvider } from "./aisensy_provider.ts";
import { KASPOProvider } from "./kaspo_provider.ts";

export function createWhatsAppProvider(): WhatsAppProvider {
  const providerName = Deno.env.get("WHATSAPP_PROVIDER") || "hubspot";

  switch (providerName.toLowerCase()) {
    case "hubspot":
      return new HubSpotProvider(Deno.env.get("HUBSPOT_API_KEY")!);

    case "aisensy":
      return new AISensyProvider(
        Deno.env.get("AISENSY_API_KEY")!,
        Deno.env.get("AISENSY_WEBHOOK_SECRET")!,
      );

    case "kaspo":
      return new KASPOProvider(Deno.env.get("KASPO_API_KEY")!);

    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}
```

## Universal Webhook Receiver

```typescript
// supabase/functions/whatsapp-webhook-receiver/index.ts
import { createWhatsAppProvider } from "./providers/factory.ts";

Deno.serve(async (req) => {
  const provider = createWhatsAppProvider();

  // 1. Verify signature
  const signature = req.headers.get("X-Signature") || "";
  if (!provider.verifySignature(req.clone(), signature)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Parse webhook (provider-agnostic)
  const payload = await req.json();
  const message = await provider.receiveWebhook(payload);

  // 3. Process with Dialogflow (provider-agnostic)
  const intent = await detectIntent(message.text);
  const response = await generateResponse(intent, message);

  // 4. Send reply (provider-agnostic)
  await provider.sendMessage(message.phone, response, {
    name: message.name,
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

## Migration Steps

### Step 1: Extract Current HubSpot Logic

Create `HubSpotProvider` class from existing `send-hubspot-message` and `hubspot-webhook-receiver`:

```typescript
// Copy logic from:
// - supabase/functions/send-hubspot-message/index.ts
// - supabase/functions/hubspot-webhook-receiver/index.ts
//
// Into:
// - providers/hubspot_provider.ts (implements WhatsAppProvider)
```

### Step 2: Create AISensy Provider

```typescript
// Use aisensy-dialogflow-nlp skill references
// - references/aisensy_api.md
// - references/aisensy_webhooks.md
//
// Implement:
// - providers/aisensy_provider.ts (implements WhatsAppProvider)
```

### Step 3: Update Webhook Receiver

```typescript
// Replace:
// supabase/functions/hubspot-webhook-receiver/index.ts
//
// With:
// supabase/functions/whatsapp-webhook-receiver/index.ts (uses factory)
```

### Step 4: Update Message Sender

```typescript
// Replace:
// supabase/functions/send-hubspot-message/index.ts
//
// With:
// Provider-agnostic calls via factory
```

### Step 5: Configure Provider

```bash
# .env or Supabase secrets
WHATSAPP_PROVIDER=hubspot  # or aisensy, kaspo

# Provider-specific credentials
HUBSPOT_API_KEY=xxx
AISENSY_API_KEY=xxx
AISENSY_WEBHOOK_SECRET=xxx
KASPO_API_KEY=xxx
```

### Step 6: Test Provider Switching

```bash
# Test HubSpot
export WHATSAPP_PROVIDER=hubspot
deno run scripts/test_provider.ts

# Test AISensy
export WHATSAPP_PROVIDER=aisensy
deno run scripts/test_provider.ts
```

## Best Practices

✅ **DO**:

- Keep all provider-specific logic in provider classes
- Use factory pattern for provider instantiation
- Test each provider implementation independently
- Document provider-specific quirks in class comments
- Handle provider-specific errors gracefully

❌ **DON'T**:

- Leak provider-specific code into business logic
- Hardcode provider names in multiple places
- Skip signature verification for any provider
- Assume all providers have same capabilities

## Provider Feature Matrix

| Feature                | HubSpot | AISensy | KASPO |
| ---------------------- | ------- | ------- | ----- |
| Send Message           | ✅      | ✅      | 🔧    |
| Receive Webhook        | ✅      | ✅      | 🔧    |
| Media Support          | ⚠️      | ✅      | 🔧    |
| Payments               | ❌      | ✅      | ❓    |
| Catalogues             | ❌      | ✅      | ❓    |
| Signature Verification | ⚠️      | ✅      | 🔧    |

Legend: ✅ Implemented | ⚠️ Limited | ❌ Not Supported | ❓ Unknown | 🔧 TODO

## Example: Complete Integration

```typescript
// main.ts
import { createWhatsAppProvider } from "./providers/factory.ts";
import { detectIntent } from "./dialogflow.ts";
import { syncToHubSpot } from "./hubspot_crm.ts";

const provider = createWhatsAppProvider();

export async function handleWhatsAppMessage(payload: any) {
  // 1. Parse (provider-agnostic)
  const message = await provider.receiveWebhook(payload);

  // 2. NLP (provider-agnostic)
  const { intent, entities } = await detectIntent(message.text);

  // 3. CRM sync (provider-agnostic)
  await syncToHubSpot({
    phone: message.phone,
    name: message.name,
    intent,
    entities,
  });

  // 4. Generate response (provider-agnostic)
  const response = await generateSalesResponse(intent, entities, message);

  // 5. Send (provider-agnostic)
  await provider.sendMessage(message.phone, response, {
    name: message.name,
    tags: [intent, "ai_conversation"],
  });
}

// Provider can be swapped via environment variable - zero code changes!
```

## Status

**Current**: HubSpot-only implementation
**Next**: Extract to HubSpotProvider class
**Goal**: Multi-provider support with easy switching
