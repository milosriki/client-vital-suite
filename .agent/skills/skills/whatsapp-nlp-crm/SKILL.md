---
name: whatsapp-nlp-crm
description: Provider-agnostic WhatsApp automation combining NLP (Dialogflow ES), CRM (HubSpot), and WhatsApp providers (AISensy, KASPO, etc.). Use when building WhatsApp sales agents, chatbots, conversational AI, booking automation, lead qualification, or CRM-integrated messaging. Supports easy provider swapping via abstraction layer.
---

# WhatsApp NLP CRM Integration

## Purpose

Build sophisticated WhatsApp sales agents that are **provider-agnostic**, combining:

- **WhatsApp Providers**: AISensy, KASPO (easy to swap)
- **NLP**: Dialogflow ES for intent recognition
- **CRM**: HubSpot for contact management
- **AI**: Custom sales psychology with Gemini

## When to Use

- Building WhatsApp sales/booking agents
- Integrating Dialogflow NLP with WhatsApp
- Connecting WhatsApp conversations to HubSpot CRM
- Creating provider-swappable chat infrastructure
- Automating lead qualification via WhatsApp

## Quick Start

### Option 1: HubSpot + Dialogflow (Current Setup)

```
WhatsApp → HubSpot Conversations API → Dialogflow NLP → Gemini AI → HubSpot Reply
```

**Best for**: Existing HubSpot customers, CRM-first workflows

### Option 2: AISensy + Dialogflow + HubSpot

```
WhatsApp → AISensy Webhook → Dialogflow NLP → Gemini AI → AISensy API
                           ↓
                      HubSpot CRM (contact sync)
```

**Best for**: More WhatsApp features (payments, catalogues), flexible CRM

### Option 3: Provider-Agnostic (Recommended)

```
WhatsApp → Provider Abstraction Layer → Dialogflow NLP → Gemini AI → Provider API
                                      ↓
                                 HubSpot CRM
```

**Best for**: Future flexibility, easy provider swapping

## Core Workflows

### Workflow 1: Provider Abstraction Layer

**See**: [references/provider_abstraction.md](references/provider_abstraction.md)

Create interface-based provider swapping:

```typescript
// providers/whatsapp_provider.ts
export interface WhatsAppProvider {
  sendMessage(phone: string, message: string, options?: any): Promise<void>;
  receiveWebhook(payload: any): Promise<IncomingMessage>;
  getName(): string;
}

// Example: Switch providers with 1 line
const provider = USE_AISENSY ? new AISensyProvider() : new HubSpotProvider();
await provider.sendMessage(phone, message);
```

### Workflow 2: Dialogflow Intent Detection

**See**: [references/dialogflow_integration.md](references/dialogflow_integration.md)

Detect sales stage from natural language:

```typescript
const intent = await detectIntent(customerMessage);
// Returns: { intent: 'book_appointment', entities: { date: 'Monday', time: '6pm' } }
```

### Workflow 3: HubSpot CRM Sync

**See**: [references/hubspot_crm.md](references/hubspot_crm.md)

Auto-create/update contacts:

```typescript
await syncToHubSpot({
  phone,
  intent,
  conversationStage,
  entities,
});
```

### Workflow 4: Complete Sales Flow

```
1. Customer: "I want to book a PT session"
   → Dialogflow detects: book_appointment intent
   → HubSpot: Create contact + deal

2. AI Response (sales psychology):
   → "Awesome! 💪 When works for you - Monday, Wednesday, or Friday?"
   → Send via current provider

3. Customer: "Monday at 6pm"
   → Slot filling extracts: { date: 'Monday', time: '18:00' }
   → HubSpot: Update deal stage to 'Booked'

4. Confirmation:
   → "🎉 You're ALL SET for Monday at 6pm!"
   → Provider sends confirmation
```

## Provider Comparison

| Provider    | Payments | Catalogues | API Reliability | Webhook Stability | Switch Cost           |
| ----------- | -------- | ---------- | --------------- | ----------------- | --------------------- |
| **HubSpot** | ❌       | ❌         | ⭐⭐⭐⭐⭐      | ⭐⭐⭐⭐          | Low (existing)        |
| **AISensy** | ✅       | ✅         | ⭐⭐⭐⭐        | ⭐⭐⭐⭐          | Low (via abstraction) |
| **KASPO**   | ✅       | ❓         | ⭐⭐⭐          | ⭐⭐⭐            | Low (via abstraction) |

**Recommendation**: Start with current setup (HubSpot), build abstraction layer, test AISensy for advanced features.

## Reference Files

### Core Integration

- **[references/provider_abstraction.md](references/provider_abstraction.md)** - Provider interface, implementation examples (HubSpot, AISensy, KASPO)
- **[references/dialogflow_integration.md](references/dialogflow_integration.md)** - Intent detection, entities, contexts, fulfillment webhooks
- **[references/hubspot_crm.md](references/hubspot_crm.md)** - Contact sync, deal creation, conversation tracking

### Provider-Specific

- **[references/hubspot_conversations.md](references/hubspot_conversations.md)** - HubSpot Conversations API, webhooks, threading
- **[references/aisensy_platform.md](references/aisensy_platform.md)** - AISensy API, webhooks, chatbot flows, payments
  **[references/kaspo_platform.md](references/kaspo_platform.md)** - KASPO integration guide (add when needed)

### Sales & NLP

- **[references/sales_flow_patterns.md](references/sales_flow_patterns.md)** - Complete 4-stage sales conversation patterns with NLP
- **[references/dialogflow_intents.md](references/dialogflow_intents.md)** - Intent design for discovery, qualification, objection, booking
- **[references/dialogflow_entities.md](references/dialogflow_entities.md)** - Entity extraction, slot filling patterns

### Implementation

- **[references/deployment_guide.md](references/deployment_guide.md)** - Step-by-step deployment for each provider combination
- **[references/testing_strategy.md](references/testing_strategy.md)** - How to test provider abstraction, NLP accuracy, CRM sync

## Best Practices

✅ **DO**:

- Use provider abstraction layer (easy swapping)
- Combine NLP + sales psychology
- Sync all conversations to HubSpot CRM
- Implement retry logic for external APIs
- Test with multiple providers before production
- Keep provider-specific code isolated in adapters

❌ **DON'T**:

- Hardcode provider-specific logic throughout codebase
- Skip CRM sync (lose conversation context)
- Forget to handle webhook signature verification
- Mix provider concerns (keep adapters clean)
- Skip Dialogflow intent testing

## Migration Path

### Phase 1: Current State (HubSpot Only)

```
WhatsApp → HubSpot → Dialogflow → Gemini → HubSpot
```

### Phase 2: Add Abstraction Layer

```
WhatsApp → Provider Interface → Dialogflow → Gemini → Provider Interface
             ↓ (implements)
         HubSpotProvider
```

### Phase 3: Add AlternativeProviders

```
WhatsApp → Provider Interface → Dialogflow → Gemini → Provider Interface
             ↓ (switch via config)
         HubSpotProvider | AISensyProvider | KASPOProvider
```

### Phase 4: Multi-Provider (Advanced)

```
WhatsApp → Router → Provider Interface → NLP → AI → Provider Interface
              ↓         ↓
          Rules    Feature Detection

Use HubSpot for reliability, AISensy for payments/catalogues
```

## Scripts

### Test Provider Abstraction

```bash
deno run scripts/test_provider.ts --provider=hubspot
deno run scripts/test_provider.ts --provider=aisensy
```

### Switch Provider

```bash
# Update .env
export WHATSAPP_PROVIDER=aisensy  # or hubspot, kaspo

# Restart systems
supabase functions deploy
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   WhatsApp Customer                     │
└─────────────────────┬───────────────────────────────────┘
                      │
         ┌────────────▼─────────────┐
         │  Provider Abstraction    │
         │  (Interface Layer)       │
         └────────────┬─────────────┘
                      │
       ┌──────────────┼──────────────┐
       │              │              │
    ┌──▼───┐     ┌───▼────┐    ┌───▼────┐
    │HubSpot│    │AISensy │   │ KASPO  │
    │Provider│    │Provider│    │Provider│
    └──┬───┘     └───┬────┘    └───┬────┘
       │             │              │
       └─────────────┼──────────────┘
                     │
            ┌────────▼─────────┐
            │  Dialogflow ES   │
            │  Intent Detection│
            └────────┬─────────┘
                     │
            ┌────────▼─────────┐
            │   Gemini AI      │
            │ Sales Psychology │
            └────────┬─────────┘
                     │
            ┌────────▼─────────┐
            │  HubSpot CRM     │
            │  Contact Sync    │
            └──────────────────┘
```

##Status

**Current**: HubSpot-only implementation (deployed)
**Next**: Build provider abstraction layer
**Goal**: Multi-provider support with easy swapping

For detailed provider implementation, see reference files.
