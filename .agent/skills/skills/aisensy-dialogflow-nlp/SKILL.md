---
name: aisensy-dialogflow-nlp
description: Comprehensive guide for building intelligent WhatsApp sales agents using AISensy platform integrated with Dialogflow ES NLP. Use when implementing conversational AI for WhatsApp, building chatbot flows, setting up webhooks, configuring intent recognition, entity extraction, or creating sales automation. Covers AISensy API integration, Dialogflow ES best practices, WhatsApp Business API, and end-to-end NLP-powered sales conversation flows.
---

# AISensy + Dialogflow ES WhatsApp NLP Integration

## Purpose

Build world-class WhatsApp sales agents combining AISensy's chatbot flow builder with Dialogflow ES natural language processing for intelligent intent recognition and entity extraction.

## When to Use This Skill

### AISensy Platform

- Setting up WhatsApp Business API with AISensy
- Building drag-and-drop chatbot flows
- Configuring webhooks for incoming WhatsApp messages
- Sending messages via AISensy API
- Integrating CRM, payments, catalogues

### Dialogflow ES NLP

- Implementing intent recognition for sales conversations
- Extracting entities (names, dates, product preferences)
- Managing multi-turn conversations with contexts
- Building natural language understanding
- Webhook fulfillment for dynamic responses

### Integration Scenarios

- Hybrid: AISensy flows + Dialogflow NLP for complex conversations
- Pure AISensy: Drag-drop flows without NLP (faster setup)
- Pure Dialogflow: Full NLP agent connected to WhatsApp via AISensy

## Quick Start

### Option 1: AISensy Flow Builder (No-Code, Recommended for Simple Flows)

1. Create chatbot flow in AISensy dashboard (drag-drop)
2. Use triggers: keywords, template messages, Click-to-WhatsApp Ads
3. Add elements: Quick Replies, Lists, Product Cards, API calls
4. Enable auto-tagging, response validation, media collection
5. Test and activate

**Best for**: Product catalogues, payment collection, simple Q&A

### Option 2: Dialogflow ES Integration (NLP-Powered)

1. Create Dialogflow ES agent
2. Define intents for sales stages (discovery, qualification, booking)
3. Configure entities (date, time, service type)
4. Connect Dialogflow to AISensy via webhook
5. Handle fulfillment via Edge Functions

**Best for**: Complex conversations, multi-turn dialogues, intent recognition

### Option 3: Hybrid (AISensy + Dialogflow)

1. Use AISensy flows for structured paths (payments, catalogues)
2. Hand off to Dialogflow for open-ended NLP conversations
3. Return to AISensy flows for conversions

**Best for**: E-commerce with conversational AI

## Core Workflows

### Workflow 1: Sending WhatsApp Messages (AISensy API)

**See**: [references/aisensy_api.md](references/aisensy_api.md) for complete API reference

```typescript
// Send message via AISensy API
const response = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${AISENSY_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    apiKey: AISENS_API_KEY,
    campaignName: "PTD_AI_Sales",
    destination: "+917428526285", // With country code
    userName: "Customer Name",
    templateParams: [], // For template variables
    media: { url: "", filename: "" }, // Optional
    tags: ["lead", "interested"], // Auto-tagging
    attributes: { companyname: "Acme Corp" }, // Custom attributes
  }),
});
```

### Workflow 2: Receiving Messages (AISensy Webhook)

**See**: [references/aisensy_webhooks.md](references/aisensy_webhooks.md) for webhook configuration

Setup webhook endpoint in AISensy dashboard -> receives:

```json
{
  "notification_id": "unique-id",
  "timestamp": 1234567890,
  "topic": "message.created",
  "data": {
    "message": {
      "id": "msg-id",
      "text": "I want to book a session",
      "media_url": "",
      "contact": {
        "id": "contact-id",
        "mobile": "+917428526285",
        "name": "Customer Name"
      }
    }
  }
}
```

### Workflow 3: Dialogflow Intent Recognition

**See**: [references/dialogflow_intents.md](references/dialogflow_intents.md) for intent patterns

```typescript
// Send message to Dialogflow ES for intent detection
import { SessionsClient } from "@google-cloud/dialogflow";

const sessionClient = new SessionsClient();
const sessionPath = sessionClient.projectAgentSessionPath(
  PROJECT_ID,
  SESSION_ID,
);

const request = {
  session: sessionPath,
  queryInput: {
    text: {
      text: customerMessage,
      languageCode: "en-US",
    },
  },
};

const responses = await sessionClient.detectIntent(request);
const result = responses[0].queryResult;

// Extract intent and entities
const intent = result.intent.displayName; // e.g., "book_appointment"
const parameters = result.parameters; // e.g., { date: "Monday", time: "6pm" }
const fulfillmentText = result.fulfillmentText; // AI response
```

### Workflow 4: Sales Conversation Flow

**See**: [references/sales_conversation_patterns.md](references/sales_conversation_patterns.md)

```
1. Discovery → Detect: "interested in PT", "want to get fit"
   Intent: discover_fitness_goals
   Entities: goal (weight_loss, muscle_gain, general_fitness)

2. Qualification → Detect: "3 days a week", "£500 budget"
   Intent: qualify_commitment
   Entities: frequency, budget

3. Objection → Detect: "too expensive", "not sure"
   Intent: handle_objection
   Entities: objection_type (price, time, commitment)

4. Booking → Detect: "when can I start", "Monday 6pm"
   Intent: book_session
   Entities: @sys.date, @sys.time
```

## Best Practices

### AISensy Chatbot Flows

✅ **DO**:

- Keep flows short and clear (2-3 steps per decision)
- Use Quick Replies for guided conversations
- Enable response validation (email, phone, date formats)
- Set up auto-tagging for lead qualification
- Test flows before enabling

❌ **DON'T**:

- Create deeply nested flows (use Dialogflow for complex logic)
- Send messages without user opt-in (WhatsApp policy)
- Skip response validation (leads to bad data)

### Dialogflow ES

✅ **DO**:

- Provide 10-20 training phrases per intent
- Use contexts for multi-turn conversations
- Mark critical parameters as "required" (slot filling)
- Implement Default Fallback Intent with helpful responses
- Create follow-up intents for structured conversations

❌ **DON'T**:

- Create overly broad intents (split into specific ones)
- Forget to handle cancellation/reset intents
- Hardcode responses (use fulfillment webhooks)

### Integration Architecture

✅ **DO**:

- Reuse SessionsClient for performance
- Implement retry logic with exponential backoff
- Enable audit logs for Dialogflow API
- Use agent versions for production traffic
- Cache intent detection results when possible

❌ **DON'T**:

- Call Dialogflow API for every message (use caching)
- Skip error handling for webhook failures
- Store private keys on client devices

## Progressive Disclosure References

For detailed information, see:

- **[references/aisensy_api.md](references/aisensy_api.md)** - Complete AISensy API reference, authentication, error handling
- **[references/aisensy_webhooks.md](references/aisensy_webhooks.md)** - Webhook configuration, topics, notification format
- **[references/aisensy_vs_dialogflow.md](references/aisensy_vs_dialogflow.md)** - Platform comparison, when to use each
- **[references/dialogflow_intents.md](references/dialogflow_intents.md)** - Intent design patterns for sales conversations
- **[references/dialogflow_entities.md](references/dialogflow_entities.md)** - Entity extraction, types, slot filling
- **[references/dialogflow_contexts.md](references/dialogflow_contexts.md)** - Context management for multi-turn conversations
- **[references/dialogflow_fulfillment.md](references/dialogflow_fulfillment.md)** - Webhook fulfillment, dynamic responses
- **[references/sales_conversation_patterns.md](references/sales_conversation_patterns.md)** - Complete sales flow patterns with NLP
- **[references/best_practices.md](references/best_practices.md)** - 🌟 **NEW**: Official Dialogflow ES Best Practices & Intent Design Strategy
- **[references/advanced_optimization_guide.md](references/advanced_optimization_guide.md)** - 🚀 **NEW**: Advanced Tuning, Hybrid Classification & Problem Solving

## Testing

Use test scripts before deploying:

```bash
# Test AISensy webhook locally
node scripts/test_aisensy_webhook.js

# Test Dialogflow intent detection
node scripts/test_dialogflow_intent.js

# Test end-to-end flow
node scripts/test_e2e_flow.js
```

## Common Patterns

### Pattern: Hybrid NLP + Structured Flow

```typescript
// 1. Receive message via AISensy webhook
const message = webhookPayload.data.message.text;

// 2. Detect intent via Dialogflow
const intent = await detectIntent(message);

// 3. Route to appropriate handler
if (intent === "book_appointment") {
  // Use AISensy flow for structured booking
  await triggerAISensyFlow("booking_flow");
} else if (intent === "product_inquiry") {
  // Use Dialogflow fulfillment for open-ended Q&A
  const response = await dialogflowFulfillment(intent, entities);
  await sendAISensyMessage(response);
}
```

### Pattern: Sales Psychology + NLP

Combine Dialogflow intent detection with sales psychology prompts:

```typescript
const stage = detectSalesStage(intent, entities);
const psychologyPrompt = getPrompt(stage, { name, history });
const aiResponse = await gemini.generate(psychologyPrompt);
await sendAISensyMessage(sanitize(aiResponse));
```

## Next Steps

1. Choose your approach (AISensy only, Dialogflow only, or hybrid)
2. Read relevant reference docs
3. Set up webhook endpoint (see [references/aisensy_webhooks.md](references/aisensy_webhooks.md))
4. Build intents (see [references/dialogflow_intents.md](references/dialogflow_intents.md))
5. Test with scripts
6. Deploy and monitor

**Status**: COMPLETE - Ready for production use ✅
