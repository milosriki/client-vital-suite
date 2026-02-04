# Dialogflow ES Integration

Complete guide to integrating Dialogflow ES for natural language understanding in WhatsApp conversations.

## Table of Contents

1. [Setup](#setup)
2. [Intent Detection](#intent-detection)
3. [Context Management](#context-management)
4. [Webhook Fulfillment](#webhook-fulfillment)
5. [Entity Extraction](#entity-extraction)
6. [Best Practices](#best-practices)
7. [Performance Optimization](#performance-optimization)
8. [Error Handling](#error-handling)
9. [Quotas & Limits](#quotas--limits)

## Setup

### 1. Create Dialogflow ES Agent

1. Go to [Dialogflow ES Console](https://dialogflow.cloud.google.com/)
2. Create new agent: "WhatsApp Sales Agent"
3. Set language: English
4. Enable beta features
5. Note Project ID

### 2. Service Account Authentication

```bash
# Create service account in GCP
gcloud iam service-accounts create dialogflow-whatsapp \
  --display-name="Dialogflow WhatsApp Integration"

# Grant Dialogflow API Admin role
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:dialogflow-whatsapp@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/dialogflow.admin"

# Create key
gcloud iam service-accounts keys create dialogflow-key.json \
  --iam-account=dialogflow-whatsapp@PROJECT_ID.iam.gserviceaccount.com
```

### 3. Store Credentials

```bash
# Supabase secrets
supabase secrets set DIALOGFLOW_PROJECT_ID=your-project-id
supabase secrets set DIALOGFLOW_CREDENTIALS=$(cat dialogflow-key.json | base64)
```

## Intent Detection

### TypeScript Implementation

```typescript
import { SessionsClient } from "@google-cloud/dialogflow";

// Initialize client (reuse across requests)
const sessionClient = new SessionsClient({
  credentials: JSON.parse(
    Buffer.from(Deno.env.get("DIALOGFLOW_CREDENTIALS")!, "base64").toString(),
  ),
});

export async function detectIntent(
  text: string,
  sessionId: string = crypto.randomUUID(),
): Promise<{
  intent: string;
  confidence: number;
  entities: Record<string, any>;
  fulfillmentText: string;
  allRequiredParamsPresent: boolean;
}> {
  const projectId = Deno.env.get("DIALOGFLOW_PROJECT_ID")!;
  const sessionPath = sessionClient.projectAgentSessionPath(
    projectId,
    sessionId,
  );

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text,
        languageCode: "en-US",
      },
    },
  };

  const [response] = await sessionClient.detectIntent(request);
  const result = response.queryResult!;

  return {
    intent: result.intent?.displayName || "Default Fallback Intent",
    confidence: result.intentDetectionConfidence || 0,
    entities: result.parameters?.fields || {},
    fulfillmentText: result.fulfillmentText || "",
    allRequiredParamsPresent: result.allRequiredParamsPresent || false,
  };
}
```

### Example Usage

```typescript
const result = await detectIntent("I want to book for Monday at 6pm");

console.log(result);
// {
//   intent: 'book_appointment',
//   confidence: 0.95,
//   entities: {
//     date: { stringValue: '2026-02-10' },
//     time: { stringValue: '18:00:00' }
//   },
//   fulfillmentText: 'Great! Booking you for Monday at 6pm.',
//   allRequiredParamsPresent: true
// }
```

## Context Management

### Set Output Context

```typescript
export async function detectIntentWithContext(
  text: string,
  sessionId: string,
  outputContexts: Array<{
    name: string;
    lifespanCount: number;
    parameters?: any;
  }>,
) {
  const projectId = Deno.env.get("DIALOGFLOW_PROJECT_ID")!;
  const sessionPath = sessionClient.projectAgentSessionPath(
    projectId,
    sessionId,
  );

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text,
        languageCode: "en-US",
      },
    },
    queryParams: {
      contexts: outputContexts.map((ctx) => ({
        name: `${sessionPath}/contexts/${ctx.name}`,
        lifespanCount: ctx.lifespanCount,
        parameters: ctx.parameters,
      })),
    },
  };

  const [response] = await sessionClient.detectIntent(request);
  return response.queryResult!;
}
```

### Multi-Turn Conversation Example

```typescript
// Turn 1: Discovery
let sessionId = crypto.randomUUID();
const turn1 = await detectIntent("I want to get fit", sessionId);
// Sets context: discovery_complete (lifespan: 5)

// Turn 2: Qualification (context-aware)
const turn2 = await detectIntent("3 times a week", sessionId);
// Uses context: discovery_complete
// Intent: qualify_commitment

// Turn 3: Booking
const turn3 = await detectIntent("Monday at 6pm", sessionId);
// Intent: book_appointment
// Entities: date, time
```

## Webhook Fulfillment

### Dynamic Responses via Edge Function

```typescript
// supabase/functions/dialogflow-fulfillment/index.ts
Deno.serve(async (req) => {
  const payload = await req.json();
  const { queryResult } = payload;

  const intent = queryResult.intent.displayName;
  const parameters = queryResult.parameters;

  let fulfillmentText = "";

  switch (intent) {
    case "book_appointment":
      fulfillmentText = await generateBookingResponse(parameters);
      break;
    case "handle_objection":
      fulfillmentText = await generateObjectionResponse(parameters);
      break;
    default:
      fulfillmentText = "How can I help you today?";
  }

  return new Response(
    JSON.stringify({
      fulfillmentText,
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );
});

async function generateBookingResponse(params: any): Promise<string> {
  const date = params.date;
  const time = params.time;
  return `🎉 Perfect! You're booked for ${date} at ${time}. See you soon!`;
}
```

### Enable Webhook in Dialogflow

1. Go to Intent → Fulfillment
2. Enable "Enable webhook call for this intent"
3. Set webhook URL: `https://your-project.supabase.co/functions/v1/dialogflow-fulfillment`

## Entity Extraction

### Access Extracted Entities

```typescript
function parseEntities(fields: Record<string, any>): Record<string, any> {
  const parsed: Record<string, any> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value.stringValue) {
      parsed[key] = value.stringValue;
    } else if (value.numberValue) {
      parsed[key] = value.numberValue;
    } else if (value.listValue) {
      parsed[key] = value.listValue.values.map((v: any) => v.stringValue);
    }
  }

  return parsed;
}

// Usage
const result = await detectIntent("I want to lose weight and build muscle");
const entities = parseEntities(result.entities);
// { goal: ["weight_loss", "muscle_gain"] }
```

## Best Practices

✅ **DO**:

- Reuse SessionsClient instance (expensive to create)
- Use session IDs to track multi-turn conversations
- Cache intent detection results (consider Redis)
- Set appropriate context lifespans (2-10 turns)
- Monitor Dialogflow quotas

❌ **DON'T**:

- Create new SessionsClient for every request
- Skip session management (lose context)
- Store sensitive data in context parameters
- Exceed 180-second session timeout

## Performance Optimization

### Client Reuse

```typescript
// ❌ Bad: Creates new client every time
export async function detectIntentSlow(text: string) {
  const client = new SessionsClient({
    /* ... */
  });
  return await client.detectIntent(/* ... */);
}

// ✅ Good: Reuse client
const globalClient = new SessionsClient({
  /* ... */
});

export async function detectIntentFast(text: string) {
  return await globalClient.detectIntent(/* ... */);
}
```

### Response Caching

```typescript
import { Redis } from "https://deno.land/x/redis/mod.ts";

const redis = await Redis.connect({
  hostname: Deno.env.get("REDIS_HOST")!,
  port: 6379,
});

export async function detectIntentCached(text: string): Promise<any> {
  const cacheKey = `intent:${text.toLowerCase()}`;

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Detect intent
  const result = await detectIntent(text);

  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(result));

  return result;
}
```

## Error Handling

```typescript
export async function detectIntentSafe(text: string, sessionId?: string) {
  try {
    return await detectIntent(text, sessionId);
  } catch (error: any) {
    console.error("Dialogflow error:", error);

    // Fallback to keyword matching
    return fallbackIntentDetection(text);
  }
}

function fallbackIntentDetection(text: string) {
  const lower = text.toLowerCase();

  if (lower.includes("book") || lower.includes("schedule")) {
    return { intent: "book_appointment", confidence: 0.5, entities: {} };
  }

  if (lower.includes("expensive") || lower.includes("price")) {
    return {
      intent: "handle_objection",
      confidence: 0.5,
      entities: { objection: "price" },
    };
  }

  return { intent: "Default Fallback Intent", confidence: 0.3, entities: {} };
}
```

## Quotas & Limits

| Resource         | Limit             |
| ---------------- | ----------------- |
| Text requests    | 600/minute        |
| Entities         | 30,000 per agent  |
| Intents          | 2,000 per agent   |
| Training phrases | 10,000 per intent |
| Session duration | 20 minutes        |

## Status

**Integration**: ✅ Complete
**Caching**: ⏳ Optional (implement if needed)
**Webhook**: ⏳ Optional (for dynamic responses)
